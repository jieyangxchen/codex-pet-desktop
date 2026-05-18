const fs = require("node:fs");
const path = require("node:path");
const { loadRenderer } = require("./renderer-smoke-harness");

async function main() {
  const passthroughCalls = [];
  const fetchCalls = [];

  const { elements, flush, windowObject } = await loadRenderer({
    fetch: async (url) => {
      fetchCalls.push(String(url));
      return {
        ok: true,
        json: async () => []
      };
    },
    petDesktop: {
      listPets: async () => ({ pets: [], errors: [] }),
      getAppInfo: async () => ({
        version: "0.2.10",
        platform: "windows",
        latestReleaseApi: "",
        downloadsUrl: "",
        petpackIndexUrl: "https://example.test/petpacks/petpacks.json"
      }),
      moveBy: async () => {},
      setIgnoreMouseEvents: (ignored) => passthroughCalls.push(ignored),
      resetPosition: async () => {},
      setAlwaysOnTop: async () => {},
      getWindowState: async () => ({ alwaysOnTop: true }),
      quit: () => {}
    }
  });

  if (elements.get("#panel").classList.contains("hidden") || !elements.get("#emptyState").classList.contains("hidden")) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "first-run store panel should be the only visible empty-state surface",
        panelHidden: elements.get("#panel").classList.contains("hidden"),
        emptyHidden: elements.get("#emptyState").classList.contains("hidden"),
        fetchCalls
      })
    );
    process.exit(1);
  }

  windowObject.dispatch("blur");
  await flush();

  if (elements.get("#panel").classList.contains("hidden") || passthroughCalls.some(Boolean)) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "visible controls should survive blur and keep receiving mouse events",
        panelHidden: elements.get("#panel").classList.contains("hidden"),
        passthroughCalls
      })
    );
    process.exit(1);
  }

  const rendererHtml = fs.readFileSync(path.join(__dirname, "app", "renderer.html"), "utf8");
  const petpackInput = rendererHtml.match(/<input[^>]+id="petpackInput"[^>]*>/)?.[0] || "";
  if (!petpackInput || /\bclass="[^"]*\bhidden\b/.test(petpackInput)) {
    console.error(JSON.stringify({ ok: false, reason: "petpack input must not be display:none on Windows", petpackInput }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, passthroughCalls, fetchCalls }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
