const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const releaseSource = fs.readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");
const lockSource = fs.readFileSync(path.join(root, "src-tauri", "Cargo.lock"), "utf8");
const failures = [];

let cargoDependencyFingerprint;
try {
  ({ cargoDependencyFingerprint } = require("../scripts/cargo-cache-fingerprint"));
} catch (error) {
  failures.push(`scripts/cargo-cache-fingerprint.js must export cargoDependencyFingerprint: ${error.message}`);
}

if (!releaseSource.includes("node scripts/cargo-cache-fingerprint.js")) {
  failures.push("release workflow must compute a Cargo dependency cache fingerprint before cache restore.");
}

if (releaseSource.includes("hashFiles('src-tauri/Cargo.lock')")) {
  failures.push("release workflow must not key Cargo caches directly on the full Cargo.lock.");
}

if (!releaseSource.includes("steps.cargo-cache-key.outputs.fingerprint")) {
  failures.push("release workflow cache keys must use the Cargo dependency fingerprint step output.");
}

if (cargoDependencyFingerprint) {
  const base = cargoDependencyFingerprint(lockSource);
  const lineEndingsChanged = cargoDependencyFingerprint(lockSource.replace(/\n/g, "\r\n"));
  const appVersionChanged = cargoDependencyFingerprint(
    lockSource.replace(/(name = "yongsheng-plan"\nversion = ")[^"]+(")/, "$19.9.9$2")
  );
  const dependencyVersionChanged = cargoDependencyFingerprint(
    lockSource.replace(/(name = "reqwest"\nversion = ")[^"]+(")/, "$10.0.0$2")
  );

  if (base !== lineEndingsChanged) {
    failures.push("Cargo dependency fingerprint must ignore lockfile line ending differences.");
  }
  if (base !== appVersionChanged) {
    failures.push("Cargo dependency fingerprint must ignore the local app package version.");
  }
  if (base === dependencyVersionChanged) {
    failures.push("Cargo dependency fingerprint must change when dependency versions change.");
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true }, null, 2));
