const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const petpacksRoot = path.join(projectRoot, "release", "petpacks");
const index = JSON.parse(fs.readFileSync(path.join(petpacksRoot, "petpacks.json"), "utf8"));
const qa = JSON.parse(fs.readFileSync(path.join(petpacksRoot, "qa.json"), "utf8"));
const html = fs.readFileSync(path.join(petpacksRoot, "visual-qa.html"), "utf8");

const requiredIndexFields = ["sizeBytes", "sha256", "previewAtlas", "sprite", "qa"];
const failures = [];

for (const pet of index) {
  for (const field of requiredIndexFields) {
    if (!(field in pet)) {
      failures.push(`${pet.id} missing ${field}`);
    }
  }
  if (!Number.isInteger(pet.sizeBytes) || pet.sizeBytes <= 0) {
    failures.push(`${pet.id} has invalid sizeBytes`);
  }
  if (!/^[a-f0-9]{64}$/.test(pet.sha256 || "")) {
    failures.push(`${pet.id} has invalid sha256`);
  }
  if (!pet.previewAtlas || !fs.existsSync(path.join(petpacksRoot, pet.previewAtlas))) {
    failures.push(`${pet.id} preview atlas missing`);
  }
  if (pet.spritesheet !== "spritesheet.webp") {
    failures.push(`${pet.id} has unexpected spritesheet ${pet.spritesheet}`);
  }
  if (!pet.sprite || pet.sprite.columns !== 8 || pet.sprite.rows !== 9 || pet.sprite.cellWidth !== 192) {
    failures.push(`${pet.id} has invalid sprite grid metadata`);
  }
  if (!pet.qa || pet.qa.ok !== true || pet.qa.previewAtlas !== pet.previewAtlas) {
    failures.push(`${pet.id} qa metadata invalid`);
  }
  if (!html.includes(`id="${pet.id}"`) || !html.includes(pet.previewAtlas)) {
    failures.push(`${pet.id} missing from visual QA page`);
  }
}

const qaPreviewFailures = qa.pets.filter((pet) => !pet.previewAtlas);
if (qaPreviewFailures.length > 0) {
  failures.push(`qa report missing previewAtlas for ${qaPreviewFailures.map((pet) => pet.id).join(", ")}`);
}

for (const text of ["宠物资源视觉 QA", "发布前检查动作比例", "Pet visual QA"]) {
  if (!html.includes(text)) {
    failures.push(`visual QA page missing ${text}`);
  }
}

for (const state of ["idle", "running-right", "running-left", "waving", "jumping", "failed", "waiting", "running", "review"]) {
  if (!html.includes(`data-state="${state}"`)) {
    failures.push(`visual QA page missing state ${state}`);
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, petCount: index.length }, null, 2));
