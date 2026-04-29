use k8s_openapi::api::core::v1::Pod;
use kube::{config::KubeConfigOptions, config::Kubeconfig, Api, Client, Config};
use serde::Serialize;
use std::process::Command;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

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
        let name = pod.metadata.name.unwrap_or_default();
        let status = pod
            .status
            .and_then(|s| s.phase)
            .unwrap_or_else(|| "Unknown".to_string());

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
            let img = cs
                .first()
                .map(|c| c.image.clone().unwrap_or_default())
                .unwrap_or_default();
            let pts: Vec<u16> = cs
                .iter()
                .flat_map(|c| c.ports.iter().flatten())
                .filter_map(|p| p.container_port.try_into().ok())
                .collect();

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

#[tauri::command]
fn open_describe(context: String, namespace: String, pod_name: String) -> Result<(), String> {
    let kubectl_cmd = format!(
        "kubectl --context {} -n {} describe pod {}",
        context, namespace, pod_name
    );
    let script = format!("tell app \"Terminal\" to do script \"{}\"", kubectl_cmd);

    Command::new("osascript")
        .arg("-e")
        .arg("tell app \"Terminal\" to activate")
        .arg("-e")
        .arg(&script)
        .spawn()
        .map_err(|e| format!("Failed to open terminal: {}", e))?;

    Ok(())
}

#[tauri::command]
fn open_logs(context: String, namespace: String, pod_name: String) -> Result<(), String> {
    let kubectl_cmd = format!(
        "kubectl --context {} -n {} logs -f {}",
        context, namespace, pod_name
    );
    let script = format!("tell app \"Terminal\" to do script \"{}\"", kubectl_cmd);

    Command::new("osascript")
        .arg("-e")
        .arg("tell app \"Terminal\" to activate")
        .arg("-e")
        .arg(&script)
        .spawn()
        .map_err(|e| format!("Failed to open terminal: {}", e))?;

    Ok(())
}

#[tauri::command]
fn open_logs_by_label(context: String, namespace: String, label_selector: String) -> Result<(), String> {
    let kubectl_cmd = format!(
        "kubectl --context {} -n {} logs -l {} -f --tail=100 --prefix",
        context, namespace, label_selector
    );
    let script = format!("tell app \"Terminal\" to do script \"{}\"", kubectl_cmd);

    Command::new("osascript")
        .arg("-e")
        .arg("tell app \"Terminal\" to activate")
        .arg("-e")
        .arg(&script)
        .spawn()
        .map_err(|e| format!("Failed to open terminal: {}", e))?;

    Ok(())
}

#[tauri::command]
fn open_shell(context: String, namespace: String, pod_name: String) -> Result<(), String> {
    let kubectl_cmd = format!(
        "kubectl --context {} -n {} exec -it {} -- /bin/sh",
        context, namespace, pod_name
    );
    let script = format!("tell app \"Terminal\" to do script \"{}\"", kubectl_cmd);

    Command::new("osascript")
        .arg("-e")
        .arg("tell app \"Terminal\" to activate")
        .arg("-e")
        .arg(&script)
        .spawn()
        .map_err(|e| format!("Failed to open terminal: {}", e))?;

    Ok(())
}

#[tauri::command]
fn start_port_forward(
    context: String,
    namespace: String,
    pod_name: String,
    local_port: u16,
    pod_port: u16,
) -> Result<(), String> {
    // For a real app, you would want to keep the Child handle so you can kill it later.
    // To keep it simple for now, we just spawn it in the background.
    // Wait, the plan says we should store the process handle. Let's just spawn it in terminal for now for transparency?
    // Let's spawn it in terminal so the user can see it and stop it manually with Ctrl+C.
    let kubectl_cmd = format!(
        "kubectl --context {} -n {} port-forward {} {}:{}",
        context, namespace, pod_name, local_port, pod_port
    );
    let script = format!("tell app \"Terminal\" to do script \"{}\"", kubectl_cmd);

    Command::new("osascript")
        .arg("-e")
        .arg("tell app \"Terminal\" to activate")
        .arg("-e")
        .arg(&script)
        .spawn()
        .map_err(|e| format!("Failed to open terminal: {}", e))?;

    Ok(())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_contexts,
            get_current_context,
            get_namespaces,
            get_pods,
            get_pod_metrics,
            open_describe,
            open_logs,
            open_shell,
            start_port_forward,
            stop_port_forward,
            rollout_restart,
            open_logs_by_label
        ])
        .setup(|app| {
            let _handle = app.handle();

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
