use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

const PREFERENCES_FILE: &str = "preferences.json";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub(crate) struct UserPreferences {
    pub(crate) selected_pet_id: String,
    pub(crate) scale: f64,
    pub(crate) pet_direction: String,
    pub(crate) auto_wander: bool,
    pub(crate) always_on_top: bool,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            selected_pet_id: String::new(),
            scale: 0.6,
            pet_direction: "right".to_string(),
            auto_wander: true,
            always_on_top: true,
        }
    }
}

pub(crate) fn load_preferences(root: &Path) -> Result<UserPreferences, String> {
    let path = root.join(PREFERENCES_FILE);
    if !path.exists() {
        return Ok(UserPreferences::default());
    }
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    Ok(serde_json::from_str(&content).unwrap_or_default())
}

pub(crate) fn save_preferences(
    root: &Path,
    preferences: &UserPreferences,
) -> Result<UserPreferences, String> {
    fs::create_dir_all(root).map_err(|error| error.to_string())?;
    let content = serde_json::to_string_pretty(preferences).map_err(|error| error.to_string())?;
    fs::write(root.join(PREFERENCES_FILE), content).map_err(|error| error.to_string())?;
    Ok(preferences.clone())
}

#[cfg(test)]
mod tests {
    use super::{load_preferences, save_preferences, UserPreferences};
    use std::{
        path::PathBuf,
        sync::atomic::{AtomicUsize, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn temp_root() -> PathBuf {
        std::env::temp_dir().join(format!(
            "yongsheng-preferences-test-{}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos(),
            COUNTER.fetch_add(1, Ordering::Relaxed)
        ))
    }

    #[test]
    fn saves_and_loads_user_preferences() {
        let root = temp_root();
        let preferences = UserPreferences {
            selected_pet_id: "mi-fen".to_string(),
            scale: 1.2,
            pet_direction: "left".to_string(),
            auto_wander: false,
            always_on_top: false,
        };

        save_preferences(&root, &preferences).expect("save preferences");
        let loaded = load_preferences(&root).expect("load preferences");

        assert_eq!(loaded, preferences);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn bad_json_falls_back_to_defaults() {
        let root = temp_root();
        std::fs::create_dir_all(&root).expect("create temp root");
        std::fs::write(root.join("preferences.json"), b"not json").expect("write bad json");

        assert_eq!(
            load_preferences(&root).expect("load defaults"),
            UserPreferences::default()
        );
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn missing_newer_preference_fields_use_defaults() {
        let root = temp_root();
        std::fs::create_dir_all(&root).expect("create temp root");
        std::fs::write(
            root.join("preferences.json"),
            br#"{"selectedPetId":"mi-fen","scale":1.1,"autoWander":false,"alwaysOnTop":true}"#,
        )
        .expect("write old preferences");

        let loaded = load_preferences(&root).expect("load preferences");

        assert_eq!(loaded.selected_pet_id, "mi-fen");
        assert_eq!(loaded.scale, 1.1);
        assert_eq!(loaded.pet_direction, "right");
        assert!(!loaded.auto_wander);
        assert!(loaded.always_on_top);
        let _ = std::fs::remove_dir_all(root);
    }
}
