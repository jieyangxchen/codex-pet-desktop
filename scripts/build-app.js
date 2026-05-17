#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const target = process.argv[2] || "build";
const platform = process.argv[3] || process.env.PET_DESKTOP_PLATFORM || process.platform;

function bundleTargetsForPlatform(value) {
  if (value === "windows" || value === "win32") {
    return ["nsis"];
  }
  if (value === "macos" || value === "macos-arm64" || value === "macos-x64" || value === "darwin") {
    return ["dmg"];
  }
  return process.platform === "darwin" ? ["dmg"] : ["nsis"];
}

function buildTargetForPlatform(value) {
  if (value === "macos-arm64") {
    return "aarch64-apple-darwin";
  }
  if (value === "macos-x64") {
    return "x86_64-apple-darwin";
  }
  return null;
}

function releaseBundleDirForTarget(tauriRoot, buildTarget) {
  if (buildTarget) {
    return path.join(tauriRoot, "target", buildTarget, "release", "bundle");
  }
  return path.join(tauriRoot, "target", "release", "bundle");
}

const root = path.resolve(__dirname, "..");
const tauriDir = path.join(root, "src-tauri");
const configPath = path.join(tauriDir, "tauri.generated.conf.json");
const buildTarget = buildTargetForPlatform(platform);

const config = {
  $schema: "https://schema.tauri.app/config/2",
  productName: "永生计划",
  version: "0.2.6",
  identifier: "io.github.jieyangxchen.yongshengplan",
  build: {
    frontendDist: "../src/app",
    beforeDevCommand: "",
    beforeBuildCommand: ""
  },
  app: {
    withGlobalTauri: true,
    macOSPrivateApi: true,
    windows: [
      {
        label: "main",
        title: "永生计划",
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
      csp: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: https://asset.localhost http://asset.localhost https://jieyangxchen.github.io data:; connect-src 'self' https://api.github.com https://jieyangxchen.github.io; object-src 'none'; base-uri 'none'",
      assetProtocol: {
        enable: true,
        scope: ["$APPDATA/**", "$RESOURCE/**", "$HOME/.codex/pets/**", "../resources/pets/**"]
      }
    }
  },
  bundle: {
    active: true,
    targets: bundleTargetsForPlatform(platform),
    icon: ["icons/icon.png", "icons/icon.ico"],
    resources: {},
    windows: {}
  }
};

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

if (target === "prepare") {
  process.exit(0);
}

if (target === "build") {
  fs.rmSync(releaseBundleDirForTarget(tauriDir, buildTarget), { recursive: true, force: true });
}

const cargoArgs =
  target === "dev"
    ? ["run"]
    : ["tauri", "build", "--config", configPath, ...(buildTarget ? ["--target", buildTarget] : [])];

const result = spawnSync("cargo", cargoArgs, {
  cwd: tauriDir,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
