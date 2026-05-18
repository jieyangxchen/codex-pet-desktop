import { CELL_HEIGHT, CELL_WIDTH, STATES, STATE_LABELS } from "./constants.js";

export function createAnimation(dom) {
  let stateName = "idle";
  let manualDirection = "right";
  let frame = 0;
  let lastFrameAt = 0;
  let onceReturnState = "idle";

  function normalizedDirection(direction) {
    return direction === "left" ? "left" : "right";
  }

  function applyDirection() {
    const scale = stateName === "running-left" || stateName === "running-right"
      ? 1
      : normalizedDirection(manualDirection) === "left"
        ? -1
        : 1;
    dom.petEl.style.setProperty("--direction-scale", String(scale));
  }

  function setFrame() {
    const state = STATES[stateName] || STATES.idle;
    const x = -(frame % state.frames) * CELL_WIDTH;
    const y = -state.row * CELL_HEIGHT;
    dom.petEl.style.backgroundPosition = `${x}px ${y}px`;
  }

  function setState(nextState, { onceReturn = "idle" } = {}) {
    if (!STATES[nextState]) {
      return;
    }
    stateName = nextState;
    frame = 0;
    lastFrameAt = 0;
    onceReturnState = onceReturn;
    dom.stateSelect.value = nextState;
    applyDirection();
    setFrame();
  }

  function setDirection(direction) {
    manualDirection = normalizedDirection(direction);
    applyDirection();
  }

  function renderStateOptions() {
    dom.stateSelect.replaceChildren(
      ...Object.keys(STATES).map((state) => {
        const option = document.createElement("option");
        option.value = state;
        option.textContent = STATE_LABELS[state] || state;
        return option;
      })
    );
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

  return {
    animationLoop,
    renderStateOptions,
    setDirection,
    setState
  };
}
