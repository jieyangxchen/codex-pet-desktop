const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const pet = {
    id: "mi-fen",
    displayName: "米粉",
    version: "1.0.2",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp"
  };
  const saveCalls = [];
  const { elements, flush } = await loadRenderer({
    petDesktop: {
      listPets: async () => ({ pets: [pet], errors: [] }),
      getAppInfo: async () => ({ version: "0.2.13", latestReleaseApi: "", petpackIndexUrl: "" }),
      getPreferences: async () => ({ selectedPetId: "mi-fen", scale: 0.6, autoWander: false, alwaysOnTop: true, petDirection: "left" }),
      savePreferences: async (preferences) => {
        saveCalls.push(preferences);
        return preferences;
      },
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
      resizeWindow: async () => {},
      setIgnoreMouseEvents: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      centerPosition: async () => {},
      quit: () => {}
    }
  });

  if (
    elements.get("#pet").style["--direction-scale"] !== "-1" ||
    !elements.get("#directionLeftButton").classList.contains("active") ||
    elements.get("#directionRightButton").classList.contains("active")
  ) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: "stored left direction was not applied",
          scale: elements.get("#pet").style["--direction-scale"],
          leftActive: elements.get("#directionLeftButton").classList.contains("active"),
          rightActive: elements.get("#directionRightButton").classList.contains("active")
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  elements.get("#directionRightButton").click();
  await flush();

  const latest = saveCalls.at(-1);
  if (
    elements.get("#pet").style["--direction-scale"] !== "1" ||
    !elements.get("#directionRightButton").classList.contains("active") ||
    latest?.petDirection !== "right"
  ) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: "right direction button did not update direction preference",
          scale: elements.get("#pet").style["--direction-scale"],
          rightActive: elements.get("#directionRightButton").classList.contains("active"),
          saveCalls
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, saveCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
