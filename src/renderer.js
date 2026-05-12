const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const STATES = {
  idle: { row: 0, frames: 6, fps: 5 },
  "running-right": { row: 1, frames: 8, fps: 10 },
  "running-left": { row: 2, frames: 8, fps: 10 },
  waving: { row: 3, frames: 4, fps: 6, once: true },
  jumping: { row: 4, frames: 5, fps: 8, once: true },
  failed: { row: 5, frames: 8, fps: 6, once: true },
  waiting: { row: 6, frames: 6, fps: 5 },
  running: { row: 7, frames: 6, fps: 7 },
  review: { row: 8, frames: 6, fps: 6 }
};

const petEl = document.querySelector("#pet");
const panelEl = document.querySelector("#panel");
const panelBackdropEl = document.querySelector("#panelBackdrop");
const petSelect = document.querySelector("#petSelect");
const stateSelect = document.querySelector("#stateSelect");
const scaleRange = document.querySelector("#scaleRange");
const wanderToggle = document.querySelector("#wanderToggle");
const topToggle = document.querySelector("#topToggle");
const quitButton = document.querySelector("#quitButton");

const tauriInvoke = window.__TAURI__?.core?.invoke;
const tauriConvertFileSrc = window.__TAURI__?.core?.convertFileSrc;
const petDesktop =
  window.petDesktop ||
  (tauriInvoke
    ? {
        listPets: () => tauriInvoke("list_pets"),
        moveBy: (x, y) => tauriInvoke("move_by", { x, y }),
        setIgnoreMouseEvents: (ignored) => tauriInvoke("set_ignore_mouse_events", { ignored }),
        resetPosition: () => tauriInvoke("reset_position"),
        setAlwaysOnTop: (value) => tauriInvoke("set_always_on_top", { value }),
        getWindowState: () => tauriInvoke("get_window_state"),
        quit: () => tauriInvoke("quit")
      }
    : null);
const isTauriRuntime = Boolean(tauriInvoke);

function resolveSpritesheetSource(pet) {
  if (!pet) {
    return "";
  }
  if (typeof tauriConvertFileSrc === "function" && pet.spritesheetPath) {
    return tauriConvertFileSrc(pet.spritesheetPath);
  }
  return pet.spritesheetUrl || "";
}

let pets = [];
let activePet = null;
let stateName = "idle";
let frame = 0;
let lastFrameAt = 0;
let onceReturnState = "idle";
let dragging = false;
let pointerInsideInteractiveArea = false;
let dragLastScreenX = 0;
let dragLastScreenY = 0;
let wanderTimer = 0;
let wanderDirection = 0;
let wanderUntil = 0;

function setMousePassthrough(ignored) {
  if (isTauriRuntime) {
    return;
  }
  petDesktop?.setIgnoreMouseEvents(ignored);
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.("#pet, #panel, #panelBackdrop"));
}

function updateMousePassthrough(event) {
  const shouldReceiveMouse = dragging || isInteractiveTarget(event.target);
  if (pointerInsideInteractiveArea === shouldReceiveMouse) {
    return;
  }
  pointerInsideInteractiveArea = shouldReceiveMouse;
  setMousePassthrough(!shouldReceiveMouse);
}

function stopWander() {
  wanderDirection = 0;
  wanderUntil = 0;
  window.clearTimeout(wanderTimer);
}

function setFrame() {
  const state = STATES[stateName] || STATES.idle;
  const x = -(frame % state.frames) * CELL_WIDTH;
  const y = -state.row * CELL_HEIGHT;
  petEl.style.backgroundPosition = `${x}px ${y}px`;
}

function setState(nextState, { onceReturn = "idle" } = {}) {
  if (!STATES[nextState]) {
    return;
  }
  stateName = nextState;
  frame = 0;
  lastFrameAt = 0;
  onceReturnState = onceReturn;
  stateSelect.value = nextState;
  setFrame();
}

function animationLoop(now) {
  const state = STATES[stateName] || STATES.idle;
  const delay = 1000 / state.fps;
  if (!lastFrameAt || now - lastFrameAt >= delay) {
    frame += 1;
    if (frame >= state.frames) {
      if (state.once) {
        setState(onceReturnState);
      } else {
        frame = 0;
      }
    }
    setFrame();
    lastFrameAt = now;
  }
  requestAnimationFrame(animationLoop);
}

function pickPet(id) {
  activePet = pets.find((pet) => pet.id === id) || pets[0];
  if (!activePet) {
    petEl.style.backgroundImage = "";
    petEl.setAttribute("aria-label", "No pet found");
    petEl.textContent = "No pet resource";
    return;
  }
  const source = resolveSpritesheetSource(activePet);
  petEl.style.backgroundImage = source ? `url("${source}")` : "";
  petEl.textContent = "";
  petEl.setAttribute("aria-label", activePet.displayName);
  petSelect.value = activePet.id;
  setState("idle");
}

function renderPetOptions() {
  petSelect.replaceChildren(
    ...pets.map((pet) => {
      const option = document.createElement("option");
      option.value = pet.id;
      option.textContent = pet.displayName;
      return option;
    })
  );
}

function renderStateOptions() {
  stateSelect.replaceChildren(
    ...Object.keys(STATES).map((state) => {
      const option = document.createElement("option");
      option.value = state;
      option.textContent = state;
      return option;
    })
  );
}

function scheduleWander() {
  window.clearTimeout(wanderTimer);
  wanderTimer = window.setTimeout(() => {
    if (!wanderToggle.checked || dragging || panelEl.classList.contains("hidden") === false) {
      scheduleWander();
      return;
    }
    const directions = [-1, 1, 0];
    wanderDirection = directions[Math.floor(Math.random() * directions.length)];
    wanderUntil = performance.now() + (wanderDirection === 0 ? 1800 : 3200);
    if (wanderDirection < 0) {
      setState("running-left");
    } else if (wanderDirection > 0) {
      setState("running-right");
    } else {
      setState("waiting");
    }
  }, 3500 + Math.random() * 4500);
}

function wanderLoop(now) {
  if (wanderDirection !== 0 && now < wanderUntil && wanderToggle.checked && !dragging) {
    petDesktop?.moveBy(wanderDirection * 2, 0);
  }
  if (wanderUntil && now >= wanderUntil) {
    wanderDirection = 0;
    wanderUntil = 0;
    setState("idle");
    scheduleWander();
  }
  requestAnimationFrame(wanderLoop);
}

function setPanelVisible(show) {
  panelEl.classList.toggle("hidden", !show);
  panelBackdropEl.classList.toggle("hidden", !show);
  setMousePassthrough(false);
}

function togglePanel(show = panelEl.classList.contains("hidden")) {
  setPanelVisible(show);
}

petEl.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }
  stopWander();
  dragging = true;
  pointerInsideInteractiveArea = true;
  dragLastScreenX = event.screenX;
  dragLastScreenY = event.screenY;
  setMousePassthrough(false);
  petEl.setPointerCapture?.(event.pointerId);
});

petEl.addEventListener("pointermove", (event) => {
  if (!dragging) {
    return;
  }
  const deltaX = event.screenX - dragLastScreenX;
  const deltaY = event.screenY - dragLastScreenY;
  dragLastScreenX = event.screenX;
  dragLastScreenY = event.screenY;
  if (deltaX || deltaY) {
    petDesktop?.moveBy(deltaX, deltaY);
  }
});

function finishDrag(event) {
  if (!dragging) {
    return;
  }
  dragging = false;
  petEl.releasePointerCapture?.(event.pointerId);
  scheduleWander();
}

petEl.addEventListener("pointerup", finishDrag);
petEl.addEventListener("pointercancel", finishDrag);
petEl.addEventListener("lostpointercapture", () => {
  if (dragging) {
    dragging = false;
    scheduleWander();
  }
});

petEl.addEventListener("click", () => {
  if (!dragging && panelEl.classList.contains("hidden")) {
    setState("waving");
  }
});

petEl.addEventListener("dblclick", () => {
  setState("jumping");
});

document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (panelEl.contains(event.target)) {
    return;
  }
  togglePanel();
});

document.addEventListener("pointerdown", (event) => {
  if (!dragging && !panelEl.classList.contains("hidden") && !isInteractiveTarget(event.target)) {
    setPanelVisible(false);
    pointerInsideInteractiveArea = false;
    setMousePassthrough(true);
  }
});

window.addEventListener("blur", () => {
  if (!dragging) {
    setPanelVisible(false);
    pointerInsideInteractiveArea = false;
    setMousePassthrough(true);
  }
});

document.addEventListener("mousemove", updateMousePassthrough);
document.addEventListener("mouseleave", () => {
  if (!dragging && panelEl.classList.contains("hidden")) {
    pointerInsideInteractiveArea = false;
    setMousePassthrough(true);
  }
});

panelEl.addEventListener("pointerenter", () => setMousePassthrough(false));
panelEl.addEventListener("pointerleave", () => {
  if (!dragging) {
    pointerInsideInteractiveArea = false;
    setMousePassthrough(true);
  }
});

petSelect.addEventListener("change", () => pickPet(petSelect.value));
stateSelect.addEventListener("change", () => setState(stateSelect.value));
scaleRange.addEventListener("input", () => {
  document.documentElement.style.setProperty("--scale", scaleRange.value);
});
topToggle.addEventListener("change", () => {
  petDesktop?.setAlwaysOnTop(topToggle.checked);
});
quitButton.addEventListener("click", () => {
  petDesktop?.quit();
});

async function init() {
  if (!petDesktop) {
    throw new Error("Desktop bridge is not available.");
  }
  renderStateOptions();
  const windowState = await petDesktop.getWindowState();
  topToggle.checked = Boolean(windowState.alwaysOnTop);
  const result = await petDesktop.listPets();
  pets = result.pets;
  if (!pets.length) {
    throw new Error("No bundled pet found. Please reinstall or import pet resources.");
  }
  renderPetOptions();
  pickPet(pets[0]?.id);
  setMousePassthrough(true);
  requestAnimationFrame(animationLoop);
  requestAnimationFrame(wanderLoop);
  scheduleWander();
}

init().catch((error) => {
  petEl.textContent = error.message;
});
