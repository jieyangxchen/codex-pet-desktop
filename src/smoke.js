const path = require("node:path");
const { validatePetResources } = require("../scripts/qa-petpack-assets");

const projectRoot = path.resolve(__dirname, "..");
const roots = [path.join(projectRoot, "resources", "pets")];
const report = validatePetResources(roots[0]);
const bundledPets = new Map(report.pets.map((pet) => [pet.id, pet]));
const requiredPets = ["mi-fen", "mi-jiu", "tigris-whippet"];
const requiredDisplayNames = {
  "mi-fen": "米粉",
  "mi-jiu": "米酒",
  "tigris-whippet": "红糖"
};
const missingPets = requiredPets.filter((id) => !bundledPets.has(id));

if (missingPets.length > 0) {
  console.error(JSON.stringify({ ok: false, roots, missingPets, report }, null, 2));
  process.exit(1);
}

const displayNameErrors = requiredPets
  .filter((id) => bundledPets.get(id).displayName !== requiredDisplayNames[id])
  .map((id) => ({ id, actual: bundledPets.get(id).displayName, expected: requiredDisplayNames[id] }));
if (displayNameErrors.length > 0) {
  console.error(JSON.stringify({ ok: false, displayNameErrors }, null, 2));
  process.exit(1);
}

if (!report.ok) {
  console.error(JSON.stringify({ ok: false, report }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      roots,
      petCount: report.pets.length,
      pets: requiredPets.map((id) => {
        const pet = bundledPets.get(id);
        return {
          id: pet.id,
          displayName: pet.displayName,
          spritesheet: pet.spritesheet
        };
      }),
      expected: report.expected,
      errors: report.errors
    },
    null,
    2
  )
);
