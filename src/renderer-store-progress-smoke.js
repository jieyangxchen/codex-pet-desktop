const { findByText, loadRenderer } = require("./renderer-smoke-harness");

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function main() {
  const releaseDownload = deferred();
  const fetchCalls = [];
  const importCalls = [];
  let readCount = 0;

  const oldPet = {
    id: "mi-fen",
    displayName: "米粉",
    version: "1.0.1",
    sourceKind: "managed",
    canUninstall: true,
    spritesheetPath: "/pets/mi-fen/spritesheet.webp"
  };
  const newPet = { ...oldPet, version: "1.0.2" };

  const { elements, flush } = await loadRenderer({
    fetch: async (url) => {
      fetchCalls.push(String(url));
      if (String(url).endsWith("/petpacks/petpacks.json")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "mi-fen",
              displayName: "米粉",
              description: "全白猫咪",
              version: "1.0.2",
              fileName: "mi-fen-1.0.2.petpack"
            }
          ]
        };
      }
      return {
        ok: true,
        headers: {
          get: (name) => (String(name).toLowerCase() === "content-length" ? "4" : null)
        },
        body: {
          getReader: () => ({
            read: async () => {
              readCount += 1;
              if (readCount === 1) {
                return { done: false, value: Uint8Array.from([1, 2]) };
              }
              await releaseDownload.promise;
              return { done: true };
            }
          })
        }
      };
    },
    petDesktop: {
      listPets: async () => ({ pets: [oldPet], errors: [] }),
      getAppInfo: async () => ({
        version: "0.2.13",
        latestReleaseApi: "",
        downloadsUrl: "",
        petpackIndexUrl: "https://example.test/petpacks/petpacks.json"
      }),
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
      importPetpack: async () => {
        importCalls.push(true);
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

  elements.get("#refreshStoreButton").click();
  await flush();

  const updateButton = findByText(elements.get("#petStoreList"), "更新");
  if (!updateButton) {
    console.error(JSON.stringify({ ok: false, reason: "missing update button" }));
    process.exit(1);
  }

  updateButton.click();
  await flush();

  const progress = elements.get("#petStoreProgress");
  const status = elements.get("#petStoreStatus").textContent;
  if (progress.classList.contains("hidden") || progress.value !== 2 || progress.max !== 4 || !status.includes("50%")) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "store install should expose streaming download progress",
        progressHidden: progress.classList.contains("hidden"),
        value: progress.value,
        max: progress.max,
        status
      })
    );
    process.exit(1);
  }

  releaseDownload.resolve();
  await flush();

  if (!progress.classList.contains("hidden") || importCalls.length !== 1) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "store install should finish and hide progress",
        progressHidden: progress.classList.contains("hidden"),
        importCalls: importCalls.length
      })
    );
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, fetchCalls, status: elements.get("#petStoreStatus").textContent }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
