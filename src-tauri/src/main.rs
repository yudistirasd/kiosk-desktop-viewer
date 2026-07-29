// Prevents additional console window on Windows in release, do not remove!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, Position};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub index: usize,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub is_primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionPayload {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizePayload {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigStruct {
    pub last_url: String,
    pub last_monitor_index: usize,
    pub window_position: Option<PositionPayload>,
    pub window_size: Option<SizePayload>,
}

#[tauri::command]
fn get_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary_monitor = app.primary_monitor().ok().flatten();

    let primary_position = primary_monitor.as_ref().map(|m| *m.position());

    let mut list = Vec::new();
    for (index, monitor) in monitors.into_iter().enumerate() {
        let name = monitor
            .name()
            .map(|n| n.to_string())
            .unwrap_or_else(|| format!("Display {}", index + 1));
        let size = monitor.size();
        let position = monitor.position();
        let is_primary = primary_position.map_or(index == 0, |pos| pos == *position);

        list.push(MonitorInfo {
            index,
            name,
            width: size.width,
            height: size.height,
            x: position.x,
            y: position.y,
            is_primary,
        });
    }

    Ok(list)
}

#[tauri::command]
fn move_to_monitor(app: AppHandle, monitor_index: usize) -> Result<(), String> {
    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    let monitors = app.available_monitors().map_err(|e| e.to_string())?;

    if monitor_index >= monitors.len() {
        return Err(format!(
            "Invalid monitor index {}. Only {} monitor(s) available.",
            monitor_index,
            monitors.len()
        ));
    }

    let target_monitor = &monitors[monitor_index];
    let pos = target_monitor.position();

    let _ = main_window.set_fullscreen(false);

    main_window
        .set_position(Position::Physical(PhysicalPosition {
            x: pos.x,
            y: pos.y,
        }))
        .map_err(|e| e.to_string())?;

    main_window
        .set_fullscreen(true)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn exit_fullscreen(app: AppHandle) -> Result<(), String> {
    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    main_window.set_fullscreen(false).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn toggle_fullscreen(app: AppHandle) -> Result<bool, String> {
    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    let is_fs = main_window.is_fullscreen().unwrap_or(false);
    let next_state = !is_fs;
    main_window.set_fullscreen(next_state).map_err(|e| e.to_string())?;
    Ok(next_state)
}

#[tauri::command]
fn save_config(app: AppHandle, config: ConfigStruct) -> Result<(), String> {
    let store = app
        .store("config.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    let json_val = serde_json::to_value(&config).map_err(|e| e.to_string())?;
    store.set("config", json_val);
    store.save().map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

#[tauri::command]
fn load_config(app: AppHandle) -> Result<Option<ConfigStruct>, String> {
    let store = app
        .store("config.json")
        .map_err(|e| format!("Failed to access store: {}", e))?;

    if let Some(val) = store.get("config") {
        let config: ConfigStruct =
            serde_json::from_value(val).map_err(|e| format!("Failed to parse config: {}", e))?;
        Ok(Some(config))
    } else {
        Ok(None)
    }
}

fn main() {
    // Bypass WebView2 SSL Certificate Errors for Self-Signed HTTPS IP Addresses
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--ignore-certificate-errors --allow-insecure-localhost",
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_monitors,
            move_to_monitor,
            exit_fullscreen,
            toggle_fullscreen,
            save_config,
            load_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
