mod oauth;

use std::sync::atomic::{AtomicBool, Ordering};
use std::{thread, time::Duration};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent, Wry,
};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};
#[cfg(not(debug_assertions))]
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;
#[cfg(all(debug_assertions, windows))]
use tauri_plugin_deep_link::DeepLinkExt;

struct NotificationPause {
    paused: AtomicBool,
    menu_item: MenuItem<Wry>,
}

fn window_flags() -> StateFlags {
    StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn open_context(app: &AppHandle, context: &str) {
    show_main(app);
    let _ = app.emit("desktop://open", context);
}

fn update_pause(app: &AppHandle, paused: bool) -> Result<(), String> {
    let state = app.state::<NotificationPause>();
    state
        .menu_item
        .set_text(if paused { "Resume Notifications" } else { "Pause Notifications" })
        .map_err(|error| error.to_string())?;
    state.paused.store(paused, Ordering::SeqCst);
    app.emit("desktop://notifications-paused", paused)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn notifications_paused(state: State<'_, NotificationPause>) -> bool {
    state.paused.load(Ordering::SeqCst)
}

#[tauri::command]
fn set_notifications_paused(app: AppHandle, paused: bool) -> Result<(), String> {
    update_pause(&app, paused)
}

#[tauri::command]
fn restore_main(app: AppHandle) {
    show_main(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(oauth::OAuthRuntime::default())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| show_main(app)))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_window_state::Builder::default().with_state_flags(window_flags()).build())
        .invoke_handler(tauri::generate_handler![
            notifications_paused,
            set_notifications_paused,
            restore_main,
            oauth::start_google_oauth,
            oauth::cancel_google_oauth
        ])
        .setup(|app| {
            #[cfg(all(debug_assertions, windows))]
            app.deep_link().register_all()?;

            // Autostart records the executable that enables it. A registration
            // created by an older/debug build would otherwise keep launching a
            // binary that expects the Vite development server. In packaged
            // builds, rewrite an existing entry to this installed executable.
            #[cfg(not(debug_assertions))]
            if matches!(app.autolaunch().is_enabled(), Ok(true)) {
                let _ = app.autolaunch().enable();
            }

            let open = MenuItem::with_id(app, "open", "Open Echelon", true, None::<&str>)?;
            let today = MenuItem::with_id(app, "today", "Today", true, None::<&str>)?;
            let note = MenuItem::with_id(app, "note", "Quick Note", true, None::<&str>)?;
            let focus = MenuItem::with_id(app, "focus", "Start Focus", true, None::<&str>)?;
            let schedule = MenuItem::with_id(app, "schedule", "Today's Schedule", true, None::<&str>)?;
            let pause = MenuItem::with_id(app, "pause", "Pause Notifications", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &today, &note, &focus, &schedule, &pause, &quit])?;
            app.manage(NotificationPause { paused: AtomicBool::new(false), menu_item: pause });

            let mut tray = TrayIconBuilder::new()
                .tooltip("Echelon")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => show_main(app),
                    "today" => open_context(app, "/"),
                    "note" => open_context(app, "quick-note"),
                    "focus" => open_context(app, "focus"),
                    "schedule" => open_context(app, "/plan/schedule"),
                    "pause" => {
                        let paused = app.state::<NotificationPause>().paused.load(Ordering::SeqCst);
                        let _ = update_pause(app, !paused);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            let wake_app = app.handle().clone();
            thread::spawn(move || loop {
                thread::sleep(Duration::from_secs(60));
                let _ = wake_app.emit("desktop://wake", ());
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.app_handle().save_window_state(window_flags());
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Echelon desktop");
}
