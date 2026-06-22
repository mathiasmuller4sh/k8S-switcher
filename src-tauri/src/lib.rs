use k8s_openapi::api::core::v1::{Event, PersistentVolumeClaim, Pod};
use k8s_openapi::api::networking::v1::Ingress;
use kube::config::Kubeconfig;
use serde::Serialize;
use std::process::Command;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

#[derive(Default, Clone)]
struct SearchCache {
    namespaces: Arc<RwLock<HashMap<String, Vec<String>>>>,
    is_syncing: Arc<RwLock<bool>>,
}

#[derive(Serialize)]
struct SearchResult {
    context: String,
    namespace: String,
}

/// Find kubectl binary, searching common macOS locations when running as a bundled .app.
fn kubectl_path() -> String {
    let candidates = [
        "/usr/local/bin/kubectl",
        "/opt/homebrew/bin/kubectl",
        "/usr/bin/kubectl",
        "/opt/local/bin/kubectl",
    ];
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return path.to_string();
        }
    }
    
    // Check in user's home (for asdf, mise, etc.)
    if let Ok(home) = std::env::var("HOME") {
        let user_candidates = [
            format!("{}/.asdf/shims/kubectl", home),
            format!("{}/.local/bin/kubectl", home),
            format!("{}/bin/kubectl", home),
        ];
        for path in &user_candidates {
            if std::path::Path::new(path).exists() {
                return path.to_string();
            }
        }
    }

    "kubectl".to_string() // fallback: rely on PATH
}

fn log_debug(msg: &str) {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let path = format!("{}/k8switcher_debug.log", home);
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        use std::io::Write;
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
        let _ = writeln!(file, "[{}] {}", now, msg);
    }
    println!("{}", msg);
}

/// Build a kubectl Command with the correct environment (KUBECONFIG, PATH).
fn kubectl_cmd() -> Command {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let kubeconfig = std::env::var("KUBECONFIG")
        .unwrap_or_else(|_| format!("{}/.kube/config", home));
    
    // Add common binary locations and Google Cloud SDK paths
    let path = format!(
        "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:{}/.asdf/shims:{}/.local/bin:{}/google-cloud-sdk/bin:/usr/local/share/google-cloud-sdk/bin:/opt/homebrew/share/google-cloud-sdk/bin:{}",
        home,
        home,
        home,
        std::env::var("PATH").unwrap_or_default()
    );
    
    let kubectl = kubectl_path();
    log_debug(&format!("Using kubectl at: {}", kubectl));
    log_debug(&format!("Using KUBECONFIG: {}", kubeconfig));
    log_debug(&format!("Extending PATH with: {}", path));
    
    let mut cmd = Command::new(kubectl);
    cmd.env("KUBECONFIG", kubeconfig).env("PATH", path);
    cmd
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerResources {
    name: String,
    cpu_request: String,
    memory_request: String,
    cpu_limit: String,
    memory_limit: String,
}

#[derive(Serialize)]
pub struct PodInfo {
    name: String,
    status: String,
    age: String,
    image: String,
    ports: Vec<u16>,
    containers: Vec<ContainerResources>,
    labels: std::collections::BTreeMap<String, String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PvcInfo {
    name: String,
    status: String,
    capacity: String,
    access_modes: Vec<String>,
    storage_class: String,
    age: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngressInfo {
    name: String,
    hosts: String,
    address: String,
    ports: String,
    age: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventInfo {
    event_type: String,
    reason: String,
    object: String,
    message: String,
    age: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretInfo {
    name: String,
    secret_type: String,
    data_count: usize,
    age: String,
}

#[derive(Serialize)]
pub struct CurrentContextInfo {
    context: String,
    namespace: String,
}

#[tauri::command]
async fn get_contexts() -> Result<Vec<String>, String> {
    let kubeconfig = Kubeconfig::read().map_err(|e| e.to_string())?;
    let contexts = kubeconfig.contexts.into_iter().map(|c| c.name).collect();
    Ok(contexts)
}

#[tauri::command]
async fn get_current_context() -> Result<CurrentContextInfo, String> {
    let kubeconfig = Kubeconfig::read().map_err(|e| e.to_string())?;
    let current_context = kubeconfig.current_context.unwrap_or_default();

    let mut namespace = "default".to_string();
    if let Some(ctx) = kubeconfig
        .contexts
        .iter()
        .find(|c| c.name == current_context)
    {
        if let Some(ctx_inner) = &ctx.context {
            if let Some(ns) = &ctx_inner.namespace {
                namespace = ns.clone();
            }
        }
    }

    Ok(CurrentContextInfo {
        context: current_context,
        namespace,
    })
}

#[tauri::command]
async fn get_namespaces(context: String) -> Result<Vec<String>, String> {
    let output = kubectl_cmd()
        .args(["--context", &context, "get", "namespaces", "-o", "jsonpath={.items[*].metadata.name}"])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string(); log_debug(&format!("kubectl error: {}", err)); return Err(err);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut namespaces: Vec<String> = stdout
        .split_whitespace()
        .map(|s| s.to_string())
        .collect();
    namespaces.sort();
    Ok(namespaces)
}

fn get_pod_status(pod: &Pod) -> String {
    if pod.metadata.deletion_timestamp.is_some() {
        return "Terminating".to_string();
    }

    let status = pod
        .status
        .as_ref()
        .and_then(|s| s.phase.clone())
        .unwrap_or_else(|| "Unknown".to_string());

    if let Some(pod_status) = &pod.status {
        // Check init containers
        if let Some(init_statuses) = &pod_status.init_container_statuses {
            for cs in init_statuses {
                if let Some(state) = &cs.state {
                    if let Some(waiting) = &state.waiting {
                        if let Some(reason) = &waiting.reason {
                            if reason != "PodInitializing" {
                                return reason.clone();
                            }
                        }
                    } else if let Some(terminated) = &state.terminated {
                        if let Some(reason) = &terminated.reason {
                            if reason != "Completed" {
                                return reason.clone();
                            }
                        }
                    }
                }
            }
        }

        // Check regular containers
        if let Some(container_statuses) = &pod_status.container_statuses {
            for cs in container_statuses {
                if let Some(state) = &cs.state {
                    if let Some(waiting) = &state.waiting {
                        if let Some(reason) = &waiting.reason {
                            return reason.clone();
                        }
                    } else if let Some(terminated) = &state.terminated {
                        if let Some(reason) = &terminated.reason {
                            if reason != "Completed" {
                                return reason.clone();
                            }
                        }
                    }
                }
            }
        }
    }

    status
}

#[tauri::command]
async fn get_pods(context: String, namespace: String) -> Result<Vec<PodInfo>, String> {
    let output = kubectl_cmd()
        .args(["--context", &context, "-n", &namespace, "get", "pods", "-o", "json"])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log_debug(&format!("kubectl get pods failed: {}", err));
        return Err(err);
    }

    let pod_list: kube::api::ObjectList<Pod> = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse pods JSON: {}", e))?;

    let mut pods = Vec::new();
    let now = chrono::Utc::now();

    for pod in pod_list {
        let name = pod.metadata.name.clone().unwrap_or_default();
        let status = get_pod_status(&pod);

        let age = if let Some(creation_timestamp) = pod.metadata.creation_timestamp {
            let ts_str = creation_timestamp.0.to_string();
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&ts_str) {
                let duration = now.signed_duration_since(dt.with_timezone(&chrono::Utc));
                let days = duration.num_days();
                let hours = duration.num_hours() % 24;
                let minutes = duration.num_minutes() % 60;
                let seconds = duration.num_seconds() % 60;

                if days > 0 {
                    format!("{}d", days)
                } else if hours > 0 {
                    format!("{}h", hours)
                } else if minutes > 0 {
                    format!("{}m", minutes)
                } else {
                    format!("{}s", seconds)
                }
            } else {
                "Unknown".to_string()
            }
        } else {
            "Unknown".to_string()
        };

        let (image, ports, containers) = if let Some(spec) = pod.spec {
            let cs = spec.containers;
            
            let is_sidecar = |name: &str| {
                let n = name.to_lowercase();
                n.contains("exporter") || n.contains("proxy") || n.contains("sidecar") || n.contains("agent") || n.contains("mesh") || n.contains("fluent") || n.contains("promtail") || n.contains("istio")
            };

            let primary_container = cs.iter().find(|c| c.ports.is_some() && !is_sidecar(&c.name))
                .or_else(|| cs.iter().find(|c| !is_sidecar(&c.name)))
                .or_else(|| cs.iter().find(|c| c.ports.is_some()))
                .or_else(|| cs.first());

            let img = primary_container
                .and_then(|c| c.image.clone())
                .unwrap_or_default();
                
            let mut pts: Vec<u16> = Vec::new();
            
            // 1. Primary container ports first
            if let Some(pc) = primary_container {
                if let Some(ports) = &pc.ports {
                    for p in ports {
                        if let Ok(port) = p.container_port.try_into() {
                            if !pts.contains(&port) {
                                pts.push(port);
                            }
                        }
                    }
                }
            }
            
            // 2. Add other containers' ports
            for c in &cs {
                if let Some(ports) = &c.ports {
                    for p in ports {
                        if let Ok(port) = p.container_port.try_into() {
                            if !pts.contains(&port) {
                                pts.push(port);
                            }
                        }
                    }
                }
            }
            
            // 3. Guess port from image if no ports are defined
            if pts.is_empty() {
                let img_lower = img.to_lowercase();
                if img_lower.contains("mongo") { pts.push(27017); }
                else if img_lower.contains("postgres") { pts.push(5432); }
                else if img_lower.contains("redis") { pts.push(6379); }
                else if img_lower.contains("mysql") || img_lower.contains("mariadb") { pts.push(3306); }
                else if img_lower.contains("rabbitmq") { pts.push(5672); }
                else if img_lower.contains("elasticsearch") { pts.push(9200); }
                else if img_lower.contains("nginx") || img_lower.contains("httpd") || img_lower.contains("caddy") { pts.push(80); }
            }

            let mut resources: Vec<ContainerResources> = Vec::new();

            // Add Init Containers
            if let Some(init_cs) = spec.init_containers {
                for c in init_cs {
                    let res = c.resources.as_ref();
                    resources.push(ContainerResources {
                        name: format!("(init) {}", c.name),
                        cpu_request: res
                            .and_then(|r| r.requests.as_ref())
                            .and_then(|m| m.get("cpu"))
                            .map(|q| q.0.clone())
                            .unwrap_or_else(|| "?".to_string()),
                        memory_request: res
                            .and_then(|r| r.requests.as_ref())
                            .and_then(|m| m.get("memory"))
                            .map(|q| q.0.clone())
                            .unwrap_or_else(|| "?".to_string()),
                        cpu_limit: res
                            .and_then(|r| r.limits.as_ref())
                            .and_then(|m| m.get("cpu"))
                            .map(|q| q.0.clone())
                            .unwrap_or_else(|| "∞".to_string()),
                        memory_limit: res
                            .and_then(|r| r.limits.as_ref())
                            .and_then(|m| m.get("memory"))
                            .map(|q| q.0.clone())
                            .unwrap_or_else(|| "∞".to_string()),
                    });
                }
            }

            // Add Regular Containers
            for c in cs {
                let res = c.resources.as_ref();
                resources.push(ContainerResources {
                    name: c.name.clone(),
                    cpu_request: res
                        .and_then(|r| r.requests.as_ref())
                        .and_then(|m| m.get("cpu"))
                        .map(|q| q.0.clone())
                        .unwrap_or_else(|| "?".to_string()),
                    memory_request: res
                        .and_then(|r| r.requests.as_ref())
                        .and_then(|m| m.get("memory"))
                        .map(|q| q.0.clone())
                        .unwrap_or_else(|| "?".to_string()),
                    cpu_limit: res
                        .and_then(|r| r.limits.as_ref())
                        .and_then(|m| m.get("cpu"))
                        .map(|q| q.0.clone())
                        .unwrap_or_else(|| "∞".to_string()),
                    memory_limit: res
                        .and_then(|r| r.limits.as_ref())
                        .and_then(|m| m.get("memory"))
                        .map(|q| q.0.clone())
                        .unwrap_or_else(|| "∞".to_string()),
                });
            }

            (img, pts, resources)
        } else {
            (String::new(), Vec::new(), Vec::new())
        };

        let labels = pod.metadata.labels.unwrap_or_default();
        
        pods.push(PodInfo {
            name,
            status,
            age,
            image,
            ports,
            containers,
            labels,
        });
    }
    pods.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(pods)
}

#[tauri::command]
async fn get_pvcs(context: String, namespace: String) -> Result<Vec<PvcInfo>, String> {
    let output = kubectl_cmd()
        .args(["--context", &context, "-n", &namespace, "get", "pvc", "-o", "json"])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log_debug(&format!("kubectl get pvc failed: {}", err));
        return Err(err);
    }

    let pvc_list: kube::api::ObjectList<PersistentVolumeClaim> = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse PVCs JSON: {}", e))?;

    let mut pvcs = Vec::new();
    let now = chrono::Utc::now();

    for pvc in pvc_list {
        let name = pvc.metadata.name.clone().unwrap_or_default();
        let status = pvc.status.as_ref()
            .and_then(|s| s.phase.clone())
            .unwrap_or_else(|| "Unknown".to_string());
        
        let capacity = pvc.status.as_ref()
            .and_then(|s| s.capacity.as_ref())
            .and_then(|c| c.get("storage"))
            .map(|q| q.0.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        let access_modes = pvc.spec.as_ref()
            .and_then(|s| s.access_modes.clone())
            .unwrap_or_default();

        let storage_class = pvc.spec.as_ref()
            .and_then(|s| s.storage_class_name.clone())
            .unwrap_or_else(|| "Default".to_string());

        let age = if let Some(creation_timestamp) = pvc.metadata.creation_timestamp {
            let ts_str = creation_timestamp.0.to_string();
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&ts_str) {
                let duration = now.signed_duration_since(dt.with_timezone(&chrono::Utc));
                let days = duration.num_days();
                let hours = duration.num_hours() % 24;
                let minutes = duration.num_minutes() % 60;
                let seconds = duration.num_seconds() % 60;

                if days > 0 {
                    format!("{}d", days)
                } else if hours > 0 {
                    format!("{}h", hours)
                } else if minutes > 0 {
                    format!("{}m", minutes)
                } else {
                    format!("{}s", seconds)
                }
            } else {
                "Unknown".to_string()
            }
        } else {
            "Unknown".to_string()
        };

        pvcs.push(PvcInfo {
            name,
            status,
            capacity,
            access_modes,
            storage_class,
            age,
        });
    }

    pvcs.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(pvcs)
}

#[tauri::command]
async fn get_ingresses(context: String, namespace: String) -> Result<Vec<IngressInfo>, String> {
    let output = kubectl_cmd()
        .args(["--context", &context, "-n", &namespace, "get", "ingress", "-o", "json"])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log_debug(&format!("kubectl get ingress failed: {}", err));
        return Err(err);
    }

    let ingress_list: kube::api::ObjectList<Ingress> = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse Ingress JSON: {}", e))?;

    let mut ingresses = Vec::new();
    let now = chrono::Utc::now();

    for ingress in ingress_list {
        let name = ingress.metadata.name.clone().unwrap_or_default();
        
        let mut hosts = Vec::new();
        if let Some(spec) = &ingress.spec {
            if let Some(rules) = &spec.rules {
                for rule in rules {
                    if let Some(h) = &rule.host {
                        hosts.push(h.clone());
                    } else {
                        hosts.push("*".to_string());
                    }
                }
            }
        }
        let hosts_str = if hosts.is_empty() { "*".to_string() } else { hosts.join(", ") };

        let mut addresses = Vec::new();
        if let Some(status) = &ingress.status {
            if let Some(lb) = &status.load_balancer {
                if let Some(ingresses) = &lb.ingress {
                    for ing in ingresses {
                        if let Some(ip) = &ing.ip {
                            addresses.push(ip.clone());
                        }
                        if let Some(hostname) = &ing.hostname {
                            addresses.push(hostname.clone());
                        }
                    }
                }
            }
        }
        let address_str = addresses.join(", ");

        let ports = "80, 443".to_string(); // Simplified for standard ingresses

        let age = if let Some(creation_timestamp) = ingress.metadata.creation_timestamp {
            let ts_str = creation_timestamp.0.to_string();
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&ts_str) {
                let duration = now.signed_duration_since(dt.with_timezone(&chrono::Utc));
                let days = duration.num_days();
                let hours = duration.num_hours() % 24;
                let minutes = duration.num_minutes() % 60;
                let seconds = duration.num_seconds() % 60;

                if days > 0 {
                    format!("{}d", days)
                } else if hours > 0 {
                    format!("{}h", hours)
                } else if minutes > 0 {
                    format!("{}m", minutes)
                } else {
                    format!("{}s", seconds)
                }
            } else {
                "Unknown".to_string()
            }
        } else {
            "Unknown".to_string()
        };

        ingresses.push(IngressInfo {
            name,
            hosts: hosts_str,
            address: address_str,
            ports,
            age,
        });
    }

    ingresses.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(ingresses)
}

#[tauri::command]
async fn get_events(context: String, namespace: String) -> Result<Vec<EventInfo>, String> {
    // Sort by lastTimestamp directly using kubectl to get chronological order
    let output = kubectl_cmd()
        .args(["--context", &context, "-n", &namespace, "get", "events", "--sort-by=.lastTimestamp", "-o", "json"])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log_debug(&format!("kubectl get events failed: {}", err));
        return Err(err);
    }

    let event_list: kube::api::ObjectList<Event> = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse Events JSON: {}", e))?;

    let mut events = Vec::new();
    let now = chrono::Utc::now();

    for event in event_list {
        let event_type = event.type_.unwrap_or_else(|| "Normal".to_string());
        let reason = event.reason.unwrap_or_default();
        let message = event.message.unwrap_or_default();
        
        let object = format!("{}/{}", 
            event.involved_object.kind.unwrap_or_default(), 
            event.involved_object.name.unwrap_or_default()
        );

        let timestamp_to_use = event.last_timestamp.or(event.metadata.creation_timestamp);

        let age = if let Some(ts) = timestamp_to_use {
            let ts_str = ts.0.to_string();
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&ts_str) {
                let duration = now.signed_duration_since(dt.with_timezone(&chrono::Utc));
                let days = duration.num_days();
                let hours = duration.num_hours() % 24;
                let minutes = duration.num_minutes() % 60;
                let seconds = duration.num_seconds() % 60;

                if days > 0 {
                    format!("{}d", days)
                } else if hours > 0 {
                    format!("{}h", hours)
                } else if minutes > 0 {
                    format!("{}m", minutes)
                } else {
                    format!("{}s", seconds)
                }
            } else {
                "Unknown".to_string()
            }
        } else {
            "Unknown".to_string()
        };

        // Prepend to show most recent first (kubectl sorts ascending)
        events.insert(0, EventInfo {
            event_type,
            reason,
            object,
            message,
            age,
        });
    }

    Ok(events)
}

#[tauri::command]
async fn get_secret_data(context: String, namespace: String, secret_name: String) -> Result<std::collections::HashMap<String, String>, String> {
    let output = kubectl_cmd()
        .args(["--context", &context, "-n", &namespace, "get", "secret", &secret_name, "-o", "json"])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log_debug(&format!("kubectl get secret data failed: {}", err));
        return Err(err);
    }

    let secret: k8s_openapi::api::core::v1::Secret = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse Secret JSON: {}", e))?;

    let mut decoded_data = std::collections::HashMap::new();

    if let Some(data) = secret.data {
        for (k, v) in data {
            let decoded_val = String::from_utf8(v.0).unwrap_or_else(|_| "[Binary Data]".to_string());
            decoded_data.insert(k, decoded_val);
        }
    }

    Ok(decoded_data)
}

#[tauri::command]
async fn get_secrets(context: String, namespace: String) -> Result<Vec<SecretInfo>, String> {
    let output = kubectl_cmd()
        .args(["--context", &context, "-n", &namespace, "get", "secrets", "-o", "json"])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log_debug(&format!("kubectl get secrets failed: {}", err));
        return Err(err);
    }

    let secret_list: kube::api::ObjectList<k8s_openapi::api::core::v1::Secret> = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse Secrets JSON: {}", e))?;

    let mut secrets = Vec::new();
    let now = chrono::Utc::now();

    for secret in secret_list {
        let name = secret.metadata.name.clone().unwrap_or_default();
        let secret_type = secret.type_.clone().unwrap_or_else(|| "Opaque".to_string());
        let data_count = secret.data.as_ref().map(|d| d.len()).unwrap_or(0);
        
        let age = if let Some(creation_timestamp) = secret.metadata.creation_timestamp {
            let ts_str = creation_timestamp.0.to_string();
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&ts_str) {
                let duration = now.signed_duration_since(dt.with_timezone(&chrono::Utc));
                let days = duration.num_days();
                let hours = duration.num_hours() % 24;
                let minutes = duration.num_minutes() % 60;
                let seconds = duration.num_seconds() % 60;

                if days > 0 {
                    format!("{}d", days)
                } else if hours > 0 {
                    format!("{}h", hours)
                } else if minutes > 0 {
                    format!("{}m", minutes)
                } else {
                    format!("{}s", seconds)
                }
            } else {
                "Unknown".to_string()
            }
        } else {
            "Unknown".to_string()
        };

        secrets.push(SecretInfo {
            name,
            secret_type,
            data_count,
            age,
        });
    }

    secrets.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(secrets)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CronJobInfo {
    name: String,
    schedule: String,
    suspend: bool,
    active: usize,
    last_schedule: String,
    age: String,
}

#[tauri::command]
async fn get_cronjobs(context: String, namespace: String) -> Result<Vec<CronJobInfo>, String> {
    let output = kubectl_cmd()
        .args(["--context", &context, "-n", &namespace, "get", "cronjobs", "-o", "json"])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log_debug(&format!("kubectl get cronjobs failed: {}", err));
        return Err(err);
    }

    let parsed: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse CronJobs JSON: {}", e))?;

    let empty_vec = vec![];
    let items = parsed["items"].as_array().unwrap_or(&empty_vec);
    let mut cronjobs = Vec::new();
    let now = chrono::Utc::now();

    for item in items {
        let name = item["metadata"]["name"].as_str().unwrap_or_default().to_string();
        let schedule = item["spec"]["schedule"].as_str().unwrap_or_default().to_string();
        let suspend = item["spec"]["suspend"].as_bool().unwrap_or(false);
        let active = item["status"]["active"].as_array().map_or(0, |a| a.len());
        
        let last_schedule = if let Some(last) = item["status"]["lastScheduleTime"].as_str() {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(last) {
                let duration = now.signed_duration_since(dt.with_timezone(&chrono::Utc));
                if duration.num_minutes() < 60 {
                    format!("{}m ago", duration.num_minutes())
                } else if duration.num_hours() < 24 {
                    format!("{}h ago", duration.num_hours())
                } else {
                    format!("{}d ago", duration.num_days())
                }
            } else {
                "Unknown".to_string()
            }
        } else {
            "Never".to_string()
        };

        let age = if let Some(creation_timestamp) = item["metadata"]["creationTimestamp"].as_str() {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(creation_timestamp) {
                let duration = now.signed_duration_since(dt.with_timezone(&chrono::Utc));
                let days = duration.num_days();
                let hours = duration.num_hours() % 24;
                let minutes = duration.num_minutes() % 60;
                let seconds = duration.num_seconds() % 60;

                if days > 0 {
                    format!("{}d", days)
                } else if hours > 0 {
                    format!("{}h", hours)
                } else if minutes > 0 {
                    format!("{}m", minutes)
                } else {
                    format!("{}s", seconds)
                }
            } else {
                "Unknown".to_string()
            }
        } else {
            "Unknown".to_string()
        };

        cronjobs.push(CronJobInfo {
            name,
            schedule,
            suspend,
            active,
            last_schedule,
            age,
        });
    }

    cronjobs.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(cronjobs)
}

#[tauri::command]
async fn trigger_cronjob(context: String, namespace: String, cronjob_name: String) -> Result<String, String> {
    let timestamp = chrono::Utc::now().timestamp();
    let job_name = format!("{}-manual-{}", cronjob_name.chars().take(30).collect::<String>(), timestamp);
    
    let output = kubectl_cmd()
        .args(["--context", &context, "-n", &namespace, "create", "job", "--from", &format!("cronjob/{}", cronjob_name), &job_name])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log_debug(&format!("kubectl create job failed: {}", err));
        return Err(err);
    }

    Ok(job_name)
}

#[tauri::command]
async fn toggle_cronjob_suspend(context: String, namespace: String, cronjob_name: String, suspend: bool) -> Result<(), String> {
    let patch = serde_json::json!({
        "spec": {
            "suspend": suspend
        }
    });
    
    let patch_str = patch.to_string();
    
    let output = kubectl_cmd()
        .args(["--context", &context, "-n", &namespace, "patch", "cronjob", &cronjob_name, "-p", &patch_str, "--type", "merge"])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log_debug(&format!("kubectl patch cronjob failed: {}", err));
        return Err(err);
    }

    Ok(())
}

#[tauri::command]
async fn delete_job(context: String, namespace: String, job_name: String) -> Result<(), String> {
    let output = kubectl_cmd()
        .args(["--context", &context, "-n", &namespace, "delete", "job", &job_name, "--wait=false"])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log_debug(&format!("kubectl delete job failed: {}", err));
        return Err(err);
    }

    Ok(())
}

#[tauri::command]
async fn get_latest_cronjob_job(context: String, namespace: String, cronjob_name: String) -> Result<String, String> {
    let output = kubectl_cmd()
        .args(["--context", &context, "-n", &namespace, "get", "jobs", "-o", "json"])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log_debug(&format!("kubectl get jobs failed: {}", err));
        return Err(err);
    }

    let parsed: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse Jobs JSON: {}", e))?;

    let empty_vec = vec![];
    let items = parsed["items"].as_array().unwrap_or(&empty_vec);
    
    let mut latest_job = None;
    let mut latest_time = 0;

    for item in items {
        let mut is_owned = false;
        if let Some(owners) = item["metadata"]["ownerReferences"].as_array() {
            for owner in owners {
                if owner["kind"].as_str() == Some("CronJob") && owner["name"].as_str() == Some(cronjob_name.as_str()) {
                    is_owned = true;
                    break;
                }
            }
        }
        
        if is_owned {
            let name = item["metadata"]["name"].as_str().unwrap_or_default().to_string();
            if let Some(creation) = item["metadata"]["creationTimestamp"].as_str() {
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(creation) {
                    let ts = dt.timestamp();
                    if ts > latest_time {
                        latest_time = ts;
                        latest_job = Some(name);
                    }
                }
            }
        }
    }

    latest_job.ok_or_else(|| "No jobs found for this cronjob".to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobInfo {
    name: String,
    status: String,
    start_time: String,
    completion_time: Option<String>,
    duration: String,
    cronjob_name: Option<String>,
}

#[tauri::command]
async fn get_jobs(context: String, namespace: String) -> Result<Vec<JobInfo>, String> {
    let output = kubectl_cmd()
        .args(["--context", &context, "-n", &namespace, "get", "jobs", "-o", "json"])
        .output()
        .map_err(|e| format!("Failed to run kubectl: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        log_debug(&format!("kubectl get jobs failed: {}", err));
        return Err(err);
    }

    let parsed: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse Jobs JSON: {}", e))?;

    let empty_vec = vec![];
    let items = parsed["items"].as_array().unwrap_or(&empty_vec);
    
    let mut jobs = Vec::new();
    let now = chrono::Utc::now();

    for item in items {
        let name = item["metadata"]["name"].as_str().unwrap_or_default().to_string();
        
        let mut cronjob_name = None;
        if let Some(owners) = item["metadata"]["ownerReferences"].as_array() {
            for owner in owners {
                if owner["kind"].as_str() == Some("CronJob") {
                    cronjob_name = owner["name"].as_str().map(|s| s.to_string());
                    break;
                }
            }
        }

        let status = if item["status"]["active"].as_i64().unwrap_or(0) > 0 {
            "Running".to_string()
        } else if item["status"]["succeeded"].as_i64().unwrap_or(0) > 0 {
            "Complete".to_string()
        } else if item["status"]["failed"].as_i64().unwrap_or(0) > 0 {
            "Failed".to_string()
        } else {
            "Pending".to_string()
        };

        let start_time = item["status"]["startTime"].as_str().unwrap_or("").to_string();
        let completion_time = item["status"]["completionTime"].as_str().map(|s| s.to_string());

        let mut duration_str = "Unknown".to_string();
        let mut sort_ts = 0;
        if !start_time.is_empty() {
            if let Ok(st) = chrono::DateTime::parse_from_rfc3339(&start_time) {
                sort_ts = st.timestamp();
                let end_time = completion_time
                    .as_ref()
                    .and_then(|c| chrono::DateTime::parse_from_rfc3339(c).ok())
                    .unwrap_or_else(|| now.into());
                
                let duration = end_time.signed_duration_since(st);
                let mins = duration.num_minutes();
                let secs = duration.num_seconds() % 60;
                
                if mins > 0 {
                    duration_str = format!("{}m{}s", mins, secs);
                } else {
                    duration_str = format!("{}s", secs);
                }
            }
        } else if let Some(creation) = item["metadata"]["creationTimestamp"].as_str() {
            if let Ok(st) = chrono::DateTime::parse_from_rfc3339(creation) {
                sort_ts = st.timestamp();
            }
        }

        let display_start_time = if let Ok(st) = chrono::DateTime::parse_from_rfc3339(&start_time) {
            st.format("%Y-%m-%d %H:%M:%S").to_string()
        } else {
            "Unknown".to_string()
        };

        jobs.push((sort_ts, JobInfo {
            name,
            status,
            start_time: display_start_time,
            completion_time,
            duration: duration_str,
            cronjob_name,
        }));
    }

    // Sort jobs descending by start time
    jobs.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(jobs.into_iter().map(|(_, j)| j).collect())
}
#[tauri::command]
async fn execute_brew_upgrade() -> Result<String, String> {
    let brew_path = if std::path::Path::new("/opt/homebrew/bin/brew").exists() {
        "/opt/homebrew/bin/brew"
    } else {
        "/usr/local/bin/brew"
    };

    let mut output = std::process::Command::new(brew_path)
        .args(["upgrade", "--cask", "mathiasmuller4sh/tap/k8s-switcher"])
        .output()
        .map_err(|e| format!("Failed to execute brew upgrade: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        
        // Si le Cask n'est pas installé (par exemple l'utilisateur a téléchargé le DMG à la main)
        // On bascule sur 'brew install --force' pour écraser l'installation manuelle par celle de brew
        if err.contains("is not installed") {
            log_debug("Cask is not installed via brew, attempting to install it...");
            output = std::process::Command::new(brew_path)
                .args(["install", "--cask", "mathiasmuller4sh/tap/k8s-switcher", "--force"])
                .output()
                .map_err(|e| format!("Failed to execute brew install: {}", e))?;
                
            if !output.status.success() {
                let install_err = String::from_utf8_lossy(&output.stderr).trim().to_string();
                log_debug(&format!("brew install error: {}", install_err));
                return Err(install_err);
            }
        } else {
            log_debug(&format!("brew upgrade error: {}", err));
            return Err(err);
        }
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
#[derive(Serialize)]
pub struct ContainerMetrics {
    cpu: String,
    memory: String,
}

#[derive(Serialize)]
pub struct PodMetrics {
    total: ContainerMetrics,
    containers: std::collections::HashMap<String, ContainerMetrics>,
}

#[tauri::command]
async fn get_pod_metrics(
    context: String,
    namespace: String,
    pod_name: String,
) -> Result<PodMetrics, String> {
    let output = kubectl_cmd()
        .args([
            "top",
            "pod",
            &pod_name,
            "--context",
            &context,
            "-n",
            &namespace,
            "--no-headers",
            "--containers",
        ])
        .output()
        .map_err(|e| format!("Failed to run kubectl top: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string(); log_debug(&format!("kubectl error: {}", err)); return Err(err);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = stdout.lines().collect();

    let mut containers = std::collections::HashMap::new();
    let _total_cpu = 0.0;
    let _total_memory = 0.0;

    for line in lines {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 4 {
            let container_name = parts[1].to_string();
            let cpu_val = parts[2].to_string();
            let mem_val = parts[3].to_string();

            containers.insert(
                container_name,
                ContainerMetrics {
                    cpu: cpu_val,
                    memory: mem_val,
                },
            );
        }
    }

    // Also get the total without --containers to be sure of the format or just sum it up
    // Actually kubectl top pod <name> without --containers is more reliable for "total"
    let total_output = kubectl_cmd()
        .args([
            "top",
            "pod",
            &pod_name,
            "--context",
            &context,
            "-n",
            &namespace,
            "--no-headers",
        ])
        .output()
        .map_err(|e| format!("Failed to run kubectl top: {}", e))?;

    let mut total = ContainerMetrics {
        cpu: "0m".to_string(),
        memory: "0Mi".to_string(),
    };
    if total_output.status.success() {
        let total_stdout = String::from_utf8_lossy(&total_output.stdout);
        let total_parts: Vec<&str> = total_stdout.split_whitespace().collect();
        if total_parts.len() >= 3 {
            total = ContainerMetrics {
                cpu: total_parts[1].to_string(),
                memory: total_parts[2].to_string(),
            };
        }
    }

    Ok(PodMetrics { total, containers })
}

fn get_terminal_script(terminal_app: Option<String>, command: &str) -> String {
    let app = terminal_app.unwrap_or_else(|| "Terminal".to_string()).to_lowercase();
    if app == "iterm" || app == "iterm2" {
        format!(
            "tell application \"iTerm\"\n\
                if (count of windows) = 0 then\n\
                    create window with default profile\n\
                else\n\
                    tell current window\n\
                        create tab with default profile\n\
                    end tell\n\
                end if\n\
                tell current session of current window\n\
                    write text \"{}\"\n\
                end tell\n\
                activate\n\
            end tell",
            command.replace("\"", "\\\"")
        )
    } else {
        format!(
            "tell app \"Terminal\" to activate\ntell app \"Terminal\" to do script \"{}\"",
            command.replace("\"", "\\\"")
        )
    }
}

fn execute_terminal_script(script: &str) -> Result<(), String> {
    Command::new("osascript")
        .arg("-e")
        .arg(script)
        .spawn()
        .map_err(|e| format!("Failed to open terminal: {}", e))?;
    Ok(())
}

#[tauri::command]
fn open_terminal(context: String, namespace: String, terminal_app: Option<String>) -> Result<(), String> {
    let kubectl_cmd = format!(
        "kubectl config use-context {} && kubectl config set-context --current --namespace={} && clear",
        context, namespace
    );
    let script = get_terminal_script(terminal_app, &kubectl_cmd);
    execute_terminal_script(&script)
}

#[tauri::command]
fn open_describe(context: String, namespace: String, pod_name: String, terminal_app: Option<String>) -> Result<(), String> {
    let kubectl_cmd = format!(
        "kubectl --context {} -n {} describe pod {}",
        context, namespace, pod_name
    );
    let script = get_terminal_script(terminal_app, &kubectl_cmd);
    execute_terminal_script(&script)
}

#[tauri::command]
fn open_logs(context: String, namespace: String, pod_name: String, terminal_app: Option<String>) -> Result<(), String> {
    let kubectl_cmd = format!(
        "kubectl --context {} -n {} logs -f {}",
        context, namespace, pod_name
    );
    let script = get_terminal_script(terminal_app, &kubectl_cmd);
    execute_terminal_script(&script)
}

#[tauri::command]
fn open_logs_by_label(context: String, namespace: String, label_selector: String, terminal_app: Option<String>) -> Result<(), String> {
    let kubectl_cmd = format!(
        "kubectl --context {} -n {} logs -l {} -f --tail=100 --prefix",
        context, namespace, label_selector
    );
    let script = get_terminal_script(terminal_app, &kubectl_cmd);
    execute_terminal_script(&script)
}

#[tauri::command]
fn open_shell(context: String, namespace: String, pod_name: String, terminal_app: Option<String>) -> Result<(), String> {
    let kubectl_cmd = format!(
        "kubectl --context {} -n {} exec -it {} -- /bin/sh",
        context, namespace, pod_name
    );
    let script = get_terminal_script(terminal_app, &kubectl_cmd);
    execute_terminal_script(&script)
}

#[tauri::command]
fn start_port_forward(
    context: String,
    namespace: String,
    pod_name: String,
    local_port: u16,
    pod_port: u16,
    terminal_app: Option<String>
) -> Result<(), String> {
    let kubectl_cmd = format!(
        "kubectl --context {} -n {} port-forward {} {}:{}",
        context, namespace, pod_name, local_port, pod_port
    );
    let script = get_terminal_script(terminal_app, &kubectl_cmd);
    execute_terminal_script(&script)
}

#[tauri::command]
fn stop_port_forward(pod_name: String) -> Result<(), String> {
    println!("Mock: Stopping port forward for pod {}", pod_name);
    Ok(())
}

#[tauri::command]
async fn rollout_restart(context: String, namespace: String, pod_name: String) -> Result<(), String> {
    // 1. Get the pod's owner (likely a ReplicaSet or StatefulSet)
    let output = kubectl_cmd()
        .args([
            "--context", &context,
            "-n", &namespace,
            "get", "pod", &pod_name,
            "-o", "jsonpath={.metadata.ownerReferences[0].kind} {.metadata.ownerReferences[0].name}"
        ])
        .output()
        .map_err(|e| format!("Failed to get pod owner: {}", e))?;
    
    let owner_info = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if owner_info.is_empty() {
        return Err("Pod has no owner reference".to_string());
    }

    let parts: Vec<&str> = owner_info.split_whitespace().collect();
    if parts.len() < 2 {
        return Err("Invalid owner reference format".to_string());
    }

    let owner_kind = parts[0];
    let mut owner_name = parts[1].to_string();
    let mut resource_type = owner_kind.to_lowercase();

    // 2. If it's a ReplicaSet, find the Deployment that owns it
    if owner_kind == "ReplicaSet" {
        let output = kubectl_cmd()
            .args([
                "--context", &context,
                "-n", &namespace,
                "get", "rs", &owner_name,
                "-o", "jsonpath={.metadata.ownerReferences[0].kind} {.metadata.ownerReferences[0].name}"
            ])
            .output();

        if let Ok(out) = output {
            let parent_info = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let parent_parts: Vec<&str> = parent_info.split_whitespace().collect();
            if parent_parts.len() >= 2 && parent_parts[0] == "Deployment" {
                resource_type = "deployment".to_string();
                owner_name = parent_parts[1].to_string();
            }
        }
    }

    // 3. Rollout restart the identified resource
    let output = kubectl_cmd()
        .args([
            "--context", &context,
            "-n", &namespace,
            "rollout", "restart", &format!("{}/{}", resource_type, owner_name)
        ])
        .output()
        .map_err(|e| format!("Failed to execute rollout restart: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string(); log_debug(&format!("kubectl error: {}", err)); return Err(err);
    }

    Ok(())
}

#[tauri::command]
async fn sync_namespaces_cache(
    state: tauri::State<'_, SearchCache>,
) -> Result<(), String> {
    let mut is_syncing = state.is_syncing.write().await;
    if *is_syncing {
        return Ok(());
    }
    *is_syncing = true;
    drop(is_syncing);

    let cache = state.namespaces.clone();
    let is_syncing_flag = state.is_syncing.clone();

        // Do this in background to avoid blocking
    tokio::spawn(async move {
        log_debug("Starting namespace cache sync...");
        let kubeconfig = match Kubeconfig::read() {
            Ok(kc) => kc,
            Err(e) => {
                log_debug(&format!("Failed to read kubeconfig in sync: {:?}", e));
                *is_syncing_flag.write().await = false;
                return;
            }
        };

        let mut initial_results = HashMap::new();
        for ctx in &kubeconfig.contexts {
            if let Some(ctx_inner) = &ctx.context {
                if let Some(ns) = &ctx_inner.namespace {
                    initial_results.insert(ctx.name.clone(), vec![ns.clone()]);
                }
            }
        }
        {
            let mut cache_write = cache.write().await;
            *cache_write = initial_results;
        }

        let contexts: Vec<String> = kubeconfig.contexts.into_iter().map(|c| c.name).collect();
        log_debug(&format!("Syncing namespaces for {} contexts...", contexts.len()));
        let mut fetch_tasks = Vec::new();

        for ctx in contexts {
            let ctx_clone = ctx.clone();
            let task = tokio::spawn(async move {
                let output_res = tokio::time::timeout(
                    std::time::Duration::from_secs(15),
                    tokio::task::spawn_blocking(move || {
                        kubectl_cmd()
                            .args(["--context", &ctx_clone, "get", "namespaces", "-o", "jsonpath={.items[*].metadata.name}"])
                            .output()
                    })
                ).await;

                let mut namespaces = Vec::new();
                if let Ok(Ok(Ok(output))) = output_res {
                    if output.status.success() {
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        namespaces = stdout.split_whitespace().map(|s| s.to_string()).collect();
                        namespaces.sort();
                    }
                }
                (ctx, namespaces)
            });
            fetch_tasks.push(task);
        }

        let mut results = HashMap::new();
        for task in fetch_tasks {
            if let Ok((ctx, namespaces)) = task.await {
                if !namespaces.is_empty() {
                    results.insert(ctx, namespaces);
                }
            }
        }

        log_debug(&format!("Sync completed. Found namespaces in {} contexts.", results.len()));
        let mut cache_write = cache.write().await;
        // Merge results so we don't lose the pre-populated default ones if a context failed
        for (ctx, mut namespaces) in results {
            if let Some(existing) = cache_write.get(&ctx) {
                for ex_ns in existing {
                    if !namespaces.contains(ex_ns) {
                        namespaces.push(ex_ns.clone());
                    }
                }
            }
            cache_write.insert(ctx, namespaces);
        }

        *is_syncing_flag.write().await = false;
    });

    Ok(())
}

#[tauri::command]
async fn search_namespaces(
    query: String,
    state: tauri::State<'_, SearchCache>,
) -> Result<Vec<SearchResult>, String> {
    let cache = state.namespaces.read().await;
    let mut results = Vec::new();
    let q = query.to_lowercase();
    
    for (ctx, namespaces) in cache.iter() {
        for ns in namespaces {
            if ns.to_lowercase().contains(&q) || ctx.to_lowercase().contains(&q) {
                results.push(SearchResult {
                    context: ctx.clone(),
                    namespace: ns.clone(),
                });
            }
        }
    }
    
    results.sort_by(|a, b| {
        match a.context.cmp(&b.context) {
            std::cmp::Ordering::Equal => a.namespace.cmp(&b.namespace),
            other => other,
        }
    });
    
    if results.len() > 100 {
        results.truncate(100);
    }
    
    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cache = SearchCache::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(cache)
        .invoke_handler(tauri::generate_handler![
            get_contexts,
            get_current_context,
            get_namespaces,
            get_pods,
            get_pod_metrics,
            open_terminal,
            open_describe,
            open_logs,
            open_shell,
            start_port_forward,
            stop_port_forward,
            rollout_restart,
            open_logs_by_label,
            get_pvcs,
            get_ingresses,
            get_events,
            get_cronjobs,
            get_secrets,
            get_secret_data,
            trigger_cronjob,
            toggle_cronjob_suspend,
            delete_job,
            get_latest_cronjob_job,
            get_jobs,
            execute_brew_upgrade,
            sync_namespaces_cache,
            search_namespaces
        ])
        .setup(|app| {
            let _handle = app.handle();
            
            // Trigger initial sync
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Some(state) = app_handle.try_state::<SearchCache>() {
                    // Call the command logic directly or just copy the logic here,
                    // Actually we can't easily call command from here.
                    // Let's just do it directly.
                    let is_syncing_flag = state.is_syncing.clone();
                    let cache = state.namespaces.clone();
                    
                    let mut is_syncing = is_syncing_flag.write().await;
                    if *is_syncing { return; }
                    *is_syncing = true;
                    drop(is_syncing);
                    
                    let kubeconfig = match Kubeconfig::read() {
                        Ok(kc) => kc,
                        Err(e) => {
                            log_debug(&format!("Failed to read kubeconfig in setup sync: {:?}", e));
                            *is_syncing_flag.write().await = false;
                            return;
                        }
                    };
                    
                    let mut initial_results = HashMap::new();
                    for ctx in &kubeconfig.contexts {
                        if let Some(ctx_inner) = &ctx.context {
                            if let Some(ns) = &ctx_inner.namespace {
                                initial_results.insert(ctx.name.clone(), vec![ns.clone()]);
                            }
                        }
                    }
                    {
                        let mut cache_write = cache.write().await;
                        *cache_write = initial_results;
                    }

                    let contexts: Vec<String> = kubeconfig.contexts.into_iter().map(|c| c.name).collect();
                    log_debug(&format!("Setup sync: Syncing namespaces for {} contexts...", contexts.len()));
                    let mut fetch_tasks = Vec::new();
                    
                    for ctx in contexts {
                        let ctx_clone = ctx.clone();
                        let task = tokio::spawn(async move {
                            let output_res = tokio::time::timeout(
                                std::time::Duration::from_secs(15),
                                tokio::task::spawn_blocking(move || {
                                    kubectl_cmd()
                                        .args(["--context", &ctx_clone, "get", "namespaces", "-o", "jsonpath={.items[*].metadata.name}"])
                                        .output()
                                })
                            ).await;
            
                            let mut namespaces = Vec::new();
                            if let Ok(Ok(Ok(output))) = output_res {
                                if output.status.success() {
                                    let stdout = String::from_utf8_lossy(&output.stdout);
                                    namespaces = stdout.split_whitespace().map(|s| s.to_string()).collect();
                                    namespaces.sort();
                                }
                            }
                            (ctx, namespaces)
                        });
                        fetch_tasks.push(task);
                    }
                    
                    let mut results = HashMap::new();
                    for task in fetch_tasks {
                        if let Ok((ctx, namespaces)) = task.await {
                            if !namespaces.is_empty() {
                                results.insert(ctx, namespaces);
                            }
                        }
                    }
                    
                    log_debug(&format!("Setup sync completed. Found namespaces in {} contexts.", results.len()));
                    let mut cache_write = cache.write().await;
                    // Merge results so we don't lose the pre-populated default ones if a context failed
                    for (ctx, mut namespaces) in results {
                        if let Some(existing) = cache_write.get(&ctx) {
                            for ex_ns in existing {
                                if !namespaces.contains(ex_ns) {
                                    namespaces.push(ex_ns.clone());
                                }
                            }
                        }
                        cache_write.insert(ctx, namespaces);
                    }
                    
                    *is_syncing_flag.write().await = false;
                }
            });

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .tooltip("K8s Switcher")
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                                #[cfg(target_os = "macos")]
                                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                                #[cfg(target_os = "macos")]
                                let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                            }
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            #[cfg(target_os = "macos")]
            {
                let app_handle = app.handle().clone();
                if let Some(window) = app.get_webview_window("main") {
                    let window_clone = window.clone();
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            let _ = window_clone.hide();
                            let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Accessory);
                        }
                    });
                }
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                
                // Set window icon explicitly (this also updates the Dock icon on macOS)
                if let Some(window) = app.get_webview_window("main") {
                    if let Some(icon) = app.default_window_icon() {
                        let _ = window.set_icon(icon.clone());
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
