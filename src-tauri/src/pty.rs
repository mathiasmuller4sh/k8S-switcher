use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

pub struct PtySession {
    pub pty_master: Box<dyn portable_pty::MasterPty + Send>,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

pub struct PtyState {
    pub sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(Clone, serde::Serialize)]
struct PtyPayload {
    id: String,
    data: String,
}

#[tauri::command]
pub fn spawn_pty(
    command: String,
    args: Vec<String>,
    rows: u16,
    cols: u16,
    env: Option<HashMap<String, String>>,
    state: State<'_, PtyState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let pty_system = NativePtySystem::default();
    
    let pair = pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(&command);
    cmd.args(&args);
    if let Some(e) = env {
        for (k, v) in e {
            cmd.env(k, v);
        }
    }
    
    // Add common PATH env for macOS
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let path = format!(
        "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:{}/.asdf/shims:{}/.local/bin:{}",
        home,
        home,
        std::env::var("PATH").unwrap_or_default()
    );
    cmd.env("PATH", path);
    cmd.env("TERM", "xterm-256color");
    cmd.env("KUBECONFIG", std::env::var("KUBECONFIG").unwrap_or_else(|_| format!("{}/.kube/config", home)));

    let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let id_clone = id.clone();
    
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    
    let writer_arc = Arc::new(Mutex::new(writer));

    state.sessions.lock().unwrap().insert(id.clone(), PtySession {
        pty_master: pair.master,
        writer: writer_arc.clone(),
    });

    // Read loop in a new thread
    std::thread::spawn(move || {
        let mut buf = [0u8; 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit("pty-read", PtyPayload {
                        id: id_clone.clone(),
                        data,
                    });
                }
                Ok(_) => break, // EOF
                Err(_) => break, // Error / Process exited
            }
        }
        let _ = app_handle.emit("pty-exit", PtyPayload {
            id: id_clone.clone(),
            data: "".to_string(),
        });
    });

    Ok(id)
}

#[tauri::command]
pub fn write_pty(id: String, data: String, state: State<'_, PtyState>) -> Result<(), String> {
    if let Some(session) = state.sessions.lock().unwrap().get(&id) {
        let mut writer = session.writer.lock().unwrap();
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn resize_pty(id: String, rows: u16, cols: u16, state: State<'_, PtyState>) -> Result<(), String> {
    if let Some(session) = state.sessions.lock().unwrap().get(&id) {
        session.pty_master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
#[allow(dead_code)]
pub fn close_pty(id: String, state: State<'_, PtyState>) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    sessions.remove(&id);
    Ok(())
}
