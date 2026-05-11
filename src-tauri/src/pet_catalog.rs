use serde::Serialize;
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager, Runtime};
use url::Url;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PetPackage {
    pub(crate) id: String,
    display_name: String,
    description: String,
    manifest_path: String,
    root: String,
    spritesheet_path: String,
    spritesheet_url: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct PetError {
    root: String,
    error: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct PetList {
    roots: Vec<String>,
    pub(crate) pets: Vec<PetPackage>,
    errors: Vec<PetError>,
}

#[derive(Debug, serde::Deserialize)]
struct PetManifest {
    id: Option<String>,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    name: Option<String>,
    description: Option<String>,
    #[serde(rename = "spritesheetPath")]
    spritesheet_path: Option<String>,
}

fn file_url(path: &Path) -> Result<String, String> {
    Url::from_file_path(path)
        .map_err(|_| format!("could not convert path to file URL: {}", path.display()))
        .map(|url| url.to_string())
}

fn unique_existing_dirs(dirs: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for dir in dirs {
        let Ok(resolved) = dir.canonicalize() else {
            continue;
        };
        if !resolved.is_dir() || !seen.insert(resolved.clone()) {
            continue;
        }
        result.push(resolved);
    }

    result
}

fn user_data_dir<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_data_dir().ok()
}

fn bundled_pets_dir<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    if let Ok(resource) = app.path().resource_dir() {
        let packaged = resource.join("pets");
        if packaged.exists() {
            return Some(packaged);
        }
    }

    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|root| root.join("resources").join("pets"));
    dev.filter(|path| path.exists())
}

fn pet_roots<R: Runtime>(app: &AppHandle<R>) -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(raw) = env::var("CODEX_PETS_DIR") {
        roots.extend(env::split_paths(&raw));
    }
    if let Some(dir) = bundled_pets_dir(app) {
        roots.push(dir);
    }
    if let Some(dir) = user_data_dir(app) {
        roots.push(dir.join("pets"));
    }
    if let Ok(home) = env::var("HOME") {
        roots.push(PathBuf::from(home).join(".codex").join("pets"));
    }

    unique_existing_dirs(roots)
}

fn find_pet_packages(root: &Path) -> Result<Vec<PathBuf>, String> {
    let entries = fs::read_dir(root).map_err(|error| error.to_string())?;
    let mut packages = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let dir = entry.path();
        if dir.is_dir() && dir.join("pet.json").is_file() {
            packages.push(dir);
        }
    }

    Ok(packages)
}

fn normalize_pet_package(dir: &Path) -> Result<PetPackage, String> {
    let manifest_path = dir.join("pet.json");
    let manifest: PetManifest = serde_json::from_str(
        &fs::read_to_string(&manifest_path).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;

    let id = manifest.id.unwrap_or_else(|| {
        dir.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    });
    let display_name = manifest
        .display_name
        .or(manifest.name)
        .unwrap_or_else(|| id.clone());
    let description = manifest.description.unwrap_or_default();
    let spritesheet_path = manifest
        .spritesheet_path
        .unwrap_or_else(|| "spritesheet.webp".to_string());
    let resolved_spritesheet = dir.join(&spritesheet_path).canonicalize().map_err(|_| {
        format!(
            "Missing spritesheet for {}: {}",
            id,
            dir.join(&spritesheet_path).display()
        )
    })?;

    Ok(PetPackage {
        id,
        display_name,
        description,
        manifest_path: manifest_path.display().to_string(),
        root: dir.display().to_string(),
        spritesheet_path: resolved_spritesheet.display().to_string(),
        spritesheet_url: file_url(&resolved_spritesheet)?,
    })
}

pub(crate) fn list_pet_packages<R: Runtime>(app: &AppHandle<R>) -> PetList {
    list_pet_packages_from_roots(pet_roots(app))
}

fn list_pet_packages_from_roots(roots: Vec<PathBuf>) -> PetList {
    let mut seen = HashSet::new();
    let mut pets = Vec::new();
    let mut errors = Vec::new();

    for root in &roots {
        match find_pet_packages(root) {
            Ok(packages) => {
                for package in packages {
                    match normalize_pet_package(&package) {
                        Ok(pet) if seen.insert(pet.id.clone()) => pets.push(pet),
                        Ok(_) => {}
                        Err(error) => errors.push(PetError {
                            root: package.display().to_string(),
                            error,
                        }),
                    }
                }
            }
            Err(error) => errors.push(PetError {
                root: root.display().to_string(),
                error,
            }),
        }
    }

    pets.sort_by(|a, b| a.display_name.cmp(&b.display_name));
    PetList {
        roots: roots
            .iter()
            .map(|root| root.display().to_string())
            .collect(),
        pets,
        errors,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEMP_COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn temp_root() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before epoch")
            .as_nanos();
        let counter = TEMP_COUNTER.fetch_add(1, Ordering::SeqCst);
        let process = std::process::id();
        let dir = env::temp_dir().join(format!(
            "codex-pet-catalog-test-{process}-{suffix}-{counter}"
        ));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn scans_valid_packages_and_deduplicates_by_first_root() {
        let first_root = temp_root();
        let second_root = temp_root();
        let first_pet = first_root.join("same-id");
        let second_pet = second_root.join("same-id");
        fs::create_dir_all(&first_pet).expect("create first pet");
        fs::create_dir_all(&second_pet).expect("create second pet");
        fs::write(first_pet.join("spritesheet.webp"), b"webp").expect("write first sprite");
        fs::write(second_pet.join("spritesheet.webp"), b"webp").expect("write second sprite");
        fs::write(
            first_pet.join("pet.json"),
            r#"{"id":"same-id","displayName":"Alpha","spritesheetPath":"spritesheet.webp"}"#,
        )
        .expect("write first manifest");
        fs::write(
            second_pet.join("pet.json"),
            r#"{"id":"same-id","displayName":"Beta","spritesheetPath":"spritesheet.webp"}"#,
        )
        .expect("write second manifest");

        let list = list_pet_packages_from_roots(vec![first_root.clone(), second_root]);

        assert_eq!(list.pets.len(), 1);
        assert_eq!(list.pets[0].id, "same-id");
        assert!(list.pets[0].spritesheet_url.starts_with("file://"));
        assert!(list.pets[0]
            .root
            .contains(first_root.to_string_lossy().as_ref()));
        assert!(list.errors.is_empty());
    }

    #[test]
    fn records_manifest_errors_without_stopping_scan() {
        let root = temp_root();
        let bad_pet = root.join("bad");
        let good_pet = root.join("good");
        fs::create_dir_all(&bad_pet).expect("create bad pet");
        fs::create_dir_all(&good_pet).expect("create good pet");
        fs::write(bad_pet.join("pet.json"), r#"{"id":"bad"}"#).expect("write bad manifest");
        fs::write(good_pet.join("spritesheet.webp"), b"webp").expect("write good sprite");
        fs::write(
            good_pet.join("pet.json"),
            r#"{"id":"good","displayName":"Good"}"#,
        )
        .expect("write good manifest");

        let list = list_pet_packages_from_roots(vec![root]);

        assert_eq!(list.pets.len(), 1);
        assert_eq!(list.pets[0].id, "good");
        assert_eq!(list.errors.len(), 1);
        assert!(list.errors[0].error.contains("Missing spritesheet"));
    }
}
