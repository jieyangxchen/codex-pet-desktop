export function createDesktopBridge() {
  const tauriInvoke = window.__TAURI__?.core?.invoke;
  const tauriConvertFileSrc = window.__TAURI__?.core?.convertFileSrc;
  const tauriListen = window.__TAURI__?.event?.listen;
  const petDesktop =
    window.petDesktop ||
    (tauriInvoke
      ? {
          listPets: () => tauriInvoke("list_pets"),
          getAppInfo: () => tauriInvoke("get_app_info"),
          getPreferences: () => tauriInvoke("get_preferences"),
          savePreferences: (preferences) => tauriInvoke("save_preferences", { preferences }),
          installAppUpdate: (data, fileName) => tauriInvoke("install_app_update", { data, fileName }),
          openDownloads: () => tauriInvoke("open_downloads"),
          openDataDir: () => tauriInvoke("open_data_dir"),
          inspectPetpack: (data) => tauriInvoke("inspect_petpack", { data }),
          importPetpack: (data) => tauriInvoke("import_petpack", { data }),
          uninstallPet: (id) => tauriInvoke("uninstall_pet", { id }),
          revealPet: (id) => tauriInvoke("reveal_pet", { id }),
          moveBy: (x, y) => tauriInvoke("move_by", { x, y }),
          resizeWindow: (width, height, anchor) =>
            tauriInvoke("resize_window", anchor ? { width, height, anchor } : { width, height }),
          setIgnoreMouseEvents: (ignored) => tauriInvoke("set_ignore_mouse_events", { ignored }),
          resetPosition: () => tauriInvoke("reset_position"),
          setAlwaysOnTop: (value) => tauriInvoke("set_always_on_top", { value }),
          getWindowState: () => tauriInvoke("get_window_state"),
          updateTrayState: (state) => tauriInvoke("update_tray_state", { state }),
          centerPosition: () => tauriInvoke("center_position"),
          quit: () => tauriInvoke("quit")
        }
      : null);

  return {
    petDesktop,
    tauriConvertFileSrc,
    listenTrayCommand: (handler) => {
      if (typeof tauriListen !== "function") {
        return Promise.resolve(() => {});
      }
      return tauriListen("pet-desktop-tray-command", (event) => handler(event.payload));
    },
    isTauriRuntime: Boolean(tauriInvoke)
  };
}

export function resolveSpritesheetSource(pet, tauriConvertFileSrc) {
  if (!pet) {
    return "";
  }
  const revision = pet.spritesheetRevision || pet.version || "";
  const appendRevision = (source) => {
    if (!source || !revision) {
      return source;
    }
    const separator = source.includes("?") ? "&" : "?";
    return `${source}${separator}spriteRevision=${encodeURIComponent(revision)}`;
  };
  if (typeof tauriConvertFileSrc === "function" && pet.spritesheetPath) {
    return appendRevision(tauriConvertFileSrc(pet.spritesheetPath));
  }
  return appendRevision(pet.spritesheetUrl || "");
}
