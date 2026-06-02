#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const defaultCargoLockPath = path.join(root, "src-tauri", "Cargo.lock");

function normalizeCargoLockForDependencyCache(lockSource) {
  return lockSource
    .replace(/\r\n?/g, "\n")
    .split(/(?=^\[\[package\]\]$)/m)
    .map((block) => {
      if (/^name = "yongsheng-plan"$/m.test(block) && !/^source = /m.test(block)) {
        return block.replace(/^version = "[^"]+"$/m, 'version = "<local-app>"');
      }
      return block;
    })
    .join("");
}

function cargoDependencyFingerprint(lockSource) {
  return crypto
    .createHash("sha256")
    .update(normalizeCargoLockForDependencyCache(lockSource))
    .digest("hex");
}

function readCargoDependencyFingerprint(cargoLockPath = defaultCargoLockPath) {
  return cargoDependencyFingerprint(fs.readFileSync(cargoLockPath, "utf8"));
}

function writeGithubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

if (require.main === module) {
  const fingerprint = readCargoDependencyFingerprint(process.argv[2] || defaultCargoLockPath);
  writeGithubOutput("fingerprint", fingerprint);
  console.log(JSON.stringify({ ok: true, fingerprint }, null, 2));
}

module.exports = {
  cargoDependencyFingerprint,
  normalizeCargoLockForDependencyCache,
  readCargoDependencyFingerprint
};
