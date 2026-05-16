const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const oldPet = {
    id: "mi-fen",
    displayName: "米粉",
    version: "1.0.1",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp"
  };
  const openCalls = [];
  const fetchCalls = [];
  const { elements, flush } = await loadRenderer({
    fetch: async (url) => {
      fetchCalls.push(url);
      if (String(url).includes("/releases/latest")) {
        return {
          ok: true,
          json: async () => ({
            tag_name: "v0.2.1",
            html_url: "https://github.com/jieyangxchen/codex-pet-desktop/releases/tag/v0.2.1"
          })
        };
      }
      return {
        ok: true,
        json: async () => [
          { id: "mi-fen", displayName: "米粉", version: "1.0.2", fileName: "mi-fen-1.0.2.petpack" },
          { id: "mi-jiu", displayName: "米酒", version: "1.0.0", fileName: "mi-jiu-1.0.0.petpack" }
        ]
      };
    },
    petDesktop: {
      listPets: async () => ({ pets: [oldPet], errors: [] }),
      inspectPetpack: async () => {
        throw new Error("not used");
      },
      importPetpack: async () => {
        throw new Error("not used");
      },
      uninstallPet: async () => ({ pets: [], errors: [] }),
      revealPet: async () => {},
      getAppInfo: async () => ({
        version: "0.2.0",
        latestReleaseApi: "https://api.github.com/repos/jieyangxchen/codex-pet-desktop/releases/latest",
        downloadsUrl: "https://jieyangxchen.github.io/codex-pet-desktop/",
        petpackIndexUrl: "https://jieyangxchen.github.io/codex-pet-desktop/petpacks/petpacks.json"
      }),
      openDownloads: async () => {
        openCalls.push("downloads");
      },
      moveBy: async () => {},
      setIgnoreMouseEvents: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      quit: () => {}
    }
  });

  elements.get("#checkUpdateButton").click();
  await flush();

  const updateText = elements.get("#updateStatus").textContent;
  if (!fetchCalls[0]?.includes("/releases/latest") || !updateText.includes("v0.2.1")) {
    console.error(JSON.stringify({ ok: false, reason: "update check did not report latest release", fetchCalls, updateText }));
    process.exit(1);
  }

  elements.get("#checkPetpackUpdatesButton").click();
  await flush();

  const petpackUpdateText = elements.get("#updateStatus").textContent;
  if (!fetchCalls[1]?.includes("/petpacks/petpacks.json") || !petpackUpdateText.includes("米粉") || !petpackUpdateText.includes("v1.0.2")) {
    console.error(
      JSON.stringify({ ok: false, reason: "petpack update check did not report remote resource", fetchCalls, petpackUpdateText })
    );
    process.exit(1);
  }

  elements.get("#openDownloadsButton").click();
  await flush();

  if (openCalls[0] !== "downloads") {
    console.error(JSON.stringify({ ok: false, reason: "downloads button did not call backend", openCalls }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, updateText, petpackUpdateText, openCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
