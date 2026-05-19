use serde::Serialize;
use serde_json::Value;
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use tauri::{AppHandle, Manager, Runtime};
use url::Url;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum PetSourceKind {
    Managed,
    External,
    Bundled,
    Codex,
}

impl PetSourceKind {
    fn as_str(self) -> &'static str {
        match self {
            PetSourceKind::Managed => "managed",
            PetSourceKind::External => "external",
            PetSourceKind::Bundled => "bundled",
            PetSourceKind::Codex => "codex",
        }
    }

    fn can_uninstall(self) -> bool {
        self == PetSourceKind::Managed
    }
}

#[derive(Clone, Debug)]
struct PetRoot {
    path: PathBuf,
    source_kind: PetSourceKind,
}

impl PetRoot {
    fn managed(path: PathBuf) -> Self {
        Self {
            path,
            source_kind: PetSourceKind::Managed,
        }
    }

    fn external(path: PathBuf) -> Self {
        Self {
            path,
            source_kind: PetSourceKind::External,
        }
    }

    fn bundled(path: PathBuf) -> Self {
        Self {
            path,
            source_kind: PetSourceKind::Bundled,
        }
    }

    fn codex(path: PathBuf) -> Self {
        Self {
            path,
            source_kind: PetSourceKind::Codex,
        }
    }
}

impl From<PathBuf> for PetRoot {
    fn from(path: PathBuf) -> Self {
        PetRoot::external(path)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PetBehavior {
    click_state: String,
    double_click_state: String,
    idle_states: Vec<String>,
    wander_directions: Vec<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    natural: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    life: Option<Value>,
}

impl Default for PetBehavior {
    fn default() -> Self {
        Self {
            click_state: "waving".to_string(),
            double_click_state: "jumping".to_string(),
            idle_states: vec![
                "review".to_string(),
                "waiting".to_string(),
                "idle".to_string(),
            ],
            wander_directions: vec![-1, 1, 0],
            natural: None,
            life: None,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PetPackage {
    pub(crate) id: String,
    display_name: String,
    description: String,
    pub(crate) version: String,
    author: String,
    license: String,
    min_app_version: String,
    tags: Vec<String>,
    changelog: Vec<String>,
    behavior: PetBehavior,
    manifest_path: String,
    pub(crate) root: String,
    pub(crate) source_kind: String,
    pub(crate) can_uninstall: bool,
    spritesheet_path: String,
    spritesheet_url: String,
    spritesheet_revision: String,
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
    version: Option<String>,
    author: Option<String>,
    license: Option<String>,
    #[serde(rename = "minAppVersion")]
    min_app_version: Option<String>,
    tags: Option<Vec<String>>,
    changelog: Option<Vec<String>>,
    behavior: Option<PetBehaviorManifest>,
    #[serde(rename = "spritesheetPath")]
    spritesheet_path: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetBehaviorManifest {
    click_state: Option<String>,
    double_click_state: Option<String>,
    idle_states: Option<Vec<String>>,
    wander_directions: Option<Vec<i32>>,
    natural: Option<Value>,
    life: Option<Value>,
}

impl From<PetBehaviorManifest> for PetBehavior {
    fn from(value: PetBehaviorManifest) -> Self {
        let default = PetBehavior::default();
        Self {
            click_state: value.click_state.unwrap_or(default.click_state),
            double_click_state: value
                .double_click_state
                .unwrap_or(default.double_click_state),
            idle_states: value
                .idle_states
                .filter(|states| !states.is_empty())
                .unwrap_or(default.idle_states),
            wander_directions: value
                .wander_directions
                .filter(|directions| !directions.is_empty())
                .unwrap_or(default.wander_directions),
            natural: value.natural,
            life: value.life,
        }
    }
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetpackManifest {
    version: Option<String>,
    author: Option<String>,
    license: Option<String>,
    min_app_version: Option<String>,
    tags: Option<Vec<String>>,
    changelog: Option<Vec<String>>,
}

fn file_url(path: &Path) -> Result<String, String> {
    Url::from_file_path(path)
        .map_err(|_| format!("could not convert path to file URL: {}", path.display()))
        .map(|url| url.to_string())
}

fn file_revision(path: &Path) -> String {
    let Ok(metadata) = fs::metadata(path) else {
        return "unknown".to_string();
    };
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    format!("{}-{modified}", metadata.len())
}

fn unique_existing_dirs(dirs: Vec<PetRoot>) -> Vec<PetRoot> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for root in dirs {
        let Ok(resolved) = root.path.canonicalize() else {
            continue;
        };
        if !resolved.is_dir() || !seen.insert(resolved.clone()) {
            continue;
        }
        result.push(PetRoot {
            path: resolved,
            source_kind: root.source_kind,
        });
    }

    result
}

pub(crate) fn user_data_dir<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_data_dir().ok()
}

pub(crate) fn user_pets_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    user_data_dir(app)
        .map(|dir| dir.join("pets"))
        .ok_or_else(|| "Could not resolve app data directory".to_string())
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

fn pet_roots<R: Runtime>(app: &AppHandle<R>) -> Vec<PetRoot> {
    let mut roots = Vec::new();

    if let Ok(raw) = env::var("CODEX_PETS_DIR") {
        roots.extend(env::split_paths(&raw).map(PetRoot::external));
    }
    if let Some(dir) = user_data_dir(app) {
        roots.push(PetRoot::managed(dir.join("pets")));
    }
    if let Some(dir) = bundled_pets_dir(app) {
        roots.push(PetRoot::bundled(dir));
    }
    if let Ok(home) = env::var("HOME") {
        roots.push(PetRoot::codex(
            PathBuf::from(home).join(".codex").join("pets"),
        ));
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

    packages.sort();
    Ok(packages)
}

fn normalize_pet_package(dir: &Path, source_kind: PetSourceKind) -> Result<PetPackage, String> {
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
    let petpack_manifest = petpack_manifest(dir);
    let description = manifest.description.unwrap_or_default();
    let version = non_empty(
        petpack_manifest
            .as_ref()
            .and_then(|manifest| manifest.version.clone()),
    )
    .unwrap_or_else(|| manifest.version.unwrap_or_default());
    let author = non_empty(
        petpack_manifest
            .as_ref()
            .and_then(|manifest| manifest.author.clone()),
    )
    .unwrap_or_else(|| manifest.author.unwrap_or_default());
    let license = non_empty(
        petpack_manifest
            .as_ref()
            .and_then(|manifest| manifest.license.clone()),
    )
    .unwrap_or_else(|| manifest.license.unwrap_or_default());
    let min_app_version = non_empty(
        petpack_manifest
            .as_ref()
            .and_then(|manifest| manifest.min_app_version.clone()),
    )
    .unwrap_or_else(|| manifest.min_app_version.unwrap_or_default());
    let tags = non_empty_vec(
        petpack_manifest
            .as_ref()
            .and_then(|manifest| manifest.tags.clone()),
    )
    .unwrap_or_else(|| manifest.tags.unwrap_or_default());
    let changelog = non_empty_vec(
        petpack_manifest
            .as_ref()
            .and_then(|manifest| manifest.changelog.clone()),
    )
    .unwrap_or_else(|| manifest.changelog.unwrap_or_default());
    let behavior = manifest.behavior.map(Into::into).unwrap_or_default();
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
        version,
        author,
        license,
        min_app_version,
        tags,
        changelog,
        behavior,
        manifest_path: manifest_path.display().to_string(),
        root: dir.display().to_string(),
        source_kind: source_kind.as_str().to_string(),
        can_uninstall: source_kind.can_uninstall(),
        spritesheet_path: resolved_spritesheet.display().to_string(),
        spritesheet_url: file_url(&resolved_spritesheet)?,
        spritesheet_revision: file_revision(&resolved_spritesheet),
    })
}

fn non_empty(value: Option<String>) -> Option<String> {
    value.filter(|value| !value.trim().is_empty())
}

fn non_empty_vec(value: Option<Vec<String>>) -> Option<Vec<String>> {
    value.filter(|items| !items.is_empty())
}

fn petpack_manifest(dir: &Path) -> Option<PetpackManifest> {
    let manifest_path = dir.join("petpack.json");
    let content = fs::read_to_string(manifest_path).ok()?;
    serde_json::from_str(&content).ok()
}

fn petpack_version(dir: &Path) -> Option<String> {
    non_empty(petpack_manifest(dir)?.version)
}

pub(crate) fn pet_version(dir: &Path) -> String {
    let manifest_path = dir.join("pet.json");
    let manifest_version = fs::read_to_string(manifest_path)
        .ok()
        .and_then(|content| serde_json::from_str::<PetManifest>(&content).ok())
        .and_then(|manifest| manifest.version);
    petpack_version(dir).unwrap_or_else(|| manifest_version.unwrap_or_default())
}

fn safe_pet_id(id: &str) -> Result<&str, String> {
    let valid = !id.is_empty()
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'));
    if valid {
        Ok(id)
    } else {
        Err(format!("Invalid pet id: {id}"))
    }
}

pub(crate) fn uninstall_user_pet(pets_dir: &Path, id: &str) -> Result<(), String> {
    safe_pet_id(id)?;
    let destination = pets_dir.join(id);
    if !destination.is_dir() {
        return Err(format!("Pet is not installed in app data: {id}"));
    }
    fs::remove_dir_all(destination).map_err(|error| error.to_string())
}

pub(crate) fn user_pet_dir(pets_dir: &Path, id: &str) -> Result<PathBuf, String> {
    safe_pet_id(id)?;
    let destination = pets_dir.join(id);
    if !destination.is_dir() {
        return Err(format!("Pet is not installed in app data: {id}"));
    }
    destination
        .canonicalize()
        .map_err(|error| error.to_string())
}

pub(crate) fn list_pet_packages<R: Runtime>(app: &AppHandle<R>) -> PetList {
    list_pet_packages_from_roots(pet_roots(app))
}

fn list_pet_packages_from_roots<T: Into<PetRoot>>(roots: Vec<T>) -> PetList {
    let roots: Vec<PetRoot> = roots.into_iter().map(Into::into).collect();
    let mut seen = HashSet::new();
    let mut pets = Vec::new();
    let mut errors = Vec::new();

    for root in &roots {
        match find_pet_packages(&root.path) {
            Ok(packages) => {
                for package in packages {
                    match normalize_pet_package(&package, root.source_kind) {
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
                root: root.path.display().to_string(),
                error,
            }),
        }
    }

    PetList {
        roots: roots
            .iter()
            .map(|root| root.path.display().to_string())
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

    #[test]
    fn keeps_earlier_roots_before_later_roots_when_display_names_sort_differently() {
        let bundled_root = temp_root();
        let external_root = temp_root();
        let bundled_pet = bundled_root.join("mi-fen");
        let external_pet = external_root.join("tigris-whippet");
        fs::create_dir_all(&bundled_pet).expect("create bundled pet");
        fs::create_dir_all(&external_pet).expect("create external pet");
        fs::write(bundled_pet.join("spritesheet.webp"), b"webp").expect("write bundled sprite");
        fs::write(external_pet.join("spritesheet.webp"), b"webp").expect("write external sprite");
        fs::write(
            bundled_pet.join("pet.json"),
            r#"{"id":"mi-fen","displayName":"米粉"}"#,
        )
        .expect("write bundled manifest");
        fs::write(
            external_pet.join("pet.json"),
            r#"{"id":"tigris-whippet","displayName":"红糖"}"#,
        )
        .expect("write external manifest");

        let list = list_pet_packages_from_roots(vec![bundled_root, external_root]);

        assert_eq!(list.pets.len(), 2);
        assert_eq!(list.pets[0].id, "mi-fen");
        assert_eq!(list.pets[1].id, "tigris-whippet");
    }

    #[test]
    fn surfaces_version_source_and_management_metadata() {
        let managed_root = temp_root();
        let external_root = temp_root();
        let managed_pet = managed_root.join("mi-fen");
        let external_pet = external_root.join("hong-tang");
        fs::create_dir_all(&managed_pet).expect("create managed pet");
        fs::create_dir_all(&external_pet).expect("create external pet");
        fs::write(managed_pet.join("spritesheet.webp"), b"webp").expect("write managed sprite");
        fs::write(external_pet.join("spritesheet.webp"), b"webp").expect("write external sprite");
        fs::write(
            managed_pet.join("petpack.json"),
            r#"{"format":"codex-petpack","formatVersion":1,"id":"mi-fen","displayName":"米粉","version":"1.2.3"}"#,
        )
        .expect("write managed petpack manifest");
        fs::write(
            managed_pet.join("pet.json"),
            r#"{"id":"mi-fen","displayName":"米粉","version":"1.0.0"}"#,
        )
        .expect("write managed manifest");
        fs::write(
            external_pet.join("pet.json"),
            r#"{"id":"hong-tang","displayName":"红糖","version":"2.0.0"}"#,
        )
        .expect("write external manifest");

        let list = list_pet_packages_from_roots(vec![
            PetRoot::managed(managed_root),
            PetRoot::external(external_root),
        ]);

        assert_eq!(list.pets.len(), 2);
        assert_eq!(list.pets[0].id, "mi-fen");
        assert_eq!(list.pets[0].version, "1.2.3");
        assert_eq!(list.pets[0].source_kind, "managed");
        assert!(list.pets[0].can_uninstall);
        assert_eq!(list.pets[1].id, "hong-tang");
        assert_eq!(list.pets[1].version, "2.0.0");
        assert_eq!(list.pets[1].source_kind, "external");
        assert!(!list.pets[1].can_uninstall);
    }

    #[test]
    fn surfaces_public_metadata_from_petpack_manifest() {
        let managed_root = temp_root();
        let managed_pet = managed_root.join("mi-fen");
        fs::create_dir_all(&managed_pet).expect("create managed pet");
        fs::write(managed_pet.join("spritesheet.webp"), b"webp").expect("write managed sprite");
        fs::write(
            managed_pet.join("petpack.json"),
            r#"{"format":"codex-petpack","formatVersion":1,"id":"mi-fen","displayName":"米粉","version":"1.2.3","author":"Chen","license":"CC-BY-4.0","minAppVersion":"0.2.0","tags":["猫咪","白色"],"changelog":["更新图集"]}"#,
        )
        .expect("write managed petpack manifest");
        fs::write(
            managed_pet.join("pet.json"),
            r#"{"id":"mi-fen","displayName":"米粉"}"#,
        )
        .expect("write minimal manifest");

        let list = list_pet_packages_from_roots(vec![PetRoot::managed(managed_root)]);

        assert_eq!(list.pets.len(), 1);
        assert_eq!(list.pets[0].version, "1.2.3");
        assert_eq!(list.pets[0].author, "Chen");
        assert_eq!(list.pets[0].license, "CC-BY-4.0");
        assert_eq!(list.pets[0].min_app_version, "0.2.0");
        assert_eq!(list.pets[0].tags, vec!["猫咪", "白色"]);
        assert_eq!(list.pets[0].changelog, vec!["更新图集"]);
    }

    #[test]
    fn surfaces_manifest_behavior_natural_and_life_config() {
        let root = temp_root();
        let pet = root.join("mi-fen");
        fs::create_dir_all(&pet).expect("create pet");
        fs::write(pet.join("spritesheet.webp"), b"webp").expect("write sprite");
        fs::write(
            pet.join("pet.json"),
            r#"{
                "id":"mi-fen",
                "displayName":"米粉",
                "behavior":{
                    "clickState":"waiting",
                    "idleStates":["review"],
                    "wanderDirections":[0],
                    "natural":{
                        "nextWanderDelayMs":[123,456],
                        "postDragState":"review"
                    },
                    "life":{
                        "phases":[
                            {
                                "id":"active",
                                "from":10,
                                "to":18,
                                "idleStates":["review"],
                                "wanderDirections":[0]
                            }
                        ]
                    }
                }
            }"#,
        )
        .expect("write manifest");

        let list = list_pet_packages_from_roots(vec![root]);
        let pet_value = serde_json::to_value(&list.pets[0]).expect("serialize pet");
        let behavior = &pet_value["behavior"];

        assert_eq!(behavior["clickState"], "waiting");
        assert_eq!(behavior["idleStates"], serde_json::json!(["review"]));
        assert_eq!(behavior["wanderDirections"], serde_json::json!([0]));
        assert_eq!(
            behavior["natural"]["nextWanderDelayMs"],
            serde_json::json!([123, 456])
        );
        assert_eq!(behavior["natural"]["postDragState"], "review");
        assert_eq!(behavior["life"]["phases"][0]["id"], "active");
        assert_eq!(behavior["life"]["phases"][0]["from"], 10);
    }

    #[test]
    fn uninstall_user_pet_removes_only_safe_managed_ids() {
        let pets_dir = temp_root();
        let pet_dir = pets_dir.join("mi-fen");
        fs::create_dir_all(&pet_dir).expect("create pet dir");
        fs::write(pet_dir.join("pet.json"), "{}").expect("write pet manifest");

        uninstall_user_pet(&pets_dir, "mi-fen").expect("uninstall managed pet");

        assert!(!pet_dir.exists());
        assert!(uninstall_user_pet(&pets_dir, "../mi-fen").is_err());
        assert!(uninstall_user_pet(&pets_dir, "missing").is_err());
    }
}
