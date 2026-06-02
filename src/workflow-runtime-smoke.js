const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflowPaths = [
  ".github/workflows/release.yml",
  ".github/workflows/pages.yml"
];

const minimumActionMajors = new Map([
  ["actions/cache", 5],
  ["actions/checkout", 6],
  ["actions/configure-pages", 6],
  ["actions/deploy-pages", 5],
  ["actions/download-artifact", 8],
  ["actions/setup-node", 6],
  ["actions/upload-artifact", 7],
  ["actions/upload-pages-artifact", 5],
  ["softprops/action-gh-release", 3]
]);

function hasNode24RuntimeOptIn(source) {
  return /^env:\n(?:[ \t]+[A-Z0-9_]+:.*\n)*[ \t]+FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:[ \t]*(true|"true"|'true')[ \t]*$/m.test(
    source
  );
}

function actionReferenceFailures(source, workflowPath) {
  return [...source.matchAll(/^\s*-?\s*uses:\s+([^@\s]+)@(v(\d+)(?:\.\d+){0,2})\s*$/gm)].flatMap(
    ([, action, version, major]) => {
      const minimumMajor = minimumActionMajors.get(action);
      if (!minimumMajor || Number(major) >= minimumMajor) {
        return [];
      }
      return [`${workflowPath} uses ${action}@${version}; expected ${action}@v${minimumMajor} or newer.`];
    }
  );
}

const failures = workflowPaths.flatMap((workflowPath) => {
  const source = fs.readFileSync(path.join(root, workflowPath), "utf8");
  const runtimeFailures = hasNode24RuntimeOptIn(source)
    ? []
    : [`${workflowPath} must opt into Node 24 JavaScript action runtime.`];
  return [...runtimeFailures, ...actionReferenceFailures(source, workflowPath)];
});

const releaseSource = fs.readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");
const pagesSource = fs.readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");
if (!/push:[\s\S]*branches:[\s\S]*-\s+main/.test(releaseSource)) {
  failures.push("release workflow must run quality/cache warmup on main pushes.");
}
for (const required of [
  "quality-gate:",
  "Install Linux Tauri dependencies",
  "libwebkit2gtk-4.1-dev",
  "libappindicator3-dev",
  "node scripts/check-release-tag.js",
  "npm run smoke",
  "cargo fmt --check",
  "cargo clippy --all-targets -- -D warnings",
  "cargo test"
]) {
  if (!releaseSource.includes(required)) {
    failures.push(`release workflow missing quality gate step: ${required}`);
  }
}
if (releaseSource.indexOf("Install Linux Tauri dependencies") > releaseSource.indexOf("Run Rust tests")) {
  failures.push("release workflow must install Linux Tauri dependencies before running Rust tests");
}
if (releaseSource.indexOf("node scripts/check-release-tag.js") > releaseSource.indexOf("npm run smoke")) {
  failures.push("release workflow must check release tag before running smoke tests");
}
if (!/name:\s+Check release tag version[\s\S]*if:\s+startsWith\(github\.ref, 'refs\/tags\/v'\)/.test(releaseSource)) {
  failures.push("release workflow must skip release tag validation on main warmup runs.");
}
if (releaseSource.indexOf("Run Rust format check") > releaseSource.indexOf("Run Rust tests")) {
  failures.push("release workflow must run Rust format check before Rust tests");
}
if (releaseSource.indexOf("Run Rust Clippy") > releaseSource.indexOf("Run Rust tests")) {
  failures.push("release workflow must run Clippy before Rust tests");
}
const afterSmoke = releaseSource.slice(releaseSource.indexOf("npm run smoke"));
for (const duplicate of ["node scripts/build-petpacks.js", "node src/download-page-smoke.js"]) {
  if (afterSmoke.includes(duplicate)) {
    failures.push(`release workflow repeats smoke-covered command after npm run smoke: ${duplicate}`);
  }
}
if (!/build-windows:[\s\S]*needs:\s+quality-gate/.test(releaseSource)) {
  failures.push("build-windows must depend on quality-gate");
}
if (!/build-windows:[\s\S]*if:\s+startsWith\(github\.ref, 'refs\/tags\/v'\)/.test(releaseSource)) {
  failures.push("build-windows must only run for release tag pushes.");
}
if (!/build-macos:[\s\S]*needs:\s+quality-gate/.test(releaseSource)) {
  failures.push("build-macos must depend on quality-gate");
}
if (!/build-macos:[\s\S]*if:\s+startsWith\(github\.ref, 'refs\/tags\/v'\)/.test(releaseSource)) {
  failures.push("build-macos must only run for release tag pushes.");
}

for (const required of ["node src/visual-qa-page-smoke.js", "node src/download-page-smoke.js"]) {
  if (!pagesSource.includes(required)) {
    failures.push(`pages workflow must verify generated pages before deploy: ${required}`);
  }
}
if (pagesSource.indexOf("Render download page") > pagesSource.indexOf("node src/download-page-smoke.js")) {
  failures.push("pages workflow must render the download page before running its smoke test");
}
if (pagesSource.indexOf("Build petpacks") > pagesSource.indexOf("node src/visual-qa-page-smoke.js")) {
  failures.push("pages workflow must build petpacks before running visual QA smoke");
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, workflowCount: workflowPaths.length }, null, 2));
