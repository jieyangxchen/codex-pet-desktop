#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_ATLAS_WIDTH = 1536;
const EXPECTED_ATLAS_HEIGHT = 1872;
const DEFAULT_ROOT = path.resolve(__dirname, "..");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function parseVp8LossySize(payload) {
  for (let index = 0; index <= payload.length - 10; index += 1) {
    if (payload[index] === 0x9d && payload[index + 1] === 0x01 && payload[index + 2] === 0x2a) {
      return {
        width: payload.readUInt16LE(index + 3) & 0x3fff,
        height: payload.readUInt16LE(index + 5) & 0x3fff
      };
    }
  }
  throw new Error("Could not find VP8 frame header");
}

function parseVp8LosslessSize(payload) {
  if (payload[0] !== 0x2f) {
    throw new Error("Invalid VP8L signature");
  }
  const bits = payload.readUInt32LE(1);
  return {
    width: (bits & 0x3fff) + 1,
    height: ((bits >> 14) & 0x3fff) + 1
  };
}

function parseWebpSize(buffer) {
  if (buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("Not a WebP RIFF file");
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + chunkSize;
    if (payloadEnd > buffer.length) {
      throw new Error(`Invalid WebP chunk size for ${chunkType}`);
    }

    const payload = buffer.subarray(payloadStart, payloadEnd);
    if (chunkType === "VP8X") {
      if (payload.length < 10) {
        throw new Error("Invalid VP8X chunk");
      }
      return {
        width: readUInt24LE(payload, 4) + 1,
        height: readUInt24LE(payload, 7) + 1
      };
    }
    if (chunkType === "VP8 ") {
      return parseVp8LossySize(payload);
    }
    if (chunkType === "VP8L") {
      return parseVp8LosslessSize(payload);
    }

    offset = payloadEnd + (chunkSize % 2);
  }

  throw new Error("Missing WebP image chunk");
}

function isRootFileName(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === path.basename(value) &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("..")
  );
}

function validatePetResources(petsRoot, options = {}) {
  const expectedWidth = options.expectedWidth || EXPECTED_ATLAS_WIDTH;
  const expectedHeight = options.expectedHeight || EXPECTED_ATLAS_HEIGHT;
  const pets = [];
  const errors = [];

  const entries = fs.existsSync(petsRoot)
    ? fs.readdirSync(petsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const petDir = path.join(petsRoot, entry.name);
    const manifestPath = path.join(petDir, "pet.json");
    const petReport = {
      id: entry.name,
      ok: true,
      displayName: "",
      version: "",
      spritesheet: "",
      width: 0,
      height: 0,
      errors: []
    };

    try {
      if (!fs.existsSync(manifestPath)) {
        throw new Error("Missing pet.json");
      }
      const manifest = readJson(manifestPath);
      petReport.id = manifest.id || entry.name;
      petReport.displayName = manifest.displayName || manifest.name || "";
      petReport.version = manifest.version || "1.0.0";
      if (!petReport.id) {
        petReport.errors.push("pet.json id is required");
      } else if (petReport.id !== entry.name) {
        petReport.errors.push(`pet.json id must match directory name: expected ${entry.name}, got ${petReport.id}`);
      }
      if (!petReport.displayName) {
        petReport.errors.push("pet.json displayName is required");
      }

      const spritesheet = manifest.spritesheetPath || "spritesheet.webp";
      petReport.spritesheet = spritesheet;
      if (!isRootFileName(spritesheet)) {
        petReport.errors.push("spritesheetPath must be a root-level file name without /, \\, or ..");
      } else if (!fs.existsSync(path.join(petDir, spritesheet))) {
        petReport.errors.push(`Missing spritesheet: ${spritesheet}`);
      } else {
        const spritesheetPath = path.join(petDir, spritesheet);
        const size = parseWebpSize(fs.readFileSync(spritesheetPath));
        petReport.width = size.width;
        petReport.height = size.height;
        if (size.width !== expectedWidth || size.height !== expectedHeight) {
          petReport.errors.push(
            `Expected spritesheet ${expectedWidth}x${expectedHeight}, got ${size.width}x${size.height}`
          );
        }
      }
    } catch (error) {
      petReport.errors.push(error.message);
    }

    petReport.ok = petReport.errors.length === 0;
    if (!petReport.ok) {
      errors.push({ id: petReport.id, errors: petReport.errors });
    }
    pets.push(petReport);
  }

  return {
    ok: errors.length === 0,
    expected: {
      width: expectedWidth,
      height: expectedHeight,
      columns: 8,
      rows: 9,
      cellWidth: 192,
      cellHeight: 208
    },
    pets,
    errors
  };
}

function writeQaReport(report, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
}

function main() {
  const root = DEFAULT_ROOT;
  const petsRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "resources", "pets");
  const outFile = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, "release", "petpacks", "qa.json");
  const report = validatePetResources(petsRoot);
  writeQaReport(report, outFile);
  if (!report.ok) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, petCount: report.pets.length, outFile }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  isRootFileName,
  parseWebpSize,
  validatePetResources,
  writeQaReport
};
