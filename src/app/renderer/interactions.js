import { STATES } from "./constants.js";

export function createInteractions({ animation, dom, onLayoutChange = () => {}, petDesktop, state }) {
  let dragging = false;
  let pointerInsideInteractiveArea = false;
  let dragLastScreenX = 0;
  let dragLastScreenY = 0;
  let movedDuringDrag = false;
  let suppressNextClick = false;
  let wanderTimer = 0;
  let wanderDirection = 0;
  let wanderUntil = 0;
  let lastQuietState = "";
  let edgePaused = false;
  let preferredNextDirection = 0;
  let mousePassthrough = null;
  const defaultNaturalBehavior = {
    nextWanderDelayMs: [3500, 8000],
    idleDurationMs: [1600, 3200],
    walkDurationMs: [2400, 5200],
    edgePauseMs: [700, 1600],
    edgePauseStates: ["waiting", "review"],
    postDragState: "waiting",
    postDragMs: 700,
    clickReturnState: "idle",
    doubleClickReturnState: "idle"
  };
  const defaultBehavior = {
    clickState: "waving",
    doubleClickState: "jumping",
    idleStates: ["review", "waiting", "idle"],
    wanderDirections: [-1, 1, 0],
    natural: defaultNaturalBehavior
  };

  function hasActivePet() {
    return Boolean(state.activePet && state.pets.some((pet) => pet.id === state.activePet.id));
  }

  function activeBehavior() {
    const behavior = state.activePet?.behavior || {};
    const natural = behavior.natural || {};
    const validStates = (states) => states.filter((name) => STATES[name]);
    const idleStates = Array.isArray(behavior.idleStates) ? validStates(behavior.idleStates) : [];
    const edgePauseStates = Array.isArray(natural.edgePauseStates) ? validStates(natural.edgePauseStates) : [];
    const wanderDirections = Array.isArray(behavior.wanderDirections)
      ? behavior.wanderDirections.filter((direction) => [-1, 0, 1].includes(direction))
      : [];
    return {
      clickState: STATES[behavior.clickState] ? behavior.clickState : defaultBehavior.clickState,
      doubleClickState: STATES[behavior.doubleClickState] ? behavior.doubleClickState : defaultBehavior.doubleClickState,
      idleStates: idleStates.length ? idleStates : defaultBehavior.idleStates,
      wanderDirections: wanderDirections.length ? wanderDirections : defaultBehavior.wanderDirections,
      natural: {
        nextWanderDelayMs: readDurationRange(natural.nextWanderDelayMs, defaultNaturalBehavior.nextWanderDelayMs),
        idleDurationMs: readDurationRange(natural.idleDurationMs, defaultNaturalBehavior.idleDurationMs),
        walkDurationMs: readDurationRange(natural.walkDurationMs, defaultNaturalBehavior.walkDurationMs),
        edgePauseMs: readDurationRange(natural.edgePauseMs, defaultNaturalBehavior.edgePauseMs),
        edgePauseStates: edgePauseStates.length ? edgePauseStates : defaultNaturalBehavior.edgePauseStates,
        postDragState: STATES[natural.postDragState] ? natural.postDragState : defaultNaturalBehavior.postDragState,
        postDragMs: readDurationRange(natural.postDragMs, [defaultNaturalBehavior.postDragMs, defaultNaturalBehavior.postDragMs])[0],
        clickReturnState: STATES[natural.clickReturnState] ? natural.clickReturnState : defaultNaturalBehavior.clickReturnState,
        doubleClickReturnState: STATES[natural.doubleClickReturnState]
          ? natural.doubleClickReturnState
          : defaultNaturalBehavior.doubleClickReturnState
      }
    };
  }

  function readDurationRange(value, fallback) {
    if (Array.isArray(value) && value.length >= 2) {
      const first = Number(value[0]);
      const second = Number(value[1]);
      if (Number.isFinite(first) && Number.isFinite(second) && first >= 0 && second >= 0) {
        return [Math.min(first, second), Math.max(first, second)];
      }
    }
    const single = Number(value);
    if (Number.isFinite(single) && single >= 0) {
      return [single, single];
    }
    return fallback;
  }

  function randomDuration(range) {
    const [min, max] = range;
    return min + Math.random() * (max - min);
  }

  function pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function pickQuietState(behavior) {
    const candidates =
      behavior.idleStates.length > 1
        ? behavior.idleStates.filter((stateName) => stateName !== lastQuietState)
        : behavior.idleStates;
    const nextState = pick(candidates.length ? candidates : behavior.idleStates);
    lastQuietState = nextState;
    return nextState;
  }

  function isWindowsRuntime() {
    const platform = state.appInfo.platform || globalThis.navigator?.platform || "";
    return /win/i.test(platform);
  }

  function setMousePassthrough(ignored) {
    const nextIgnored = isWindowsRuntime() ? false : Boolean(ignored);
    if (mousePassthrough === nextIgnored) {
      return;
    }
    mousePassthrough = nextIgnored;
    petDesktop?.setIgnoreMouseEvents(nextIgnored);
  }

  function isInteractiveTarget(target) {
    return Boolean(target?.closest?.("#pet, #emptyState, #panel, #panelBackdrop"));
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
    edgePaused = false;
    preferredNextDirection = 0;
    window.clearTimeout(wanderTimer);
  }

  function scheduleWander(delayOverride) {
    window.clearTimeout(wanderTimer);
    if (!hasActivePet()) {
      wanderDirection = 0;
      wanderUntil = 0;
      edgePaused = false;
      preferredNextDirection = 0;
      return;
    }
    const behavior = activeBehavior();
    const delay = Number.isFinite(delayOverride)
      ? delayOverride
      : randomDuration(behavior.natural.nextWanderDelayMs);
    wanderTimer = window.setTimeout(() => {
      if (
        !hasActivePet() ||
        !dom.wanderToggle.checked ||
        dragging ||
        dom.panelEl.classList.contains("hidden") === false
      ) {
        scheduleWander();
        return;
      }
      const directions = behavior.wanderDirections;
      wanderDirection = directions.includes(preferredNextDirection)
        ? preferredNextDirection
        : pick(directions);
      preferredNextDirection = 0;
      edgePaused = false;
      wanderUntil =
        performance.now() +
        randomDuration(wanderDirection === 0 ? behavior.natural.idleDurationMs : behavior.natural.walkDurationMs);
      if (wanderDirection < 0) {
        animation.setState("running-left");
      } else if (wanderDirection > 0) {
        animation.setState("running-right");
      } else {
        animation.setState(pickQuietState(behavior));
      }
    }, delay);
  }

  function wanderLoop(now) {
    if (
      hasActivePet() &&
      wanderDirection !== 0 &&
      now < wanderUntil &&
      dom.wanderToggle.checked &&
      !dragging
    ) {
      petDesktop?.moveBy(wanderDirection * 2, 0)?.then((bounds) => {
        if (bounds?.hitEdge === "left") {
          const behavior = activeBehavior();
          wanderDirection = 0;
          preferredNextDirection = 1;
          edgePaused = true;
          wanderUntil = performance.now() + randomDuration(behavior.natural.edgePauseMs);
          animation.setState(pick(behavior.natural.edgePauseStates));
        } else if (bounds?.hitEdge === "right") {
          const behavior = activeBehavior();
          wanderDirection = 0;
          preferredNextDirection = -1;
          edgePaused = true;
          wanderUntil = performance.now() + randomDuration(behavior.natural.edgePauseMs);
          animation.setState(pick(behavior.natural.edgePauseStates));
        }
      });
    }
    if (wanderUntil && now >= wanderUntil) {
      wanderDirection = 0;
      wanderUntil = 0;
      animation.setState(edgePaused ? "idle" : pickQuietState(activeBehavior()));
      edgePaused = false;
      scheduleWander();
    }
    requestAnimationFrame(wanderLoop);
  }

  function setPanelVisible(show) {
    dom.panelEl.classList.toggle("hidden", !show);
    dom.panelBackdropEl.classList.toggle("hidden", !show);
    dom.emptyStateEl.classList.toggle("hidden", show || hasActivePet());
    setMousePassthrough(false);
    onLayoutChange({ centerIfEmpty: !show && !hasActivePet() }).catch?.(() => {});
  }

  function togglePanel(show = dom.panelEl.classList.contains("hidden")) {
    setPanelVisible(show);
  }

  function bind({ pickPet }) {
    dom.petEl.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      stopWander();
      dragging = true;
      movedDuringDrag = false;
      pointerInsideInteractiveArea = true;
      dragLastScreenX = event.screenX;
      dragLastScreenY = event.screenY;
      setMousePassthrough(false);
      dom.petEl.setPointerCapture?.(event.pointerId);
    });

    dom.petEl.addEventListener("pointermove", (event) => {
      if (!dragging) {
        return;
      }
      const deltaX = event.screenX - dragLastScreenX;
      const deltaY = event.screenY - dragLastScreenY;
      dragLastScreenX = event.screenX;
      dragLastScreenY = event.screenY;
      if (deltaX || deltaY) {
        movedDuringDrag = true;
        petDesktop?.moveBy(deltaX, deltaY);
      }
    });

    function finishDrag(event) {
      if (!dragging) {
        return;
      }
      dragging = false;
      dom.petEl.releasePointerCapture?.(event.pointerId);
      if (movedDuringDrag && hasActivePet()) {
        const behavior = activeBehavior();
        suppressNextClick = true;
        animation.setState(behavior.natural.postDragState);
        scheduleWander(behavior.natural.postDragMs);
      } else {
        scheduleWander();
      }
      movedDuringDrag = false;
    }

    dom.petEl.addEventListener("pointerup", finishDrag);
    dom.petEl.addEventListener("pointercancel", finishDrag);
    dom.petEl.addEventListener("lostpointercapture", () => {
      if (dragging) {
        dragging = false;
        movedDuringDrag = false;
        scheduleWander();
      }
    });
    dom.petEl.addEventListener("click", () => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (!dragging && dom.panelEl.classList.contains("hidden")) {
        const behavior = activeBehavior();
        animation.setState(behavior.clickState, { onceReturn: behavior.natural.clickReturnState });
      }
    });
    dom.petEl.addEventListener("dblclick", () => {
      const behavior = activeBehavior();
      animation.setState(behavior.doubleClickState, { onceReturn: behavior.natural.doubleClickReturnState });
    });

    document.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (!state.pets.length) {
        return;
      }
      if (dom.panelEl.contains(event.target)) {
        return;
      }
      togglePanel();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!dragging && !dom.panelEl.classList.contains("hidden") && !isInteractiveTarget(event.target)) {
        setPanelVisible(false);
        pointerInsideInteractiveArea = false;
        setMousePassthrough(hasActivePet());
      }
    });
    window.addEventListener("blur", () => {
      if (!dragging) {
        pointerInsideInteractiveArea = false;
        setMousePassthrough(false);
      }
    });
    document.addEventListener("mousemove", updateMousePassthrough);
    document.addEventListener("mouseleave", () => {
      if (!dragging && dom.panelEl.classList.contains("hidden")) {
        pointerInsideInteractiveArea = false;
        setMousePassthrough(hasActivePet());
      }
    });

    dom.panelEl.addEventListener("pointerenter", () => setMousePassthrough(false));
    dom.emptyStateEl.addEventListener("pointerenter", () => setMousePassthrough(false));
    dom.panelEl.addEventListener("pointerleave", () => {
      if (!dragging) {
        pointerInsideInteractiveArea = false;
        setMousePassthrough(false);
      }
    });
    dom.emptyStateEl.addEventListener("pointerleave", () => {
      if (!dragging) {
        pointerInsideInteractiveArea = false;
        setMousePassthrough(false);
      }
    });

    dom.petSelect.addEventListener("change", () => pickPet(dom.petSelect.value));
    dom.stateSelect.addEventListener("change", () => animation.setState(dom.stateSelect.value));
    dom.scaleRange.addEventListener("input", () => {
      document.documentElement.style.setProperty("--scale", dom.scaleRange.value);
      onLayoutChange().catch?.(() => {});
    });
    dom.topToggle.addEventListener("change", () => {
      petDesktop?.setAlwaysOnTop(dom.topToggle.checked);
    });
  }

  return {
    bind,
    hasActivePet,
    scheduleWander,
    setMousePassthrough,
    setPanelVisible,
    stopWander,
    wanderLoop
  };
}
