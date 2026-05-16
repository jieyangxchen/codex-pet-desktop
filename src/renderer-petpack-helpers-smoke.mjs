import {
  friendlyPetpackError,
  importConfirmLabel,
  importPreviewMessage
} from "./renderer/petpack.js";
import { summarizePetpackUpdates } from "./renderer/version.js";

const errors = [];

if (!friendlyPetpackError(new Error("Missing required petpack file: pet.json")).includes("pet.json")) {
  errors.push("missing pet.json error not friendly");
}
if (!friendlyPetpackError(new Error("Pet id mismatch: a b")).includes("id 不一致")) {
  errors.push("id mismatch error not friendly");
}

const upgradePreview = {
  id: "mi-fen",
  displayName: "米粉",
  version: "1.0.2",
  existingManagedVersion: "1.0.1",
  existingVisibleVersion: "1.0.1",
  willReplaceManaged: true,
  versionRelation: "upgrade"
};
if (!importPreviewMessage(upgradePreview).includes("1.0.1") || !importConfirmLabel(upgradePreview).includes("Replace")) {
  errors.push("upgrade preview text invalid");
}

const summary = summarizePetpackUpdates(
  [{ id: "mi-fen", displayName: "米粉", version: "1.0.1" }],
  [
    { id: "mi-fen", displayName: "米粉", version: "1.0.2" },
    { id: "mi-jiu", displayName: "米酒", version: "1.0.0" }
  ]
);
if (summary.kind !== "upgrade" || !summary.message.includes("米粉") || !summary.message.includes("v1.0.2")) {
  errors.push("petpack update summary invalid");
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, summary }, null, 2));
