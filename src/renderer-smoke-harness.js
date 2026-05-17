const path = require("node:path");
const { pathToFileURL } = require("node:url");

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    if (force === undefined ? !this.values.has(value) : force) {
      this.values.add(value);
      return true;
    }
    this.values.delete(value);
    return false;
  }
}

function createFakeElement(selector) {
  const listeners = new Map();
  return {
    selector,
    id: selector.startsWith("#") ? selector.slice(1) : "",
    style: {
      setProperty(name, value) {
        this[name] = value;
      }
    },
    classList: new FakeClassList(),
    children: [],
    dataset: {},
    checked: selector === "#wanderToggle" || selector === "#topToggle",
    disabled: false,
    value: "",
    textContent: "",
    files: [],
    addEventListener(type, handler) {
      listeners.set(type, [...(listeners.get(type) || []), handler]);
    },
    dispatch(type, event = {}) {
      for (const handler of listeners.get(type) || []) {
        handler({ target: this, ...event });
      }
    },
    append(...children) {
      this.children.push(...children);
    },
    closest(targetSelector) {
      return targetSelector
        .split(",")
        .map((part) => part.trim())
        .includes(selector)
        ? this
        : null;
    },
    contains(target) {
      return target === this || this.children.includes(target);
    },
    replaceChildren(...children) {
      this.children = children;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    querySelector(childSelector) {
      const child = createFakeElement(`${selector} ${childSelector}`);
      this.children.push(child);
      return child;
    },
    click() {
      this.dispatch("click");
    },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
}

function textOf(element) {
  return [element.textContent, ...(element.children || []).map(textOf)].join(" ");
}

function findByText(element, text) {
  if (element.textContent.includes(text)) {
    return element;
  }
  for (const child of element.children || []) {
    const found = findByText(child, text);
    if (found) {
      return found;
    }
  }
  return null;
}

async function flush() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function loadRenderer(options = {}) {
  const selectors = [
    "#pet",
    "#emptyState",
    "#panel",
    "#panelBackdrop",
    "#petSelect",
    "#stateSelect",
    "#scaleRange",
    "#wanderToggle",
    "#topToggle",
    "#tabControl",
    "#tabStore",
    "#tabManager",
    "#tabUpdate",
    "#controlSection",
    "#storeSection",
    "#managerSection",
    "#updateSection",
    "#importButton",
    "#importEmptyButton",
    "#openStoreEmptyButton",
    "#petpackInput",
    "#importPreview",
    "#importPreviewText",
    "#confirmImportButton",
    "#cancelImportButton",
    "#petManager",
    "#petStatus",
    "#checkUpdateButton",
    "#checkPetpackUpdatesButton",
    "#openDownloadsButton",
    "#openStoreButton",
    "#updateStatus",
    "#petStore",
    "#storeSearch",
    "#storeTagFilter",
    "#storeFilter",
    "#updateAllPetpacksButton",
    "#refreshStoreButton",
    "#petStoreStatus",
    "#petStoreList",
    "#quitButton"
  ];
  const elements = new Map(selectors.map((selector) => [selector, createFakeElement(selector)]));
  elements.get("#tabControl").dataset.panelTab = "controlSection";
  elements.get("#tabStore").dataset.panelTab = "storeSection";
  elements.get("#tabManager").dataset.panelTab = "managerSection";
  elements.get("#tabUpdate").dataset.panelTab = "updateSection";
  elements.get("#panel").classList.add("hidden");
  elements.get("#importPreview").classList.add("hidden");
  elements.get("#tabControl").classList.add("active");
  elements.get("#storeSection").classList.add("hidden");
  elements.get("#managerSection").classList.add("hidden");
  elements.get("#updateSection").classList.add("hidden");

  const timeouts = [];
  const windowObject = {
    petDesktop: options.petDesktop,
    clearTimeout() {},
    setTimeout(callback) {
      timeouts.push(callback);
      return timeouts.length;
    },
    addEventListener() {},
    __TAURI__: options.tauri
  };
  if (typeof options.random === "function") {
    windowObject.Math = Object.create(Math);
    windowObject.Math.random = options.random;
    globalThis.Math = windowObject.Math;
  }
  const documentObject = {
    documentElement: createFakeElement("html"),
    createElement: (tag) => createFakeElement(tag),
    querySelector: (selector) => elements.get(selector),
    addEventListener() {}
  };
  const fetch = options.fetch;

  globalThis.console = console;
  globalThis.performance = { now: () => 0 };
  globalThis.btoa = (value) => Buffer.from(value, "binary").toString("base64");
  globalThis.requestAnimationFrame = () => {};
  globalThis.document = documentObject;
  globalThis.window = windowObject;
  if (fetch) {
    globalThis.fetch = fetch;
    windowObject.fetch = fetch;
  } else {
    delete globalThis.fetch;
  }
  windowObject.window = windowObject;
  windowObject.document = documentObject;
  windowObject.requestAnimationFrame = globalThis.requestAnimationFrame;

  const entry = pathToFileURL(path.join(__dirname, "app", "renderer", "index.js")).href;
  await import(`${entry}?smoke=${process.pid}-${Date.now()}-${Math.random()}`);
  await flush();

  return { elements, timeouts, flush };
}

module.exports = {
  createFakeElement,
  findByText,
  flush,
  loadRenderer,
  textOf
};
