export function getDomRefs() {
  return {
    petEl: document.querySelector("#pet"),
    emptyStateEl: document.querySelector("#emptyState"),
    panelEl: document.querySelector("#panel"),
    panelBackdropEl: document.querySelector("#panelBackdrop"),
    closePanelButton: document.querySelector("#closePanelButton"),
    petSelect: document.querySelector("#petSelect"),
    stateSelect: document.querySelector("#stateSelect"),
    scaleRange: document.querySelector("#scaleRange"),
    directionLeftButton: document.querySelector("#directionLeftButton"),
    directionRightButton: document.querySelector("#directionRightButton"),
    wanderToggle: document.querySelector("#wanderToggle"),
    topToggle: document.querySelector("#topToggle"),
    tabControl: document.querySelector("#tabControl"),
    tabStore: document.querySelector("#tabStore"),
    tabManager: document.querySelector("#tabManager"),
    tabUpdate: document.querySelector("#tabUpdate"),
    controlSection: document.querySelector("#controlSection"),
    storeSection: document.querySelector("#storeSection"),
    managerSection: document.querySelector("#managerSection"),
    updateSection: document.querySelector("#updateSection"),
    importButton: document.querySelector("#importButton"),
    importEmptyButton: document.querySelector("#importEmptyButton"),
    openStoreEmptyButton: document.querySelector("#openStoreEmptyButton"),
    petpackInput: document.querySelector("#petpackInput"),
    importPreviewEl: document.querySelector("#importPreview"),
    importPreviewTextEl: document.querySelector("#importPreviewText"),
    confirmImportButton: document.querySelector("#confirmImportButton"),
    cancelImportButton: document.querySelector("#cancelImportButton"),
    petManagerEl: document.querySelector("#petManager"),
    petStatusEl: document.querySelector("#petStatus"),
    checkUpdateButton: document.querySelector("#checkUpdateButton"),
    checkPetpackUpdatesButton: document.querySelector("#checkPetpackUpdatesButton"),
    openDownloadsButton: document.querySelector("#openDownloadsButton"),
    openStoreButton: document.querySelector("#openStoreButton"),
    updateStatusEl: document.querySelector("#updateStatus"),
    appUpdateProgressEl: document.querySelector("#appUpdateProgress"),
    petStoreEl: document.querySelector("#storeSection"),
    storeSearch: document.querySelector("#storeSearch"),
    storeTagFilter: document.querySelector("#storeTagFilter"),
    storeFilter: document.querySelector("#storeFilter"),
    updateAllPetpacksButton: document.querySelector("#updateAllPetpacksButton"),
    refreshStoreButton: document.querySelector("#refreshStoreButton"),
    petStoreStatusEl: document.querySelector("#petStoreStatus"),
    petStoreProgressEl: document.querySelector("#petStoreProgress"),
    petStoreListEl: document.querySelector("#petStoreList"),
    quitButton: document.querySelector("#quitButton")
  };
}

export function setElementText(element, message) {
  if (element) {
    element.textContent = message || "";
  }
}
