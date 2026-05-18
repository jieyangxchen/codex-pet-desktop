import {
  friendlyPetpackError,
  importConfirmLabel,
  importPreviewMessage,
  readFileAsBase64
} from "./petpack.js";

export function createImportFlow({
  dom,
  petDesktop,
  refreshPetList,
  setPanelVisible,
  setPetStatus,
  state
}) {
  function clearImportPreview() {
    state.pendingImport = null;
    dom.petpackInput.value = "";
    dom.importPreviewEl?.classList.add("hidden");
    if (dom.importPreviewTextEl) {
      dom.importPreviewTextEl.textContent = "";
    }
    if (dom.confirmImportButton) {
      dom.confirmImportButton.disabled = false;
    }
  }

  function showImportPreview(data, preview) {
    state.pendingImport = { data, preview };
    if (dom.importPreviewTextEl) {
      dom.importPreviewTextEl.textContent = importPreviewMessage(preview);
    }
    if (dom.confirmImportButton) {
      dom.confirmImportButton.textContent = importConfirmLabel(preview);
      dom.confirmImportButton.disabled = preview.compatible === false;
    }
    dom.importPreviewEl?.classList.remove("hidden");
  }

  async function prepareSelectedPetpack(file) {
    if (!file) {
      return;
    }
    const data = await readFileAsBase64(file);
    const preview = await petDesktop.inspectPetpack(data);
    showImportPreview(data, preview);
    setPetStatus(importPreviewMessage(preview));
    setPanelVisible(true);
  }

  async function confirmPendingImport() {
    if (!state.pendingImport) {
      return;
    }
    dom.confirmImportButton.disabled = true;
    try {
      const result = await petDesktop.importPetpack(state.pendingImport.data);
      refreshPetList(result.pets, result.importedPetId);
      if (result.replaced) {
        setPetStatus(
          `已覆盖 ${result.displayName || result.importedPetId}: ${
            result.previousVersion || "未知"
          } -> ${result.version || "未知"}`
        );
      } else {
        setPetStatus(`已导入 ${result.displayName || result.importedPetId} ${result.version || ""}`.trim());
      }
      clearImportPreview();
      setPanelVisible(false);
    } finally {
      dom.confirmImportButton.disabled = false;
    }
  }

  function openPetpackPicker() {
    clearImportPreview();
    dom.petpackInput.click();
  }

  function bind() {
    dom.importButton.addEventListener("click", openPetpackPicker);
    dom.importEmptyButton.addEventListener("click", openPetpackPicker);
    dom.confirmImportButton?.addEventListener("click", () => {
      confirmPendingImport().catch((error) => setPetStatus(friendlyPetpackError(error)));
    });
    dom.cancelImportButton?.addEventListener("click", () => {
      clearImportPreview();
      if (!state.pets.length) {
        setPanelVisible(false);
      }
      setPetStatus("已取消导入。");
    });
    dom.petpackInput.addEventListener("change", () => {
      prepareSelectedPetpack(dom.petpackInput.files?.[0]).catch((error) => {
        const friendly = friendlyPetpackError(error);
        if (!state.pets.length) {
          setPanelVisible(false);
          dom.emptyStateEl.classList.remove("hidden");
          dom.emptyStateEl.querySelector("span").textContent = friendly;
        }
        setPetStatus(friendly);
        clearImportPreview();
      });
    });
  }

  return {
    bind,
    clearImportPreview,
    confirmPendingImport,
    prepareSelectedPetpack
  };
}
