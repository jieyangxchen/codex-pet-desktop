const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const moveCalls = [];
  const passthroughCalls = [];
  let inspectCalls = 0;
  let importCalls = 0;
  const importedPet = {
    id: "mi-fen",
    displayName: "米粉",
    version: "1.0.2",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp"
  };
  const { elements, timeouts, flush } = await loadRenderer({
    tauri: {
      core: {
        invoke: async () => {
          throw new Error("not used");
        }
      }
    },
    petDesktop: {
      listPets: async () => ({ pets: [], errors: [] }),
      inspectPetpack: async () => {
        inspectCalls += 1;
        return {
          id: "mi-fen",
          displayName: "米粉",
          version: "1.0.2",
          existingManagedVersion: "",
          existingVisibleVersion: "",
          existingVisibleSourceKind: "",
          willReplaceManaged: false,
          versionRelation: "new"
        };
      },
      importPetpack: async () => {
        importCalls += 1;
        return {
          importedPetId: "mi-fen",
          displayName: "米粉",
          version: "1.0.2",
          replaced: false,
          previousVersion: "",
          pets: { pets: [importedPet], errors: [] }
        };
      },
      moveBy: (...args) => moveCalls.push(args),
      setIgnoreMouseEvents: (ignored) => passthroughCalls.push(ignored),
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      quit: () => {}
    }
  });

  if (timeouts.length !== 0) {
    console.error(JSON.stringify({ ok: false, reason: "empty state scheduled wander", timeouts: timeouts.length }));
    process.exit(1);
  }

  if (moveCalls.length !== 0) {
    console.error(JSON.stringify({ ok: false, reason: "empty state moved window", moveCalls }));
    process.exit(1);
  }

  const petpackInput = elements.get("#petpackInput");
  petpackInput.files = [{ arrayBuffer: async () => new ArrayBuffer(0) }];
  petpackInput.dispatch("change");
  await flush();

  if (elements.get("#panel").classList.contains("hidden") || elements.get("#importPreview").classList.contains("hidden")) {
    console.error(JSON.stringify({ ok: false, reason: "empty first import preview is hidden" }));
    process.exit(1);
  }

  elements.get("#cancelImportButton").click();
  await flush();

  if (!elements.get("#panel").classList.contains("hidden") || !elements.get("#importPreview").classList.contains("hidden") || importCalls !== 0) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "empty first import cancel did not hide panel without importing",
        panelHidden: elements.get("#panel").classList.contains("hidden"),
        previewHidden: elements.get("#importPreview").classList.contains("hidden"),
        importCalls
      })
    );
    process.exit(1);
  }

  petpackInput.files = [{ arrayBuffer: async () => new ArrayBuffer(0) }];
  petpackInput.dispatch("change");
  await flush();

  elements.get("#confirmImportButton").click();
  await flush();

  if (inspectCalls !== 2 || importCalls !== 1 || !elements.get("#petStatus").textContent.includes("已导入")) {
    console.error(
      JSON.stringify({ ok: false, reason: "empty first import did not complete", inspectCalls, importCalls, status: elements.get("#petStatus").textContent })
    );
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, passthroughCalls, inspectCalls, importCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
