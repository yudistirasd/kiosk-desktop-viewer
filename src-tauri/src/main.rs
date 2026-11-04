// Prevents additional console window on Windows in release, do not remove!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::menu::{IconMenuItemBuilder, MenuBuilder, MenuItemBuilder, MenuItemKind, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Position};
use tauri_plugin_store::StoreExt;
use tauri_plugin_updater::UpdaterExt;

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
pub struct UpdateInfo {
    pub should_update: bool,
    pub current_version: String,
    pub version: Option<String>,
    pub date: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgressPayload {
    pub chunk_length: usize,
    pub content_length: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KioskProfile {
    pub id: String,
    pub name: String,
    pub url: String,
    pub monitor_index: usize,
    pub auto_monitor: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigStruct {
    pub last_url: String,
    pub last_monitor_index: usize,
    pub active_profile_id: Option<String>,
    pub profiles: Option<Vec<KioskProfile>>,
    pub always_show_toolbar: Option<bool>,
    pub window_position: Option<PositionPayload>,
    pub window_size: Option<SizePayload>,
    pub auto_monitor: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliArgsPayload {
    pub profile: Option<String>,
    pub url: Option<String>,
    pub monitor: Option<usize>,
}

#[tauri::command]
fn get_cli_args() -> Result<CliArgsPayload, String> {
    let args: Vec<String> = std::env::args().collect();
    let mut profile = None;
    let mut url = None;
    let mut monitor = None;

    let mut i = 1;
    while i < args.len() {
        if args[i] == "--profile" && i + 1 < args.len() {
            profile = Some(args[i + 1].clone());
            i += 2;
        } else if args[i] == "--url" && i + 1 < args.len() {
            url = Some(args[i + 1].clone());
            i += 2;
        } else if args[i] == "--monitor" && i + 1 < args.len() {
            monitor = args[i + 1].parse::<usize>().ok();
            i += 2;
        } else {
            i += 1;
        }
    }

    Ok(CliArgsPayload { profile, url, monitor })
}

#[tauri::command]
fn create_desktop_shortcut(name: String, profile_id: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_path = current_exe.to_str().ok_or("Invalid exe path")?;

        let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-' && c != '_', "");
        let clean_name = if safe_name.trim().is_empty() {
            "Kiosk Display".to_string()
        } else {
            safe_name.trim().to_string()
        };

        let ps_script = format!(
            "$desktop = [System.Environment]::GetFolderPath('Desktop'); \
             $s = (New-Object -ComObject WScript.Shell).CreateShortcut(\"$desktop\\{}.lnk\"); \
             $s.TargetPath = '{}'; \
             $s.IconLocation = '{},0'; \
             $s.Arguments = '--profile ' + [char]34 + '{}' + [char]34; \
             $s.Save()",
            clean_name, exe_path, exe_path, profile_id
        );

        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_script])
            .output()
            .map_err(|e| format!("Gagal memanggil PowerShell: {}", e))?;

        if output.status.success() {
            Ok(format!("Shortcut \"{}\" berhasil dibuat di Desktop!", clean_name))
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Gagal membuat shortcut: {}", stderr))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Pembuatan shortcut desktop hanya didukung pada OS Windows".to_string())
    }
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

#[tauri::command]
fn update_menu_profile_name(app: AppHandle, profile_name: Option<String>) -> Result<(), String> {
    if let Some(menu) = app.menu() {
        if let Some(item) = menu.get("setting_url") {
            let title = match profile_name {
                Some(name) if !name.trim().is_empty() => format!("Setting Profile [{}]", name.trim()),
                _ => "Setting URL & Profil...".to_string(),
            };
            match item {
                MenuItemKind::MenuItem(m) => {
                    let _ = m.set_text(title);
                }
                MenuItemKind::Icon(m) => {
                    let _ = m.set_text(title);
                }
                _ => {}
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    let current_version = app.package_info().version.to_string();
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            return Ok(UpdateInfo {
                should_update: false,
                current_version,
                version: None,
                date: None,
                body: Some(format!("Updater belum terkonfigurasi: {}", e)),
            });
        }
    };

    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            should_update: true,
            current_version,
            version: Some(update.version),
            date: update.date.map(|d| d.to_string()),
            body: update.body,
        }),
        Ok(None) => Ok(UpdateInfo {
            should_update: false,
            current_version,
            version: None,
            date: None,
            body: None,
        }),
        Err(e) => Err(format!("Gagal memeriksa pembaruan: {}", e)),
    }
}

#[tauri::command]
async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| format!("Gagal memeriksa pembaruan: {}", e))?
        .ok_or_else(|| "Tidak ada pembaruan yang tersedia".to_string())?;

    let app_clone = app.clone();
    update
        .download_and_install(
            move |chunk_length, content_length| {
                let _ = app_clone.emit(
                    "update-download-progress",
                    UpdateProgressPayload {
                        chunk_length,
                        content_length,
                    },
                );
            },
            || {},
        )
        .await
        .map_err(|e| format!("Gagal memasang update: {}", e))?;

    app.restart();
}

fn main() {
    // Bypass WebView2 SSL Certificate Errors for Self-Signed HTTPS IP Addresses
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--ignore-certificate-errors --allow-insecure-localhost",
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            let mut shortcut_profile_id = None;
            let mut i = 1;
            while i < args.len() {
                if args[i] == "--profile" && i + 1 < args.len() {
                    shortcut_profile_id = Some(args[i + 1].clone());
                    break;
                }
                i += 1;
            }

            let mut initial_setting_title = "Setting URL & Profil...".to_string();
            if let Some(prof_id) = shortcut_profile_id {
                if let Ok(store) = app.store("config.json") {
                    if let Some(val) = store.get("config") {
                        if let Ok(cfg) = serde_json::from_value::<ConfigStruct>(val) {
                            if let Some(profiles) = cfg.profiles {
                                if let Some(p) = profiles.into_iter().find(|p| p.id == prof_id || p.name.to_lowercase() == prof_id.to_lowercase()) {
                                    initial_setting_title = format!("Setting Profile [{}]", p.name);
                                }
                            }
                        }
                    }
                }
            }

            let quit = MenuItemBuilder::with_id("quit", "Keluar Aplikasi")
                .accelerator("Ctrl+Q")
                .build(app)?;

            let check_update_item = MenuItemBuilder::with_id("check_update", "Periksa Pembaruan...")
                .build(app)?;

            let menu_setting = if let Some(icon) = app.default_window_icon() {
                let setting_url = IconMenuItemBuilder::with_id("setting_url", &initial_setting_title)
                    .accelerator("Ctrl+S")
                    .icon(icon.clone())
                    .build(app)?;
                SubmenuBuilder::new(app, "Setting")
                    .item(&setting_url)
                    .separator()
                    .item(&check_update_item)
                    .separator()
                    .item(&quit)
                    .build()?
            } else {
                let setting_url = MenuItemBuilder::with_id("setting_url", &initial_setting_title)
                    .accelerator("Ctrl+S")
                    .build(app)?;
                SubmenuBuilder::new(app, "Setting")
                    .item(&setting_url)
                    .separator()
                    .item(&check_update_item)
                    .separator()
                    .item(&quit)
                    .build()?
            };

            let mut display_submenu_builder = SubmenuBuilder::new(app, "Display");

            if let Ok(monitors) = app.available_monitors() {
                let primary_monitor = app.primary_monitor().ok().flatten();
                let primary_pos = primary_monitor.as_ref().map(|m| *m.position());

                for (index, monitor) in monitors.into_iter().enumerate() {
                    let is_primary = primary_pos.map_or(index == 0, |pos| pos == *monitor.position());
                    let size = monitor.size();

                    let label = format!(
                        "Screen {} ({}) - {}x{} px",
                        index + 1,
                        if is_primary { "Layar Utama" } else { "Layar Sekunder" },
                        size.width,
                        size.height
                    );
                    let item_id = format!("move_display_{}", index);
                    let menu_item = MenuItemBuilder::with_id(&item_id, &label).build(app)?;
                    display_submenu_builder = display_submenu_builder.item(&menu_item);
                }
            } else {
                let default_item = MenuItemBuilder::with_id("move_display_0", "Screen 1 (Layar Utama)").build(app)?;
                display_submenu_builder = display_submenu_builder.item(&default_item);
            }

            let exit_fs = MenuItemBuilder::with_id("exit_fullscreen", "Keluar Fullscreen (Esc)")
                .accelerator("Esc")
                .build(app)?;

            display_submenu_builder = display_submenu_builder.separator().item(&exit_fs);
            let menu_display = display_submenu_builder.build()?;

            let menu = MenuBuilder::new(app)
                .item(&menu_setting)
                .item(&menu_display)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                let id = event.id().0.as_str();
                if id == "setting_url" {
                    let _ = app_handle.emit("open-url-setting", ());
                } else if id == "check_update" {
                    let _ = app_handle.emit("open-updater-check", ());
                } else if id == "exit_fullscreen" {
                    if let Some(win) = app_handle.get_webview_window("main") {
                        let _ = win.set_fullscreen(false);
                    }
                } else if id == "quit" {
                    app_handle.exit(0);
                } else if id.starts_with("move_display_") {
                    if let Ok(index) = id.trim_start_matches("move_display_").parse::<usize>() {
                        let _ = move_to_monitor(app_handle.clone(), index);
                        let _ = app_handle.emit("display-changed", index);
                    }
                }
            });

            if let Some(win) = app.get_webview_window("main") {
                let _ = win.maximize();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_monitors,
            move_to_monitor,
            exit_fullscreen,
            toggle_fullscreen,
            save_config,
            load_config,
            get_cli_args,
            create_desktop_shortcut,
            update_menu_profile_name,
            get_app_version,
            check_for_updates,
            install_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
