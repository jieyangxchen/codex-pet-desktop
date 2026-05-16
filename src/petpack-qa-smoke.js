const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { isRootFileName, parseWebpSize, validatePetResources } = require("../scripts/qa-petpack-assets");

function makeVp8xWebp(width, height) {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

const size = parseWebpSize(makeVp8xWebp(1536, 1872));
if (size.width !== 1536 || size.height !== 1872) {
  console.error(JSON.stringify({ ok: false, reason: "VP8X parser returned wrong size", size }));
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, "..");
const report = validatePetResources(path.join(projectRoot, "resources", "pets"));
if (!report.ok || report.pets.length !== 3) {
  console.error(JSON.stringify({ ok: false, reason: "pet resource QA failed", report }, null, 2));
  process.exit(1);
}

const invalidNames = ["../spritesheet.webp", "nested/spritesheet.webp", "nested\\spritesheet.webp", "sprite..webp"];
const acceptedInvalid = invalidNames.filter(isRootFileName);
if (acceptedInvalid.length > 0) {
  console.error(JSON.stringify({ ok: false, reason: "unsafe spritesheetPath accepted", acceptedInvalid }, null, 2));
  process.exit(1);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "petpack-qa-"));
try {
  const badIdDir = path.join(tempRoot, "bad-id");
  fs.mkdirSync(badIdDir);
  fs.writeFileSync(
    path.join(badIdDir, "pet.json"),
    JSON.stringify({ id: "other-id", displayName: "Bad", spritesheetPath: "spritesheet.webp" })
  );
  fs.writeFileSync(path.join(badIdDir, "spritesheet.webp"), makeVp8xWebp(1536, 1872));

  const badPathDir = path.join(tempRoot, "bad-path");
  fs.mkdirSync(badPathDir);
  fs.writeFileSync(
    path.join(badPathDir, "pet.json"),
    JSON.stringify({ id: "bad-path", displayName: "Bad Path", spritesheetPath: "../spritesheet.webp" })
  );

  const negativeReport = validatePetResources(tempRoot);
  const negativeErrors = negativeReport.errors.flatMap((entry) => entry.errors);
  const requiredErrors = ["pet.json id must match directory name", "spritesheetPath must be a root-level file name"];
  const missingErrors = requiredErrors.filter((text) => !negativeErrors.some((error) => error.includes(text)));
  if (negativeReport.ok || missingErrors.length > 0) {
    console.error(JSON.stringify({ ok: false, reason: "negative QA checks failed", missingErrors, negativeReport }, null, 2));
    process.exit(1);
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, petCount: report.pets.length }, null, 2));
