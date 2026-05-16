const { findByText, loadRenderer, textOf } = require("./renderer-smoke-harness");

async function main() {
  const oldPet = {
    id: "mi-fen",
    displayName: "米粉",
    version: "1.0.1",
    sourceKind: "managed",
    canUninstall: true,
    root: "/pets/mi-fen",
    spritesheetPath: "/pets/mi-fen/spritesheet.webp",
    spritesheetRevision: "old"
  };
  const newPet = { ...oldPet, version: "1.0.2", spritesheetRevision: "new" };
  const uninstallCalls = [];

  const { elements, flush } = await loadRenderer({
    tauri: {
      core: {
        convertFileSrc: (value) => `asset://localhost${value}`
      }
    },
    petDesktop: {
      listPets: async () => ({ pets: [oldPet], errors: [] }),
      inspectPetpack: async () => ({
        id: "mi-fen",
        displayName: "米粉",
        version: "1.0.2",
        existingManagedVersion: "1.0.1",
        existingVisibleVersion: "1.0.1",
        existingVisibleSourceKind: "managed",
        willReplaceManaged: true,
        versionRelation: "upgrade"
      }),
      importPetpack: async () => ({
        importedPetId: "mi-fen",
        displayName: "米粉",
        version: "1.0.2",
        replaced: true,
        previousVersion: "1.0.1",
        pets: { pets: [newPet], errors: [] }
      }),
      uninstallPet: async (id) => {
        uninstallCalls.push(id);
        return { pets: [], errors: [] };
      },
      revealPet: async () => {},
      moveBy: async () => {},
      setIgnoreMouseEvents: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      quit: () => {}
    }
  });

  const managerText = textOf(elements.get("#petManager"));
  if (!managerText.includes("米粉") || !managerText.includes("1.0.1") || !managerText.includes("managed")) {
    console.error(JSON.stringify({ ok: false, reason: "manager did not render pet metadata", managerText }));
    process.exit(1);
  }

  const petpackInput = elements.get("#petpackInput");
  petpackInput.files = [{ arrayBuffer: async () => new ArrayBuffer(0) }];
  petpackInput.dispatch("change");
  await flush();

  const previewText = elements.get("#importPreviewText").textContent;
  if (!previewText.includes("1.0.1") || !previewText.includes("1.0.2")) {
    console.error(JSON.stringify({ ok: false, reason: "import preview missing version comparison", previewText }));
    process.exit(1);
  }

  elements.get("#confirmImportButton").click();
  await flush();

  const statusText = elements.get("#petStatus").textContent;
  if (!statusText.includes("已覆盖") || !statusText.includes("1.0.1") || !statusText.includes("1.0.2")) {
    console.error(JSON.stringify({ ok: false, reason: "import overwrite status missing", statusText }));
    process.exit(1);
  }

  const uninstallButton = findByText(elements.get("#petManager"), "Uninstall");
  if (!uninstallButton) {
    console.error(JSON.stringify({ ok: false, reason: "missing uninstall button", managerText: textOf(elements.get("#petManager")) }));
    process.exit(1);
  }
  uninstallButton.click();
  await flush();

  if (uninstallCalls[0] !== "mi-fen") {
    console.error(JSON.stringify({ ok: false, reason: "uninstall did not call backend", uninstallCalls }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, previewText, statusText, uninstallCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
