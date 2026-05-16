use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::Serialize;
use tauri::{AppHandle, Wry};
use tauri_plugin_opener::OpenerExt;

use crate::{
    pet_catalog::{self, PetList},
    petpack,
    state::AppState,
    windowing::{self, WindowBounds},
};

const DOWNLOADS_URL: &str = "https://jieyangxchen.github.io/codex-pet-desktop/";
const PETPACK_INDEX_URL: &str =
    "https://jieyangxchen.github.io/codex-pet-desktop/petpacks/petpacks.json";
const LATEST_RELEASE_API: &str =
    "https://api.github.com/repos/jieyangxchen/codex-pet-desktop/releases/latest";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    display_name: &'static str,
    version: &'static str,
    downloads_url: &'static str,
    latest_release_api: &'static str,
    petpack_index_url: &'static str,
}

#[derive(Debug, Serialize)]
struct WindowState {
    #[serde(rename = "alwaysOnTop")]
    always_on_top: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportPetpackResult {
    imported_pet_id: String,
    display_name: String,
    version: String,
    replaced: bool,
    previous_version: String,
    pets: PetList,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InspectPetpackResult {
    id: String,
    display_name: String,
    version: String,
    existing_managed_version: String,
    existing_visible_version: String,
    existing_visible_source_kind: String,
    will_replace_managed: bool,
    version_relation: String,
}

#[tauri::command]
fn list_pets(app: AppHandle<Wry>) -> PetList {
    pet_catalog::list_pet_packages(&app)
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        display_name: "永生计划",
        version: env!("CARGO_PKG_VERSION"),
        downloads_url: DOWNLOADS_URL,
        latest_release_api: LATEST_RELEASE_API,
        petpack_index_url: PETPACK_INDEX_URL,
    }
}

#[tauri::command]
fn open_downloads(app: AppHandle<Wry>) -> Result<(), String> {
    app.opener()
        .open_url(DOWNLOADS_URL, None::<&str>)
        .map_err(|error| error.to_string())
}

fn clean_version(value: &str) -> Option<Vec<u64>> {
    let core = value
        .trim()
        .trim_start_matches(&['v', 'V'][..])
        .split(['+', '-'])
        .next()
        .unwrap_or_default();
    if core.is_empty() {
        return None;
    }

    let mut parts = Vec::new();
    for part in core.split('.').take(3) {
        if part.is_empty() || !part.chars().all(|character| character.is_ascii_digit()) {
            return None;
        }
        parts.push(part.parse::<u64>().ok()?);
    }
    Some(
        parts
            .into_iter()
            .chain(std::iter::repeat(0))
            .take(3)
            .collect(),
    )
}

fn compare_versions(left: &str, right: &str) -> Option<std::cmp::Ordering> {
    Some(clean_version(left)?.cmp(&clean_version(right)?))
}

fn version_relation(incoming: &str, existing: Option<&str>) -> String {
    let Some(existing) = existing.filter(|value| !value.trim().is_empty()) else {
        return "new".to_string();
    };
    match compare_versions(incoming, existing) {
        Some(std::cmp::Ordering::Greater) => "upgrade",
        Some(std::cmp::Ordering::Equal) => "same",
        Some(std::cmp::Ordering::Less) => "downgrade",
        None => "unknown",
    }
    .to_string()
}

fn inspect_petpack_summary(
    app: &AppHandle<Wry>,
    summary: petpack::PetpackSummary,
) -> Result<InspectPetpackResult, String> {
    let pets_dir = pet_catalog::user_pets_dir(app)?;
    let managed_dir = pet_catalog::user_pet_dir(&pets_dir, &summary.id).ok();
    let existing_managed_version = managed_dir
        .as_deref()
        .map(pet_catalog::pet_version)
        .unwrap_or_default();

    let visible = pet_catalog::list_pet_packages(app)
        .pets
        .into_iter()
        .find(|pet| pet.id == summary.id);
    let existing_visible_version = visible
        .as_ref()
        .map(|pet| pet.version.clone())
        .unwrap_or_default();
    let existing_visible_source_kind = visible
        .as_ref()
        .map(|pet| pet.source_kind.clone())
        .unwrap_or_default();
    let baseline_version = if existing_managed_version.trim().is_empty() {
        existing_visible_version.as_str()
    } else {
        existing_managed_version.as_str()
    };
    let version_relation = version_relation(&summary.version, Some(baseline_version));

    Ok(InspectPetpackResult {
        id: summary.id,
        display_name: summary.display_name,
        version: summary.version.clone(),
        existing_managed_version,
        existing_visible_version,
        existing_visible_source_kind,
        will_replace_managed: managed_dir.is_some(),
        version_relation,
    })
}

#[tauri::command]
fn inspect_petpack(app: AppHandle<Wry>, data: String) -> Result<InspectPetpackResult, String> {
    let bytes = BASE64.decode(data).map_err(|error| error.to_string())?;
    let summary = petpack::inspect_petpack_bytes(&bytes)?;
    inspect_petpack_summary(&app, summary)
}

#[tauri::command]
fn import_petpack(app: AppHandle<Wry>, data: String) -> Result<ImportPetpackResult, String> {
    let bytes = BASE64.decode(data).map_err(|error| error.to_string())?;
    let pets_dir = pet_catalog::user_pets_dir(&app)?;
    let summary = petpack::inspect_petpack_bytes(&bytes)?;
    let previous_dir = pet_catalog::user_pet_dir(&pets_dir, &summary.id).ok();
    let replaced = previous_dir.is_some();
    let previous_version = previous_dir
        .map(|dir| pet_catalog::pet_version(&dir))
        .unwrap_or_default();
    let installed = petpack::install_petpack_bytes(&bytes, &pets_dir)?;
    let imported_pet_id = installed
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    Ok(ImportPetpackResult {
        imported_pet_id,
        display_name: summary.display_name,
        version: summary.version,
        replaced,
        previous_version,
        pets: pet_catalog::list_pet_packages(&app),
    })
}

#[tauri::command]
fn uninstall_pet(app: AppHandle<Wry>, id: String) -> Result<PetList, String> {
    let pets_dir = pet_catalog::user_pets_dir(&app)?;
    pet_catalog::uninstall_user_pet(&pets_dir, &id)?;
    Ok(pet_catalog::list_pet_packages(&app))
}

#[tauri::command]
fn reveal_pet(app: AppHandle<Wry>, id: String) -> Result<(), String> {
    let pet = pet_catalog::list_pet_packages(&app)
        .pets
        .into_iter()
        .find(|pet| pet.id == id)
        .ok_or_else(|| format!("Pet not found: {id}"))?;
    app.opener()
        .open_path(pet.root, None::<&str>)
        .map_err(|error| error.to_string())
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
        get_app_info,
        open_downloads,
        inspect_petpack,
        import_petpack,
        uninstall_pet,
        reveal_pet,
        move_by,
        set_ignore_mouse_events,
        reset_position,
        set_always_on_top,
        get_window_state,
        quit
    ]
}

#[cfg(test)]
mod tests {
    use super::{compare_versions, version_relation};

    #[test]
    fn compares_common_semver_versions() {
        assert!(compare_versions("v1.2.3", "1.2.2").is_some_and(|ordering| ordering.is_gt()));
        assert!(compare_versions("1.2.3", "1.2.3").is_some_and(|ordering| ordering.is_eq()));
        assert!(compare_versions("1.2.3", "1.3.0").is_some_and(|ordering| ordering.is_lt()));
        assert!(compare_versions("", "1.0.0").is_none());
        assert!(compare_versions("dev", "1.0.0").is_none());
        assert!(compare_versions("1.0.0", "dev").is_none());
    }

    #[test]
    fn classifies_petpack_version_relation() {
        assert_eq!(version_relation("1.0.0", None), "new");
        assert_eq!(version_relation("1.0.1", Some("1.0.0")), "upgrade");
        assert_eq!(version_relation("1.0.0", Some("1.0.0")), "same");
        assert_eq!(version_relation("0.9.0", Some("1.0.0")), "downgrade");
        assert_eq!(version_relation("", Some("1.0.0")), "unknown");
        assert_eq!(version_relation("dev", Some("1.0.0")), "unknown");
        assert_eq!(version_relation("1.0.0", Some("dev")), "unknown");
    }
}
