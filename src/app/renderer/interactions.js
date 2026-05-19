import { activeBehavior, createLifeEngine } from "./life-engine.js";

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
  const lifeEngine = createLifeEngine({
    behavior: state.activePet?.behavior,
    preferences: state.preferences
  });

  function hasActivePet() {
    return Boolean(state.activePet && state.pets.some((pet) => pet.id === state.activePet.id));
  }

  function refreshLifeEngine() {
    const behavior = state.activePet?.behavior || {};
    lifeEngine.update({
      behavior,
      preferences: state.preferences || {}
    });
    return activeBehavior(behavior);
  }

  function naturalLifeEnabled() {
    return state.preferences?.naturalLife !== false;
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

  function legacyWanderPlan(behavior) {
    const directions = behavior.wanderDirections;
    const direction = directions.includes(preferredNextDirection)
      ? preferredNextDirection
      : pick(directions);
    const stateName = direction < 0 ? "running-left" : direction > 0 ? "running-right" : pickQuietState(behavior);
    return {
      direction,
      durationMs: randomDuration(direction === 0 ? behavior.natural.idleDurationMs : behavior.natural.walkDurationMs),
      state: stateName
    };
  }

  function applyWanderPlan(plan) {
    if (!plan) {
      return false;
    }
    wanderDirection = plan.direction || 0;
    preferredNextDirection = 0;
    edgePaused = false;
    wanderUntil = performance.now() + plan.durationMs;
    animation.setState(plan.state, plan.onceReturn ? { onceReturn: plan.onceReturn } : undefined);
    return true;
  }

  function preferEdgeRecoveryDirection(plan, behavior) {
    if (!plan || !preferredNextDirection) {
      return plan;
    }
    const phase = lifeEngine.phase();
    const directions = phase?.wanderDirections || behavior.wanderDirections;
    if (!directions.includes(preferredNextDirection)) {
      return plan;
    }
    return {
      ...plan,
      direction: preferredNextDirection,
      durationMs: randomDuration(phase?.walkDurationMs || behavior.natural.walkDurationMs),
      state: preferredNextDirection < 0 ? "running-left" : "running-right"
    };
  }

  function panelOpen() {
    return dom.panelEl.classList.contains("hidden") === false;
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
    return Boolean(target?.closest?.("#pet, #emptyState, #panel"));
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
    const behavior = refreshLifeEngine();
    const autonomousPlan = naturalLifeEnabled()
      ? lifeEngine.planAutonomous({
          autoWander: Boolean(dom.wanderToggle.checked),
          dragging,
          panelOpen: panelOpen()
        })
      : null;
    const delay = Number.isFinite(delayOverride)
      ? delayOverride
      : autonomousPlan?.nextDelayMs ?? randomDuration(behavior.natural.nextWanderDelayMs);
    wanderTimer = window.setTimeout(() => {
      if (
        !hasActivePet() ||
        !dom.wanderToggle.checked ||
        dragging ||
        panelOpen()
      ) {
        scheduleWander();
        return;
      }
      const currentBehavior = refreshLifeEngine();
      const plan = naturalLifeEnabled()
        ? lifeEngine.planAutonomous({
            autoWander: Boolean(dom.wanderToggle.checked),
            dragging,
            panelOpen: panelOpen()
          })
        : null;
      if (!applyWanderPlan(preferEdgeRecoveryDirection(plan, currentBehavior) || legacyWanderPlan(currentBehavior))) {
        scheduleWander();
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
          const behavior = refreshLifeEngine();
          wanderDirection = 0;
          preferredNextDirection = 1;
          edgePaused = true;
          wanderUntil = performance.now() + randomDuration(behavior.natural.edgePauseMs);
          animation.setState(pick(behavior.natural.edgePauseStates));
        } else if (bounds?.hitEdge === "right") {
          const behavior = refreshLifeEngine();
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
      animation.setState(edgePaused ? "idle" : pickQuietState(refreshLifeEngine()));
      edgePaused = false;
      scheduleWander();
    }
    requestAnimationFrame(wanderLoop);
  }

  function setPanelVisible(show) {
    dom.panelEl.classList.toggle("hidden", !show);
    dom.panelBackdropEl.classList.toggle("hidden", !show);
    dom.emptyStateEl.classList.toggle("hidden", show || hasActivePet());
    document.documentElement.classList.toggle("panel-open", show);
    document.documentElement.classList.toggle("panel-with-pet", show && hasActivePet());
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
        const behavior = refreshLifeEngine();
        const plan = naturalLifeEnabled() ? lifeEngine.planInteraction("dragEnd") : null;
        suppressNextClick = true;
        if (plan) {
          animation.setState(plan.state || behavior.natural.postDragState, {
            onceReturn: plan.onceReturn || behavior.natural.postDragState
          });
        } else {
          animation.setState(behavior.natural.postDragState);
        }
        scheduleWander(plan?.durationMs ?? behavior.natural.postDragMs);
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
        const behavior = refreshLifeEngine();
        const plan = lifeEngine.planInteraction("click");
        animation.setState(plan?.state || behavior.clickState, {
          onceReturn: plan?.onceReturn || behavior.natural.clickReturnState
        });
      }
    });
    dom.petEl.addEventListener("dblclick", () => {
      const behavior = refreshLifeEngine();
      const plan = lifeEngine.planInteraction("doubleClick");
      animation.setState(plan?.state || behavior.doubleClickState, {
        onceReturn: plan?.onceReturn || behavior.natural.doubleClickReturnState
      });
    });

    document.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (!dom.panelEl.classList.contains("hidden")) {
        setPanelVisible(false);
        pointerInsideInteractiveArea = false;
        setMousePassthrough(hasActivePet());
        return;
      }
      if (!state.pets.length) {
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
    dom.closePanelButton?.addEventListener("click", () => {
      setPanelVisible(false);
      pointerInsideInteractiveArea = false;
      setMousePassthrough(hasActivePet());
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !dom.panelEl.classList.contains("hidden")) {
        setPanelVisible(false);
        pointerInsideInteractiveArea = false;
        setMousePassthrough(hasActivePet());
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
    refreshLifeEngine,
    setMousePassthrough,
    setPanelVisible,
    stopWander,
    wanderLoop
  };
}
