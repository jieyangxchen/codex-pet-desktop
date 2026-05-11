mod commands;
mod pet_catalog;
mod state;
mod tray;
mod windowing;

use std::env;
use tauri::{Emitter, Wry};

use crate::{pet_catalog::list_pet_packages, state::AppState};

fn emit_e2e(app: &tauri::AppHandle<Wry>) {
    if env::var("PET_DESKTOP_E2E").ok().as_deref() != Some("1") {
        return;
    }

    let pets = list_pet_packages(app);
    println!(
        "{}",
        serde_json::json!({
            "ok": true,
            "windowCreated": true,
            "petCount": pets.pets.len(),
            "firstPet": pets.pets.first().map(|pet| pet.id.clone())
        })
    );

    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        app.exit(0);
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new_always_on_top())
        .invoke_handler(commands::handler())
        .setup(|app| {
            let handle = app.handle();
            tray::setup_tray(handle)?;
            windowing::position_initial_window(handle).map_err(|error| {
                tauri::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, error))
            })?;
            emit_e2e(handle);
            let _ = handle.emit("pet-desktop-ready", ());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Codex Pet Desktop");
}
