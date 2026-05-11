use serde::Serialize;
use tauri::{AppHandle, Wry};

use crate::{
    pet_catalog::{self, PetList},
    state::AppState,
    windowing::{self, WindowBounds},
};

#[derive(Debug, Serialize)]
struct WindowState {
    #[serde(rename = "alwaysOnTop")]
    always_on_top: bool,
}

#[tauri::command]
fn list_pets(app: AppHandle<Wry>) -> PetList {
    pet_catalog::list_pet_packages(&app)
}

#[tauri::command]
fn move_by(app: AppHandle<Wry>, x: f64, y: f64) -> Result<WindowBounds, String> {
    let window = windowing::main_window(&app)?;
    windowing::move_window_by(&window, x, y)
}

#[tauri::command]
fn set_ignore_mouse_events(app: AppHandle<Wry>, ignored: bool) -> Result<bool, String> {
    let window = windowing::main_window(&app)?;
    window
        .set_ignore_cursor_events(ignored)
        .map_err(|error| error.to_string())?;
    Ok(ignored)
}

#[tauri::command]
fn reset_position(app: AppHandle<Wry>) -> Result<WindowBounds, String> {
    let window = windowing::main_window(&app)?;
    windowing::reset_window_position(&window)
}

#[tauri::command]
fn set_always_on_top(
    app: AppHandle<Wry>,
    state: tauri::State<AppState>,
    value: bool,
) -> Result<bool, String> {
    let window = windowing::main_window(&app)?;
    window
        .set_always_on_top(value)
        .map_err(|error| error.to_string())?;
    *state
        .always_on_top
        .lock()
        .map_err(|error| error.to_string())? = value;
    Ok(value)
}

#[tauri::command]
fn get_window_state(state: tauri::State<AppState>) -> Result<WindowState, String> {
    Ok(WindowState {
        always_on_top: *state
            .always_on_top
            .lock()
            .map_err(|error| error.to_string())?,
    })
}

#[tauri::command]
fn quit(app: AppHandle<Wry>) {
    app.exit(0);
}

pub(crate) fn handler() -> impl Fn(tauri::ipc::Invoke<Wry>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        list_pets,
        move_by,
        set_ignore_mouse_events,
        reset_position,
        set_always_on_top,
        get_window_state,
        quit
    ]
}
