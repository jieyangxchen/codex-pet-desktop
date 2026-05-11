#[derive(Default)]
pub(crate) struct AppState {
    pub(crate) always_on_top: std::sync::Mutex<bool>,
}

impl AppState {
    pub(crate) fn new_always_on_top() -> Self {
        Self {
            always_on_top: std::sync::Mutex::new(true),
        }
    }
}
