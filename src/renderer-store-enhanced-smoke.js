const { findByText, loadRenderer, textOf } = require("./renderer-smoke-harness");
const crypto = require("node:crypto");

async function main() {
  const importCalls = [];
  const fetchCalls = [];
  const remotePetpacks = [
    {
      id: "mi-fen",
      displayName: "米粉",
      description: "全白猫咪",
      version: "1.0.3",
      author: "Chen",
      license: "CC-BY-4.0",
      minAppVersion: "0.2.0",
      changelog: "修正舔爪动作",
      tags: ["猫咪", "白色"],
      sha256: crypto.createHash("sha256").update(Buffer.from([1, 2, 3])).digest("hex"),
      sizeBytes: 2048,
      updatedAt: "2026-05-17",
      fileName: "mi-fen-1.0.3.petpack",
      previewAtlas: "previews/mi-fen-1.0.3-atlas.webp"
    },
    {
      id: "mi-jiu",
      displayName: "米酒",
      description: "深色猫咪",
      version: "1.0.0",
      author: "Chen",
      license: "CC-BY-4.0",
      minAppVersion: "0.2.0",
      changelog: "首版",
      tags: ["猫咪", "深色"],
      sha256: "b".repeat(64),
      sizeBytes: 1024,
      updatedAt: "2026-05-16",
      fileName: "mi-jiu-1.0.0.petpack",
      previewAtlas: "previews/mi-jiu-1.0.0-atlas.webp"
    },
    {
      id: "future",
      displayName: "未来宠物",
      description: "需要新版主程序",
      version: "2.0.0",
      author: "Chen",
      license: "CC-BY-4.0",
      minAppVersion: "9.0.0",
      changelog: "新版格式",
      tags: ["实验"],
      sha256: "c".repeat(64),
      sizeBytes: 1024,
      updatedAt: "2026-05-18",
      fileName: "future-2.0.0.petpack"
    }
  ];

  const { elements, flush } = await loadRenderer({
    fetch: async (url) => {
      fetchCalls.push(String(url));
      if (String(url).endsWith(".petpack")) {
        return { ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
      }
      return { ok: true, json: async () => remotePetpacks };
    },
    petDesktop: {
      listPets: async () => ({
        pets: [
          {
            id: "mi-fen",
            displayName: "米粉",
            version: "1.0.2",
            sourceKind: "managed",
            canUninstall: true,
            spritesheetPath: "/pets/mi-fen/spritesheet.webp"
          },
          {
            id: "mi-jiu",
            displayName: "米酒",
            version: "1.0.0",
            sourceKind: "managed",
            canUninstall: true,
            spritesheetPath: "/pets/mi-jiu/spritesheet.webp"
          }
        ],
        errors: []
      }),
      getAppInfo: async () => ({
        version: "0.2.4",
        latestReleaseApi: "",
        petpackIndexUrl: "https://jieyangxchen.github.io/codex-pet-desktop/petpacks/petpacks.json"
      }),
      getPreferences: async () => ({}),
      savePreferences: async (value) => value,
      inspectPetpack: async () => ({ id: "mi-fen", displayName: "米粉", version: "1.0.3" }),
      importPetpack: async () => {
        importCalls.push("import");
        return {
          importedPetId: "mi-fen",
          displayName: "米粉",
          version: "1.0.3",
          replaced: true,
          previousVersion: "1.0.2",
          pets: { pets: [], errors: [] }
        };
      },
      uninstallPet: async () => ({ pets: [], errors: [] }),
      revealPet: async () => {},
      openDownloads: async () => {},
      moveBy: async () => {},
      setIgnoreMouseEvents: async () => {},
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      updateTrayState: async () => {},
      quit: () => {}
    }
  });

  elements.get("#refreshStoreButton").click();
  await flush();

  let storeText = textOf(elements.get("#petStoreList"));
  if (!storeText.includes("作者 Chen") || !storeText.includes("CC-BY-4.0") || !storeText.includes("修正舔爪动作") || !storeText.includes("sha256")) {
    console.error(JSON.stringify({ ok: false, reason: "metadata not rendered", storeText }, null, 2));
    process.exit(1);
  }
  if (!storeText.includes("需要主程序 v9.0.0")) {
    console.error(JSON.stringify({ ok: false, reason: "incompatible app version not shown", storeText }, null, 2));
    process.exit(1);
  }

  elements.get("#storeSearch").value = "米粉";
  elements.get("#storeSearch").dispatch("input");
  await flush();
  storeText = textOf(elements.get("#petStoreList"));
  if (!storeText.includes("米粉") || storeText.includes("米酒") || storeText.includes("未来宠物")) {
    console.error(JSON.stringify({ ok: false, reason: "search filter failed", storeText }, null, 2));
    process.exit(1);
  }

  elements.get("#storeSearch").value = "";
  elements.get("#storeSearch").dispatch("input");
  elements.get("#storeTagFilter").value = "深色";
  elements.get("#storeTagFilter").dispatch("change");
  await flush();
  storeText = textOf(elements.get("#petStoreList"));
  if (!storeText.includes("米酒") || storeText.includes("米粉") || storeText.includes("未来宠物")) {
    console.error(JSON.stringify({ ok: false, reason: "tag filter failed", storeText }, null, 2));
    process.exit(1);
  }

  elements.get("#storeTagFilter").value = "all";
  elements.get("#storeTagFilter").dispatch("change");
  elements.get("#storeFilter").value = "updates";
  elements.get("#storeFilter").dispatch("change");
  elements.get("#updateAllPetpacksButton").click();
  await flush();
  await flush();
  if (!findByText(elements.get("#petStoreStatus"), "已更新") || importCalls.length !== 1 || !fetchCalls.some((url) => url.endsWith("mi-fen-1.0.3.petpack"))) {
    console.error(JSON.stringify({ ok: false, reason: "update all did not update eligible petpacks", importCalls, fetchCalls, status: elements.get("#petStoreStatus").textContent }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
