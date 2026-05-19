import {
  PET_TIME_SCALE,
  activeBehavior,
  createLifeEngine,
  petHourAt,
  phaseForPetHour
} from "./app/renderer/life-engine.js";

function assert(condition, detail) {
  if (!condition) {
    console.error(JSON.stringify({ ok: false, ...detail }, null, 2));
    process.exit(1);
  }
}

const hour = 60 * 60 * 1000;
assert(PET_TIME_SCALE === 10, { reason: "pet time scale changed", PET_TIME_SCALE });
assert(petHourAt({ nowMs: hour, startedAtMs: 0, startPetHour: 8 }) === 18, {
  reason: "1 real hour should advance 10 pet hours"
});
assert(phaseForPetHour(8).id === "wake", { reason: "8:00 should be wake phase" });
assert(phaseForPetHour(13).id === "active", { reason: "13:00 should be active phase" });
assert(phaseForPetHour(20).id === "quiet", { reason: "20:00 should be quiet phase" });
assert(phaseForPetHour(2).id === "sleepy", { reason: "02:00 should be sleepy phase" });

const behavior = {
  clickState: "waiting",
  doubleClickState: "jumping",
  idleStates: ["review"],
  wanderDirections: [0],
  natural: {
    nextWanderDelayMs: [500, 500],
    idleDurationMs: [700, 700],
    walkDurationMs: [900, 900],
    postDragState: "review",
    postDragMs: 300,
    clickReturnState: "waiting",
    doubleClickReturnState: "idle"
  },
  life: {
    phases: [
      {
        id: "wake",
        from: 6,
        to: 10,
        idleStates: ["waiting"],
        wanderDirections: [0],
        nextWanderDelayMs: [500, 500],
        idleDurationMs: [700, 700],
        walkDurationMs: [900, 900]
      }
    ],
    idleReactionDelayMs: [1200, 1200]
  }
};

const engine = createLifeEngine({
  behavior,
  preferences: { naturalLife: true },
  startedAtMs: 0,
  startPetHour: 8,
  now: () => 0,
  random: () => 0
});

const click = engine.planInteraction("click");
assert(click.state === "waiting" && click.onceReturn === "waiting", {
  reason: "click should use manifest clickState and phase-aware return",
  click
});

const doubleClick = engine.planInteraction("doubleClick");
assert(doubleClick.state === "jumping" && doubleClick.onceReturn === "waiting", {
  reason: "double click should use manifest doubleClickState with phase-aware return",
  doubleClick
});

const dragEnd = engine.planInteraction("dragEnd");
assert(dragEnd.state === "review" && dragEnd.durationMs === 300, {
  reason: "drag end should use manifest post-drag behavior",
  dragEnd
});

const idle = engine.planAutonomous({ autoWander: true, panelOpen: false, dragging: false });
assert(idle?.state === "waiting" && idle.direction === 0 && idle.durationMs === 700, {
  reason: "idle autonomous plan should use life phase defaults",
  idle
});

const gated = engine.planAutonomous({ autoWander: false, panelOpen: false, dragging: false });
assert(gated === null, { reason: "autoWander false should suppress autonomous plan", gated });

const legacyOff = createLifeEngine({
  behavior,
  preferences: { naturalLife: false },
  startedAtMs: 0,
  startPetHour: 8,
  now: () => 0,
  random: () => 0
});
assert(legacyOff.planAutonomous({ autoWander: true }) === null, {
  reason: "naturalLife false should not return autonomous life plans"
});

const fallbackEngine = createLifeEngine({
  behavior: { idleStates: ["review"], wanderDirections: [0] },
  preferences: { naturalLife: true },
  startedAtMs: 0,
  startPetHour: 13,
  now: () => 0,
  random: () => 0
});
assert(fallbackEngine.planAutonomous({ autoWander: true })?.state === "review", {
  reason: "missing behavior.life should still use existing manifest idle states"
});

const malformedLifeIdle = createLifeEngine({
  behavior: { idleStates: ["waiting"], wanderDirections: [0], life: { phases: [null] } },
  preferences: { naturalLife: true },
  startedAtMs: 0,
  startPetHour: 13,
  now: () => 0,
  random: () => 0
}).planAutonomous({ autoWander: true });
assert(malformedLifeIdle?.state === "waiting" && malformedLifeIdle.direction === 0, {
  reason: "malformed behavior.life.phases should still use existing manifest idle states and directions",
  malformedLifeIdle
});

const partialLifeMiss = createLifeEngine({
  behavior: {
    idleStates: ["review"],
    wanderDirections: [0],
    natural: {
      nextWanderDelayMs: [222, 222],
      idleDurationMs: [111, 111]
    },
    life: {
      phases: [
        {
          id: "wake",
          from: 6,
          to: 10,
          idleStates: ["waiting"],
          wanderDirections: [0],
          nextWanderDelayMs: [500, 500],
          idleDurationMs: [700, 700]
        }
      ]
    }
  },
  preferences: { naturalLife: true },
  startedAtMs: 0,
  startPetHour: 13,
  now: () => 0,
  random: () => 0
}).planAutonomous({ autoWander: true });
assert(
  partialLifeMiss?.state === "review" &&
    partialLifeMiss.direction === 0 &&
    partialLifeMiss.durationMs === 111 &&
    partialLifeMiss.nextDelayMs === 222,
  {
    reason: "partial behavior.life.phases miss should fall back to manifest baseline",
    partialLifeMiss
  }
);

const defaultBehavior = activeBehavior(null);
assert(
  defaultBehavior.clickState === "waving" &&
    defaultBehavior.doubleClickState === "jumping" &&
    defaultBehavior.idleStates.join(",") === "review,waiting,idle",
  {
    reason: "activeBehavior should fall back to old defaults for invalid manifest data",
    defaultBehavior
  }
);

const nullBehaviorClick = createLifeEngine({
  behavior: null,
  preferences: { naturalLife: true },
  startedAtMs: 0,
  startPetHour: 8,
  now: () => 0,
  random: () => 0
}).planInteraction("click");
assert(nullBehaviorClick?.state === "waving", {
  reason: "null behavior should not block click planning",
  nullBehaviorClick
});

const nullPreferencesIdle = createLifeEngine({
  behavior: { idleStates: ["review"], wanderDirections: [0] },
  preferences: null,
  startedAtMs: 0,
  startPetHour: 13,
  now: () => 0,
  random: () => 0
}).planAutonomous({ autoWander: true });
assert(nullPreferencesIdle?.state === "review", {
  reason: "null preferences should default naturalLife to enabled",
  nullPreferencesIdle
});

const updateEngine = createLifeEngine(null);
updateEngine.update(null).update({ behavior: null, preferences: null });
assert(updateEngine.planInteraction("click")?.state === "waving", {
  reason: "update should tolerate null data and keep defaults"
});

const updateHourEngine = createLifeEngine({
  behavior: { idleStates: ["review"], wanderDirections: [0] },
  preferences: { naturalLife: true },
  startedAtMs: 0,
  startPetHour: 13,
  now: () => 0,
  random: () => 0
});
updateHourEngine.update({ startPetHour: undefined });
const updateHourIdle = updateHourEngine.planAutonomous({ autoWander: true });
assert(updateHourIdle?.phaseId === "active" && updateHourIdle?.state === "review", {
  reason: "undefined startPetHour update should preserve previous pet hour",
  updateHourIdle
});

const malformedFunctionsEngine = createLifeEngine({
  behavior: { idleStates: ["review"], wanderDirections: [0] },
  preferences: { naturalLife: true },
  startedAtMs: 0,
  startPetHour: 13,
  now: "bad",
  random: "bad"
});
const malformedFunctionsClick = malformedFunctionsEngine.planInteraction("click");
const malformedFunctionsIdle = malformedFunctionsEngine.planAutonomous({ autoWander: true });
assert(malformedFunctionsClick?.state === "waving" && malformedFunctionsIdle?.state, {
  reason: "malformed now/random should not break planning",
  malformedFunctionsClick,
  malformedFunctionsIdle
});

console.log(JSON.stringify({ ok: true }, null, 2));
