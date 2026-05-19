import { STATES } from "./constants.js";

export const PET_TIME_SCALE = 10;

const HOUR_MS = 60 * 60 * 1000;

const DEFAULT_NATURAL_BEHAVIOR = {
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

const DEFAULT_BEHAVIOR = {
  clickState: "waving",
  doubleClickState: "jumping",
  idleStates: ["review", "waiting", "idle"],
  wanderDirections: [-1, 1, 0],
  natural: DEFAULT_NATURAL_BEHAVIOR
};

const DEFAULT_PHASES = [
  {
    id: "wake",
    from: 6,
    to: 10,
    idleStates: ["waiting", "review", "idle"],
    wanderDirections: [0, 1, -1],
    nextWanderDelayMs: [3200, 7200],
    idleDurationMs: [1500, 3200],
    walkDurationMs: [2200, 4600]
  },
  {
    id: "active",
    from: 10,
    to: 18,
    idleStates: ["review", "waiting", "idle"],
    wanderDirections: [1, -1, 0],
    nextWanderDelayMs: [2600, 6200],
    idleDurationMs: [1200, 2800],
    walkDurationMs: [2600, 5600]
  },
  {
    id: "quiet",
    from: 18,
    to: 22,
    idleStates: ["idle", "waiting", "review"],
    wanderDirections: [0, 1, -1],
    nextWanderDelayMs: [5200, 11000],
    idleDurationMs: [2400, 5200],
    walkDurationMs: [1800, 3600]
  },
  {
    id: "sleepy",
    from: 22,
    to: 6,
    idleStates: ["idle", "waiting"],
    wanderDirections: [0, 0, 1, -1],
    nextWanderDelayMs: [8000, 16000],
    idleDurationMs: [3200, 7200],
    walkDurationMs: [1200, 2600]
  }
];

const DEFAULT_LIFE = {
  phases: DEFAULT_PHASES,
  idleReactionDelayMs: [12000, 32000]
};

export function petHourAt({ nowMs, startedAtMs, startPetHour }) {
  const now = finiteNumber(nowMs, 0);
  const startedAt = finiteNumber(startedAtMs, now);
  const startHour = finiteNumber(startPetHour, 0);
  return wrapHour(startHour + ((now - startedAt) / HOUR_MS) * PET_TIME_SCALE);
}

export function phaseForPetHour(hour, phases = DEFAULT_PHASES) {
  const petHour = wrapHour(hour);
  return normalizedPhases(phases).find((phase) => hourInRange(petHour, phase.from, phase.to)) || DEFAULT_PHASES[0];
}

export function activeBehavior(behavior = {}) {
  const source = isPlainObject(behavior) ? behavior : {};
  const natural = isPlainObject(source.natural) ? source.natural : {};
  const base = {
    clickState: validState(source.clickState, DEFAULT_BEHAVIOR.clickState),
    doubleClickState: validState(source.doubleClickState, DEFAULT_BEHAVIOR.doubleClickState),
    idleStates: validStates(source.idleStates, DEFAULT_BEHAVIOR.idleStates),
    wanderDirections: validDirections(source.wanderDirections, DEFAULT_BEHAVIOR.wanderDirections),
    natural: {
      nextWanderDelayMs: readDurationRange(natural.nextWanderDelayMs, DEFAULT_NATURAL_BEHAVIOR.nextWanderDelayMs),
      idleDurationMs: readDurationRange(natural.idleDurationMs, DEFAULT_NATURAL_BEHAVIOR.idleDurationMs),
      walkDurationMs: readDurationRange(natural.walkDurationMs, DEFAULT_NATURAL_BEHAVIOR.walkDurationMs),
      edgePauseMs: readDurationRange(natural.edgePauseMs, DEFAULT_NATURAL_BEHAVIOR.edgePauseMs),
      edgePauseStates: validStates(natural.edgePauseStates, DEFAULT_NATURAL_BEHAVIOR.edgePauseStates),
      postDragState: validState(natural.postDragState, DEFAULT_NATURAL_BEHAVIOR.postDragState),
      postDragMs: readDurationRange(natural.postDragMs, [
        DEFAULT_NATURAL_BEHAVIOR.postDragMs,
        DEFAULT_NATURAL_BEHAVIOR.postDragMs
      ])[0],
      clickReturnState: validState(natural.clickReturnState, DEFAULT_NATURAL_BEHAVIOR.clickReturnState),
      doubleClickReturnState: validState(natural.doubleClickReturnState, DEFAULT_NATURAL_BEHAVIOR.doubleClickReturnState)
    }
  };
  const life = isPlainObject(source.life) ? source.life : {};
  const hasLifePhases = Array.isArray(life.phases) && life.phases.length > 0;
  return {
    ...base,
    life: {
      phases: hasLifePhases ? normalizedPhases(life.phases, base) : defaultPhasesForBehavior(base),
      idleReactionDelayMs: readDurationRange(life.idleReactionDelayMs, DEFAULT_LIFE.idleReactionDelayMs)
    }
  };
}

export function createLifeEngine(options = {}) {
  const source = isPlainObject(options) ? options : {};
  const {
    behavior = {},
    preferences = {},
    now = () => Date.now(),
    random = () => Math.random(),
    startedAtMs,
    startPetHour = 8
  } = source;
  let clock = typeof now === "function" ? now : () => Date.now();
  let rng = typeof random === "function" ? random : () => Math.random();
  let normalized = activeBehavior(behavior);
  let engineStartedAtMs = finiteNumber(startedAtMs, safeNow(clock));
  let engineStartPetHour = wrapHour(finiteNumber(startPetHour, 8));
  let naturalLife = naturalLifeEnabled(preferences);

  function currentPhase() {
    return phaseForPetHour(
      petHourAt({
        nowMs: safeNow(clock),
        startedAtMs: engineStartedAtMs,
        startPetHour: engineStartPetHour
      }),
      normalized.life.phases
    );
  }

  function pick(items) {
    const index = Math.min(Math.floor(safeRandom(rng) * items.length), items.length - 1);
    return items[index] ?? items[0];
  }

  function randomDuration(range) {
    const [min, max] = range;
    return min + safeRandom(rng) * (max - min);
  }

  function phaseReturnState() {
    return pick(currentPhase().idleStates);
  }

  return {
    get behavior() {
      return normalized;
    },
    update(next = {}) {
      const source = isPlainObject(next) ? next : {};
      if ("behavior" in source) {
        normalized = activeBehavior(source.behavior);
      }
      if ("preferences" in source) {
        naturalLife = naturalLifeEnabled(source.preferences);
      }
      if ("startedAtMs" in source) {
        engineStartedAtMs = finiteNumber(source.startedAtMs, engineStartedAtMs);
      }
      if ("startPetHour" in source) {
        const nextStartPetHour = Number(source.startPetHour);
        if (Number.isFinite(nextStartPetHour)) {
          engineStartPetHour = wrapHour(nextStartPetHour);
        }
      }
      if ("now" in source) {
        clock = typeof source.now === "function" ? source.now : () => Date.now();
      }
      if ("random" in source) {
        rng = typeof source.random === "function" ? source.random : () => Math.random();
      }
      return this;
    },
    planInteraction(type) {
      if (type === "click") {
        return {
          kind: "interaction",
          type,
          state: normalized.clickState,
          onceReturn: naturalLife ? phaseReturnState() : normalized.natural.clickReturnState
        };
      }
      if (type === "doubleClick") {
        return {
          kind: "interaction",
          type,
          state: normalized.doubleClickState,
          onceReturn: naturalLife ? phaseReturnState() : normalized.natural.doubleClickReturnState
        };
      }
      if (type === "dragEnd") {
        return {
          kind: "interaction",
          type,
          state: normalized.natural.postDragState,
          durationMs: normalized.natural.postDragMs,
          onceReturn: naturalLife ? phaseReturnState() : normalized.natural.postDragState
        };
      }
      return null;
    },
    planAutonomous({ autoWander = true, panelOpen = false, dragging = false } = {}) {
      if (!naturalLife || !autoWander || panelOpen || dragging) {
        return null;
      }
      const phase = currentPhase();
      const direction = pick(phase.wanderDirections);
      const state = direction < 0 ? "running-left" : direction > 0 ? "running-right" : pick(phase.idleStates);
      return {
        kind: "autonomous",
        type: "idleTimeout",
        state,
        direction,
        durationMs: randomDuration(direction === 0 ? phase.idleDurationMs : phase.walkDurationMs),
        nextDelayMs: randomDuration(phase.nextWanderDelayMs),
        phaseId: phase.id
      };
    },
    phase() {
      return currentPhase();
    }
  };
}

function normalizedPhases(phases, behavior = DEFAULT_BEHAVIOR) {
  const hasCustomPhases = Array.isArray(phases) && phases.length > 0;
  const source = hasCustomPhases ? phases : DEFAULT_PHASES;
  const normalized = source
    .map((phase, index) => normalizePhase(phase, DEFAULT_PHASES[index % DEFAULT_PHASES.length], behavior))
    .filter(Boolean);
  if (!normalized.length) {
    return defaultPhasesForBehavior(behavior);
  }
  return hasCustomPhases ? [...normalized, ...defaultPhasesForBehavior(behavior)] : normalized;
}

function defaultPhasesForBehavior(behavior) {
  return DEFAULT_PHASES.map((phase) => ({
    ...phase,
    idleStates: behavior.idleStates,
    wanderDirections: behavior.wanderDirections,
    nextWanderDelayMs: behavior.natural.nextWanderDelayMs,
    idleDurationMs: behavior.natural.idleDurationMs,
    walkDurationMs: behavior.natural.walkDurationMs
  }));
}

function normalizePhase(phase, fallback, behavior) {
  if (!isPlainObject(phase)) {
    return null;
  }
  const from = finiteHour(phase.from, fallback.from);
  const to = finiteHour(phase.to, fallback.to);
  return {
    id: typeof phase.id === "string" && phase.id.trim() ? phase.id : fallback.id,
    from,
    to,
    idleStates: validStates(phase.idleStates, behavior.idleStates || fallback.idleStates),
    wanderDirections: validDirections(phase.wanderDirections, behavior.wanderDirections || fallback.wanderDirections),
    nextWanderDelayMs: readDurationRange(
      phase.nextWanderDelayMs,
      behavior.natural?.nextWanderDelayMs || fallback.nextWanderDelayMs
    ),
    idleDurationMs: readDurationRange(phase.idleDurationMs, behavior.natural?.idleDurationMs || fallback.idleDurationMs),
    walkDurationMs: readDurationRange(phase.walkDurationMs, behavior.natural?.walkDurationMs || fallback.walkDurationMs)
  };
}

function hourInRange(hour, from, to) {
  if (from === to) {
    return true;
  }
  if (from < to) {
    return hour >= from && hour < to;
  }
  return hour >= from || hour < to;
}

function wrapHour(value) {
  const hour = finiteNumber(value, 0) % 24;
  return hour < 0 ? hour + 24 : hour;
}

function finiteHour(value, fallback) {
  return wrapHour(finiteNumber(value, fallback));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

function validState(state, fallback) {
  return STATES[state] ? state : fallback;
}

function validStates(states, fallback) {
  const valid = Array.isArray(states) ? states.filter((state) => STATES[state]) : [];
  return valid.length ? valid : fallback;
}

function validDirections(directions, fallback) {
  const valid = Array.isArray(directions) ? directions.filter((direction) => [-1, 0, 1].includes(direction)) : [];
  return valid.length ? valid : fallback;
}

function safeRandom(random) {
  if (typeof random !== "function") {
    return Math.random();
  }
  const value = Number(random());
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 0.999999999);
}

function safeNow(now) {
  if (typeof now !== "function") {
    return Date.now();
  }
  const value = Number(now());
  return Number.isFinite(value) ? value : Date.now();
}

function naturalLifeEnabled(preferences) {
  const source = isPlainObject(preferences) ? preferences : {};
  return source.naturalLife !== false;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
