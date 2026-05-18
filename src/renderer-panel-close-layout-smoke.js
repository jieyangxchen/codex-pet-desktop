const fs = require("node:fs");
const path = require("node:path");
const { loadRenderer } = require("./renderer-smoke-harness");

function panelVisible(elements) {
  return !elements.get("#panel").classList.contains("hidden");
}

function assertPanelHidden(elements, reason) {
  if (panelVisible(elements)) {
    console.error(JSON.stringify({ ok: false, reason }, null, 2));
    process.exit(1);
  }
}

function openControlPanel(documentObject) {
  documentObject.dispatch("contextmenu", {
    target: documentObject.documentElement,
    preventDefault() {}
  });
}

async function main() {
  const html = fs.readFileSync(path.join(__dirname, "app", "renderer.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "app", "renderer.css"), "utf8");
  if (!html.includes('id="closePanelButton"')) {
    console.error(JSON.stringify({ ok: false, reason: "panel needs an explicit close button" }, null, 2));
    process.exit(1);
  }
  if (!/\.panel-backdrop\s*\{[^}]*pointer-events:\s*auto/s.test(css)) {
    console.error(JSON.stringify({ ok: false, reason: "panel backdrop must receive outside clicks" }, null, 2));
    process.exit(1);
  }

  const resizeCalls = [];
  const pet = {
    id: "tigris-whippet",
    displayName: "红糖",
    version: "1.0.1",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/tigris-whippet/spritesheet.webp"
  };

  const { documentObject, elements, flush, windowObject } = await loadRenderer({
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.13", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({ scale: 0.6, autoWander: false }),
      savePreferences: async (value) => value,
      inspectPetpack: async () => {
        throw new Error("not used");
      },
      importPetpack: async () => {
        throw new Error("not used");
      },
      uninstallPet: async () => ({ pets: [], errors: [] }),
      revealPet: async () => {},
      openDownloads: async () => {},
      moveBy: async () => {},
      setIgnoreMouseEvents: async () => {},
      resizeWindow: async (width, height, anchor) => {
        resizeCalls.push({ width, height, anchor });
      },
      centerPosition: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  openControlPanel(documentObject);
  await flush();

  const panelWindow = resizeCalls.at(-1);
  if (
    !panelVisible(elements) ||
    !documentObject.documentElement.classList.contains("panel-with-pet") ||
    !panelWindow ||
    panelWindow.width < 520 ||
    !panelWindow.anchor ||
    panelWindow.anchor.next.x <= panelWindow.anchor.current.x
  ) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: "active pet panel should open beside the pet instead of covering it",
          panelVisible: panelVisible(elements),
          panelWithPet: documentObject.documentElement.classList.contains("panel-with-pet"),
          resizeCalls
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  elements.get("#closePanelButton").click();
  await flush();
  const closedWindow = resizeCalls.at(-1);
  if (!closedWindow?.anchor || closedWindow.anchor.next.x >= closedWindow.anchor.current.x) {
    console.error(JSON.stringify({ ok: false, reason: "closing panel should preserve pet anchor", resizeCalls }, null, 2));
    process.exit(1);
  }
  assertPanelHidden(elements, "close button did not hide panel");

  openControlPanel(documentObject);
  await flush();
  documentObject.dispatch("contextmenu", {
    target: elements.get("#panel"),
    preventDefault() {}
  });
  await flush();
  assertPanelHidden(elements, "right-click inside visible panel did not hide panel");

  openControlPanel(documentObject);
  await flush();
  documentObject.dispatch("pointerdown", { target: elements.get("#panelBackdrop") });
  await flush();
  assertPanelHidden(elements, "clicking panel backdrop did not hide panel");

  openControlPanel(documentObject);
  await flush();
  windowObject.dispatch("keydown", { key: "Escape" });
  await flush();
  assertPanelHidden(elements, "Escape did not hide panel");

  console.log(JSON.stringify({ ok: true, resizeCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
