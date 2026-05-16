const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const oldPet = {
    id: "mi-fen",
    displayName: "米粉",
    spritesheetPath: "/pets/mi-fen/spritesheet.webp",
    spritesheetRevision: "old"
  };
  const newPet = { ...oldPet, spritesheetRevision: "new" };
  let inspectCalls = 0;
  let importCalls = 0;

  const { elements, flush } = await loadRenderer({
    tauri: {
      core: {
        convertFileSrc: (value) => `asset://localhost${value}`
      }
    },
    petDesktop: {
      listPets: async () => ({ pets: [oldPet], errors: [] }),
      inspectPetpack: async () => {
        inspectCalls += 1;
        return {
          id: "mi-fen",
          displayName: "米粉",
          version: "1.0.2",
          existingManagedVersion: "1.0.1",
          existingVisibleVersion: "1.0.1",
          existingVisibleSourceKind: "managed",
          willReplaceManaged: true,
          versionRelation: "upgrade"
        };
      },
      importPetpack: async () => {
        importCalls += 1;
        return {
          importedPetId: "mi-fen",
          displayName: "米粉",
          version: "1.0.2",
          replaced: true,
          previousVersion: "1.0.1",
          pets: { pets: [newPet], errors: [] }
        };
      },
      moveBy: async () => {},
      setIgnoreMouseEvents: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      quit: () => {}
    }
  });

  const petpackInput = elements.get("#petpackInput");
  petpackInput.files = [{ arrayBuffer: async () => new ArrayBuffer(0) }];
  petpackInput.dispatch("change");
  await flush();

  if (inspectCalls !== 1 || importCalls !== 0) {
    console.error(JSON.stringify({ ok: false, reason: "file selection should inspect but not import", inspectCalls, importCalls }));
    process.exit(1);
  }

  elements.get("#confirmImportButton").click();
  await flush();

  const background = elements.get("#pet").style.backgroundImage;
  if (!background.includes("spriteRevision=new")) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "import did not bust spritesheet cache",
        background,
        inspectCalls,
        importCalls
      })
    );
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, background, inspectCalls, importCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
