use serde::Deserialize;
use std::{
    fs,
    io::{Cursor, Read},
    path::{Path, PathBuf},
};
use zip::ZipArchive;

const PETPACK_FORMAT: &str = "codex-petpack";
const PETPACK_FORMAT_VERSION: u16 = 1;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetpackManifest {
    format: String,
    format_version: u16,
    id: String,
    display_name: String,
    version: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PetpackSummary {
    pub(crate) id: String,
    pub(crate) display_name: String,
    pub(crate) version: String,
}

#[derive(Debug, Deserialize)]
struct PetManifest {
    id: Option<String>,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    name: Option<String>,
    #[serde(rename = "spritesheetPath")]
    spritesheet_path: Option<String>,
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

pub(crate) fn install_petpack_bytes(bytes: &[u8], pets_dir: &Path) -> Result<PathBuf, String> {
    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|error| error.to_string())?;
    let (petpack, spritesheet_path) = validate_petpack_archive(&mut archive)?;
    validate_required_files(&mut archive, &spritesheet_path)?;

    let destination = pets_dir.join(&petpack.id);
    let temp_destination = pets_dir.join(format!(".{}.installing", petpack.id));
    fs::create_dir_all(pets_dir).map_err(|error| error.to_string())?;
    let _ = fs::remove_dir_all(&temp_destination);
    fs::create_dir_all(&temp_destination).map_err(|error| error.to_string())?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|error| error.to_string())?;
        if file.is_dir() {
            continue;
        }
        let Some(path) = file.enclosed_name() else {
            return Err(format!("Unsafe petpack path: {}", file.name()));
        };
        if path.components().count() != 1 {
            return Err(format!("Petpack files must be at root: {}", file.name()));
        }
        let out_path = temp_destination.join(path);
        let mut out_file = fs::File::create(&out_path).map_err(|error| error.to_string())?;
        std::io::copy(&mut file, &mut out_file).map_err(|error| error.to_string())?;
    }

    let _ = fs::remove_dir_all(&destination);
    fs::rename(&temp_destination, &destination).map_err(|error| error.to_string())?;
    Ok(destination)
}

pub(crate) fn inspect_petpack_bytes(bytes: &[u8]) -> Result<PetpackSummary, String> {
    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|error| error.to_string())?;
    let (petpack, spritesheet_path) = validate_petpack_archive(&mut archive)?;
    validate_required_files(&mut archive, &spritesheet_path)?;
    Ok(PetpackSummary {
        id: petpack.id,
        display_name: petpack.display_name,
        version: petpack.version,
    })
}

fn validate_petpack_archive(
    archive: &mut ZipArchive<Cursor<&[u8]>>,
) -> Result<(PetpackManifest, String), String> {
    let petpack: PetpackManifest = read_json_entry(archive, "petpack.json")?;
    if petpack.format != PETPACK_FORMAT {
        return Err(format!("Unsupported petpack format: {}", petpack.format));
    }
    if petpack.format_version != PETPACK_FORMAT_VERSION {
        return Err(format!(
            "Unsupported petpack format version: {}",
            petpack.format_version
        ));
    }
    safe_pet_id(&petpack.id)?;
    if petpack.display_name.trim().is_empty() {
        return Err("Petpack displayName is required".to_string());
    }
    if petpack.version.trim().is_empty() {
        return Err("Petpack version is required".to_string());
    }

    let pet: PetManifest = read_json_entry(archive, "pet.json")?;
    let pet_id = pet.id.unwrap_or_else(|| petpack.id.clone());
    if pet_id != petpack.id {
        return Err(format!(
            "Pet id mismatch: petpack id is {}, pet.json id is {}",
            petpack.id, pet_id
        ));
    }
    let pet_display = pet.display_name.or(pet.name).unwrap_or_default();
    if pet_display.trim().is_empty() {
        return Err("pet.json displayName is required".to_string());
    }
    Ok((
        petpack,
        pet.spritesheet_path
            .unwrap_or_else(|| "spritesheet.webp".to_string()),
    ))
}

fn validate_required_files(
    archive: &mut ZipArchive<Cursor<&[u8]>>,
    spritesheet_path: &str,
) -> Result<(), String> {
    let required_files = ["petpack.json", "pet.json", spritesheet_path];
    for file in required_files {
        if archive.by_name(file).is_err() {
            return Err(format!("Missing required petpack file: {file}"));
        }
    }

    for index in 0..archive.len() {
        let file = archive.by_index(index).map_err(|error| error.to_string())?;
        if file.is_dir() {
            continue;
        }
        let Some(path) = file.enclosed_name() else {
            return Err(format!("Unsafe petpack path: {}", file.name()));
        };
        if path.components().count() != 1 {
            return Err(format!("Petpack files must be at root: {}", file.name()));
        }
    }
    Ok(())
}

fn read_json_entry<T: for<'de> Deserialize<'de>>(
    archive: &mut ZipArchive<Cursor<&[u8]>>,
    name: &str,
) -> Result<T, String> {
    let mut file = archive
        .by_name(name)
        .map_err(|_| format!("Missing required petpack file: {name}"))?;
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::Write,
        sync::atomic::{AtomicUsize, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };
    use zip::{write::SimpleFileOptions, ZipWriter};

    static TEMP_COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn temp_root() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before epoch")
            .as_nanos();
        let counter = TEMP_COUNTER.fetch_add(1, Ordering::SeqCst);
        let process = std::process::id();
        let dir =
            std::env::temp_dir().join(format!("codex-petpack-test-{process}-{suffix}-{counter}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn petpack(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut output = Cursor::new(Vec::new());
        {
            let mut zip = ZipWriter::new(&mut output);
            for (name, bytes) in entries {
                zip.start_file(name, SimpleFileOptions::default())
                    .expect("start zip file");
                zip.write_all(bytes).expect("write zip file");
            }
            zip.finish().expect("finish zip");
        }
        output.into_inner()
    }

    fn valid_petpack() -> Vec<u8> {
        petpack(&[
            (
                "petpack.json",
                br#"{"format":"codex-petpack","formatVersion":1,"id":"mi-fen","displayName":"Mi Fen","version":"1.0.0"}"#,
            ),
            (
                "pet.json",
                br#"{"id":"mi-fen","displayName":"Mi Fen","spritesheetPath":"spritesheet.webp"}"#,
            ),
            ("spritesheet.webp", b"webp"),
        ])
    }

    #[test]
    fn installs_valid_petpack_into_pet_directory() {
        let root = temp_root();
        let installed = install_petpack_bytes(&valid_petpack(), &root).expect("install petpack");

        assert_eq!(installed, root.join("mi-fen"));
        assert!(installed.join("petpack.json").is_file());
        assert!(installed.join("pet.json").is_file());
        assert!(installed.join("spritesheet.webp").is_file());
    }

    #[test]
    fn replacing_existing_petpack_overwrites_old_files() {
        let root = temp_root();
        let installed = install_petpack_bytes(&valid_petpack(), &root).expect("install petpack");
        fs::write(installed.join("spritesheet.webp"), b"old").expect("write old sprite");

        let replacement = petpack(&[
            (
                "petpack.json",
                br#"{"format":"codex-petpack","formatVersion":1,"id":"mi-fen","displayName":"Mi Fen","version":"1.0.1"}"#,
            ),
            (
                "pet.json",
                br#"{"id":"mi-fen","displayName":"Mi Fen","spritesheetPath":"spritesheet.webp"}"#,
            ),
            ("spritesheet.webp", b"new"),
        ]);
        install_petpack_bytes(&replacement, &root).expect("replace petpack");

        assert_eq!(
            fs::read(installed.join("spritesheet.webp")).expect("read replaced sprite"),
            b"new"
        );
        assert!(!root.join(".mi-fen.installing").exists());
    }

    #[test]
    fn rejects_missing_pet_json() {
        let root = temp_root();
        let pack = petpack(&[
            (
                "petpack.json",
                br#"{"format":"codex-petpack","formatVersion":1,"id":"mi-fen","displayName":"Mi Fen","version":"1.0.0"}"#,
            ),
            ("spritesheet.webp", b"webp"),
        ]);

        let error = install_petpack_bytes(&pack, &root).expect_err("reject missing pet.json");

        assert!(error.contains("pet.json"));
    }

    #[test]
    fn rejects_missing_spritesheet() {
        let root = temp_root();
        let pack = petpack(&[
            (
                "petpack.json",
                br#"{"format":"codex-petpack","formatVersion":1,"id":"mi-fen","displayName":"Mi Fen","version":"1.0.0"}"#,
            ),
            (
                "pet.json",
                br#"{"id":"mi-fen","displayName":"Mi Fen","spritesheetPath":"spritesheet.webp"}"#,
            ),
        ]);

        let error = install_petpack_bytes(&pack, &root).expect_err("reject missing spritesheet");

        assert!(error.contains("spritesheet.webp"));
    }

    #[test]
    fn rejects_invalid_zip() {
        let root = temp_root();

        let error = install_petpack_bytes(b"not a zip", &root).expect_err("reject invalid zip");

        assert!(!error.is_empty());
    }

    #[test]
    fn rejects_id_mismatch() {
        let root = temp_root();
        let pack = petpack(&[
            (
                "petpack.json",
                br#"{"format":"codex-petpack","formatVersion":1,"id":"mi-fen","displayName":"Mi Fen","version":"1.0.0"}"#,
            ),
            (
                "pet.json",
                br#"{"id":"other","displayName":"Other","spritesheetPath":"spritesheet.webp"}"#,
            ),
            ("spritesheet.webp", b"webp"),
        ]);

        let error = install_petpack_bytes(&pack, &root).expect_err("reject id mismatch");

        assert!(error.contains("mismatch"));
    }

    #[test]
    fn inspects_valid_petpack_without_installing() {
        let summary = inspect_petpack_bytes(&valid_petpack()).expect("inspect petpack");

        assert_eq!(
            summary,
            PetpackSummary {
                id: "mi-fen".to_string(),
                display_name: "Mi Fen".to_string(),
                version: "1.0.0".to_string(),
            }
        );
    }

    #[test]
    fn inspect_rejects_missing_pet_json() {
        let pack = petpack(&[
            (
                "petpack.json",
                br#"{"format":"codex-petpack","formatVersion":1,"id":"mi-fen","displayName":"Mi Fen","version":"1.0.0"}"#,
            ),
            ("spritesheet.webp", b"webp"),
        ]);

        let error = inspect_petpack_bytes(&pack).expect_err("reject missing pet.json");

        assert!(error.contains("pet.json"));
    }

    #[test]
    fn inspect_rejects_missing_spritesheet() {
        let pack = petpack(&[
            (
                "petpack.json",
                br#"{"format":"codex-petpack","formatVersion":1,"id":"mi-fen","displayName":"Mi Fen","version":"1.0.0"}"#,
            ),
            (
                "pet.json",
                br#"{"id":"mi-fen","displayName":"Mi Fen","spritesheetPath":"spritesheet.webp"}"#,
            ),
        ]);

        let error = inspect_petpack_bytes(&pack).expect_err("reject missing spritesheet");

        assert!(error.contains("spritesheet.webp"));
    }

    #[test]
    fn inspect_rejects_invalid_zip() {
        let error = inspect_petpack_bytes(b"not a zip").expect_err("reject invalid zip");

        assert!(!error.is_empty());
    }

    #[test]
    fn inspect_rejects_id_mismatch() {
        let pack = petpack(&[
            (
                "petpack.json",
                br#"{"format":"codex-petpack","formatVersion":1,"id":"mi-fen","displayName":"Mi Fen","version":"1.0.0"}"#,
            ),
            (
                "pet.json",
                br#"{"id":"other","displayName":"Other","spritesheetPath":"spritesheet.webp"}"#,
            ),
            ("spritesheet.webp", b"webp"),
        ]);

        let error = inspect_petpack_bytes(&pack).expect_err("reject id mismatch");

        assert!(error.contains("mismatch"));
    }

    #[test]
    fn inspect_rejects_nested_spritesheet_path() {
        let pack = petpack(&[
            (
                "petpack.json",
                br#"{"format":"codex-petpack","formatVersion":1,"id":"mi-fen","displayName":"Mi Fen","version":"1.0.0"}"#,
            ),
            (
                "pet.json",
                br#"{"id":"mi-fen","displayName":"Mi Fen","spritesheetPath":"assets/spritesheet.webp"}"#,
            ),
            ("assets/spritesheet.webp", b"webp"),
        ]);

        let error = inspect_petpack_bytes(&pack).expect_err("reject nested spritesheet path");

        assert!(error.contains("root"));
    }
}
