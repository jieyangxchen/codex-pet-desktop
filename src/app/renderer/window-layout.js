import { CELL_HEIGHT, CELL_WIDTH } from "./constants.js";

const MIN_PET_WINDOW_WIDTH = 180;
const MIN_PET_WINDOW_HEIGHT = 200;
const MAX_PET_WINDOW_WIDTH = 460;
const MAX_PET_WINDOW_HEIGHT = 520;
const PET_PADDING_X = 72;
const PET_PADDING_Y = 76;
const PANEL_WIDTH = 300;
const PANEL_GAP = 20;
const PANEL_PADDING_X = 48;
const MAX_PANEL_WITH_PET_WINDOW_WIDTH = 760;
const EMPTY_WINDOW = { width: 320, height: 300 };
const PANEL_WINDOW = { width: 350, height: 440 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizedScale(scale) {
  const value = Number(scale);
  if (!Number.isFinite(value) || value <= 0) {
    return 0.6;
  }
  return clamp(value, 0.4, 2.2);
}

export function desiredWindowSize({ scale = 0.6, hasPet = false, panelVisible = false } = {}) {
  if (panelVisible) {
    if (hasPet) {
      const safeScale = normalizedScale(scale);
      return {
        width: clamp(
          Math.ceil(PANEL_WIDTH + PANEL_GAP + CELL_WIDTH * safeScale + PANEL_PADDING_X),
          520,
          MAX_PANEL_WITH_PET_WINDOW_WIDTH
        ),
        height: clamp(
          Math.ceil(Math.max(PANEL_WINDOW.height, CELL_HEIGHT * safeScale + PET_PADDING_Y)),
          PANEL_WINDOW.height,
          MAX_PET_WINDOW_HEIGHT
        )
      };
    }
    return PANEL_WINDOW;
  }
  if (!hasPet) {
    return EMPTY_WINDOW;
  }
  const safeScale = normalizedScale(scale);
  return {
    width: clamp(Math.ceil(CELL_WIDTH * safeScale + PET_PADDING_X), MIN_PET_WINDOW_WIDTH, MAX_PET_WINDOW_WIDTH),
    height: clamp(Math.ceil(CELL_HEIGHT * safeScale + PET_PADDING_Y), MIN_PET_WINDOW_HEIGHT, MAX_PET_WINDOW_HEIGHT)
  };
}

export function createWindowLayout({ dom, petDesktop, state }) {
  let lastSignature = "";
  let lastPetAnchor = null;

  function hasPet() {
    return Boolean(state.activePet && state.pets.some((pet) => pet.id === state.activePet.id));
  }

  function panelVisible() {
    return !dom.panelEl.classList.contains("hidden");
  }

  function petAnchor(size, visiblePanel) {
    if (!hasPet()) {
      return null;
    }
    return {
      x: size.width / 2 + (visiblePanel ? (PANEL_WIDTH + PANEL_GAP) / 2 : 0),
      y: size.height / 2 + CELL_HEIGHT / 2
    };
  }

  async function syncWindowLayout({ centerIfEmpty = false, panelVisibleOverride } = {}) {
    if (!petDesktop?.resizeWindow) {
      return;
    }
    const visiblePanel = typeof panelVisibleOverride === "boolean" ? panelVisibleOverride : panelVisible();
    const size = desiredWindowSize({
      scale: Number(dom.scaleRange.value) || state.preferences.scale || 0.6,
      hasPet: hasPet(),
      panelVisible: visiblePanel
    });
    const hasActivePet = hasPet();
    const nextPetAnchor = petAnchor(size, visiblePanel);
    const signature = `${size.width}x${size.height}:${hasActivePet ? "pet" : "empty"}:${visiblePanel ? "panel" : "plain"}`;
    if (signature === lastSignature) {
      if (centerIfEmpty && !hasPet()) {
        await petDesktop.centerPosition?.();
      }
      return;
    }
    lastSignature = signature;
    const anchor = lastPetAnchor && nextPetAnchor ? { current: lastPetAnchor, next: nextPetAnchor } : undefined;
    await petDesktop.resizeWindow(size.width, size.height, anchor);
    lastPetAnchor = nextPetAnchor;
    if (centerIfEmpty && !hasPet()) {
      await petDesktop.centerPosition?.();
    }
  }

  return {
    syncWindowLayout
  };
}
