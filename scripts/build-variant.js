#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const variants = {
  cats: {
    productName: "Codex Pet Desktop Cats",
    pets: ["mi-fen", "mi-jiu"],
    outName: "codex-pet-desktop-cats"
  },
  tigris: {
    productName: "Codex Pet Desktop Tigris",
    pets: ["tigris-whippet"],
    outName: "codex-pet-desktop-tigris"
  }
};

const variantName = process.argv[2];
const target = process.argv[3] || "build";
const variant = variants[variantName];

if (!variant) {
  console.error(`Usage: node scripts/build-variant.js <${Object.keys(variants).join("|")}> [dev|build]`);
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const tauriDir = path.join(root, "src-tauri");
const generatedResources = path.join(tauriDir, "generated", variantName, "pets");
const configPath = path.join(tauriDir, `tauri.${variantName}.conf.json`);

fs.rmSync(generatedResources, { recursive: true, force: true });
fs.mkdirSync(generatedResources, { recursive: true });

for (const petId of variant.pets) {
  const source = path.join(root, "resources", "pets", petId);
  const destination = path.join(generatedResources, petId);
  fs.cpSync(source, destination, { recursive: true });
}

const config = {
  $schema: "https://schema.tauri.app/config/2",
  productName: variant.productName,
  version: "0.1.0",
  identifier: `com.local.codexpetdesktop.${variantName}`,
  build: {
    frontendDist: "../src",
    beforeDevCommand: "",
    beforeBuildCommand: ""
  },
  app: {
    withGlobalTauri: true,
    windows: [
      {
        label: "main",
        title: variant.productName,
        url: "renderer.html",
        width: 320,
        height: 340,
        resizable: false,
        fullscreen: false,
        transparent: true,
        decorations: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        shadow: false,
        backgroundColor: "#00000000",
        visible: false
      }
    ],
    security: {
      csp: null,
      assetProtocol: {
        enable: true,
        scope: ["$APPDATA/**", "$RESOURCE/**", "$HOME/.codex/pets/**", "../resources/pets/**"]
      }
    }
  },
  bundle: {
    active: true,
    targets: ["nsis"],
    icon: ["icons/icon.png", "icons/icon.ico"],
    resources: {
      [`generated/${variantName}/pets`]: "pets"
    },
    windows: {}
  }
};

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

const cargoArgs = target === "dev" ? ["run"] : ["tauri", "build", "--config", configPath];
const command = target === "dev" ? "cargo" : "cargo";
const result = spawnSync(command, cargoArgs, {
  cwd: tauriDir,
  stdio: "inherit",
  env: {
    ...process.env,
    CODEX_PET_VARIANT: variantName
  }
});

process.exit(result.status ?? 1);
