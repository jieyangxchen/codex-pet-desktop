import { createAnimation } from "./animation.js";
import { createDesktopBridge } from "./bridge.js";
import { getDomRefs, setElementText } from "./dom.js";
import { createImportFlow } from "./import-flow.js";
import { createInteractions } from "./interactions.js";
import { createPetManager } from "./pet-manager.js";
import { createStoreController } from "./store.js";
import { createUpdateController } from "./updates.js";
import { createWindowLayout } from "./window-layout.js";
import { cleanVersion } from "./version.js";

const dom = getDomRefs();
const { petDesktop, tauriConvertFileSrc, listenTrayCommand } = createDesktopBridge();
const state = {
  pets: [],
  activePet: null,
  pendingImport: null,
  preferences: {
    selectedPetId: "",
    scale: 0.6,
    petDirection: "right",
    autoWander: true,
    alwaysOnTop: true
  },
  appInfo: {
    version: "0.0.0",
    platform: "",
    downloadsUrl: "https://jieyangxchen.github.io/codex-pet-desktop/",
    latestReleaseApi: "https://api.github.com/repos/jieyangxchen/codex-pet-desktop/releases/latest",
    petpackIndexUrl: "https://jieyangxchen.github.io/codex-pet-desktop/petpacks/petpacks.json"
  }
};

function setPetStatus(message) {
  setElementText(dom.petStatusEl, message);
}

function setUpdateStatus(message) {
  setElementText(dom.updateStatusEl, message);
}

function currentPreferences(overrides = {}) {
  return {
    selectedPetId: state.activePet?.id || dom.petSelect.value || "",
    scale: Number(dom.scaleRange.value) || 0.6,
    petDirection: state.preferences.petDirection || "right",
    autoWander: Boolean(dom.wanderToggle.checked),
    alwaysOnTop: Boolean(dom.topToggle.checked),
    ...overrides
  };
}

function savePreferences(overrides = {}) {
  const preferences = currentPreferences(overrides);
  state.preferences = preferences;
  return petDesktop?.savePreferences?.(preferences)?.catch((error) => {
    setPetStatus(`保存设置失败：${error.message}`);
  });
}

function syncTrayState() {
  return petDesktop
    ?.updateTrayState?.({
      autoWander: Boolean(dom.wanderToggle.checked),
      alwaysOnTop: Boolean(dom.topToggle.checked)
    })
    ?.catch(() => {});
}

function applyPreferences(preferences) {
  state.preferences = { ...state.preferences, ...(preferences || {}) };
  dom.scaleRange.value = String(state.preferences.scale || 0.6);
  document.documentElement.style.setProperty("--scale", dom.scaleRange.value);
  applyPetDirection(state.preferences.petDirection);
  dom.wanderToggle.checked = state.preferences.autoWander !== false;
  dom.topToggle.checked = state.preferences.alwaysOnTop !== false;
}

function normalizedPetDirection(direction) {
  return direction === "left" ? "left" : "right";
}

function directionLabel(direction) {
  return direction === "left" ? "朝左" : "朝右";
}

function applyPetDirection(direction) {
  const nextDirection = normalizedPetDirection(direction);
  state.preferences.petDirection = nextDirection;
  animation.setDirection(nextDirection);
  dom.directionLeftButton?.classList.toggle("active", nextDirection === "left");
  dom.directionRightButton?.classList.toggle("active", nextDirection === "right");
}

function setPetDirection(direction) {
  const nextDirection = normalizedPetDirection(direction);
  applyPetDirection(nextDirection);
  setPetStatus(`已切换为${directionLabel(nextDirection)}。`);
  savePreferences({ petDirection: nextDirection });
}

const animation = createAnimation(dom);
const windowLayout = createWindowLayout({ dom, petDesktop, state });
const interactions = createInteractions({
  animation,
  dom,
  onLayoutChange: windowLayout.syncWindowLayout,
  petDesktop,
  state
});
const petManager = createPetManager({
  animation,
  dom,
  petDesktop,
  scheduleWander: interactions.scheduleWander,
  setPetStatus,
  state,
  stopWander: interactions.stopWander,
  syncWindowLayout: windowLayout.syncWindowLayout,
  tauriConvertFileSrc
});
const importFlow = createImportFlow({
  dom,
  petDesktop,
  refreshPetList: petManager.refreshPetList,
  setPanelVisible: interactions.setPanelVisible,
  setPetStatus,
  state
});
const store = createStoreController({
  dom,
  petDesktop,
  refreshPetList: petManager.refreshPetList,
  state
});
const updates = createUpdateController({ dom, petDesktop, setUpdateStatus, state });

function setPanelTab(tabId) {
  const tabs = [
    [dom.tabControl, dom.controlSection],
    [dom.tabStore, dom.storeSection],
    [dom.tabManager, dom.managerSection],
    [dom.tabUpdate, dom.updateSection]
  ];
  for (const [button, section] of tabs) {
    const active = section?.id === tabId;
    button?.classList.toggle("active", active);
    section?.classList.toggle("hidden", !active);
  }
}

function setWanderPaused(paused) {
  dom.wanderToggle.checked = !paused;
  if (paused) {
    interactions.stopWander();
    setPetStatus("已暂停自动散步。");
    savePreferences({ autoWander: false });
    syncTrayState();
    return;
  }
  if (interactions.hasActivePet()) {
    interactions.scheduleWander();
  }
  setPetStatus("已恢复自动散步。");
  savePreferences({ autoWander: true });
  syncTrayState();
}

async function openStorePanel() {
  interactions.setPanelVisible(true);
  setPanelTab("storeSection");
  await store.openStore();
}

async function handleTrayCommand(payload) {
  const command = typeof payload === "string" ? payload : payload?.command;
  if (command === "pause_wander") {
    setWanderPaused(true);
  } else if (command === "resume_wander") {
    setWanderPaused(false);
  } else if (command === "open_store") {
    await openStorePanel();
  }
}

async function init() {
  if (!petDesktop) {
    throw new Error("Desktop bridge is not available.");
  }

  animation.renderStateOptions();
  state.appInfo = { ...state.appInfo, ...((await petDesktop.getAppInfo?.()) || {}) };
  applyPreferences((await petDesktop.getPreferences?.()) || {});
  await windowLayout.syncWindowLayout();
  setUpdateStatus(`当前版本 v${cleanVersion(state.appInfo.version)}`);

  const windowState = await petDesktop.getWindowState();
  if (!state.preferences.alwaysOnTop && windowState.alwaysOnTop) {
    await petDesktop.setAlwaysOnTop(false);
  } else if (state.preferences.alwaysOnTop) {
    dom.topToggle.checked = Boolean(windowState.alwaysOnTop);
  }
  petManager.refreshPetList(await petDesktop.listPets(), state.preferences.selectedPetId);
  interactions.setMousePassthrough(true);

  interactions.bind({ pickPet: petManager.pickPet });
  importFlow.bind();
  store.bind();
  updates.bind();
  [
    dom.tabControl,
    dom.tabStore,
    dom.tabManager,
    dom.tabUpdate
  ].forEach((tab) => {
    tab?.addEventListener("click", () => {
      setPanelTab(tab.dataset.panelTab);
    });
  });
  dom.openStoreButton?.addEventListener("click", () => {
    openStorePanel();
  });
  dom.openStoreEmptyButton?.addEventListener("click", () => {
    openStorePanel();
  });
  dom.scaleRange.addEventListener("input", () => {
    windowLayout.syncWindowLayout().catch(() => {});
    savePreferences({ scale: Number(dom.scaleRange.value) || 0.6 });
  });
  [dom.directionLeftButton, dom.directionRightButton].forEach((button) => {
    button?.addEventListener("click", () => {
      setPetDirection(button.dataset.petDirection);
    });
  });
  dom.wanderToggle.addEventListener("change", () => {
    savePreferences({ autoWander: Boolean(dom.wanderToggle.checked) });
    syncTrayState();
  });
  dom.topToggle.addEventListener("change", () => {
    savePreferences({ alwaysOnTop: Boolean(dom.topToggle.checked) });
    syncTrayState();
  });
  dom.petSelect.addEventListener("change", () => {
    savePreferences({ selectedPetId: dom.petSelect.value });
  });
  listenTrayCommand?.((payload) => {
    handleTrayCommand(payload).catch((error) => setPetStatus(error.message));
  });
  dom.quitButton.addEventListener("click", () => {
    petDesktop?.quit();
  });

  requestAnimationFrame(animation.animationLoop);
  requestAnimationFrame(interactions.wanderLoop);
  if (interactions.hasActivePet()) {
    interactions.scheduleWander();
  } else {
    await openStorePanel();
  }
  syncTrayState();
}

init().catch((error) => {
  dom.petEl.textContent = error.message;
});
