export async function readFileAsBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function friendlyPetpackError(error) {
  const message = String(error?.message || error || "");
  if (/invalid zip|not a zip|Invalid archive|zip/i.test(message)) {
    return "这不是有效的 .petpack 文件。";
  }
  if (message.includes("pet.json")) {
    return "资源包缺少 pet.json，或 pet.json 内容不合法。";
  }
  if (message.includes("spritesheet.webp") || message.includes("spritesheet")) {
    return "资源包缺少图集文件 spritesheet.webp。";
  }
  if (message.includes("Unsupported petpack format version")) {
    return "资源包版本不受当前主程序支持。";
  }
  if (message.includes("Unsupported petpack format")) {
    return "资源包格式不受支持。";
  }
  if (message.includes("Pet id mismatch")) {
    return "petpack.json 和 pet.json 的宠物 id 不一致。";
  }
  if (message.includes("Invalid pet id")) {
    return "宠物 id 只能包含英文字母、数字、短横线或下划线。";
  }
  return message || "导入资源包失败。";
}

export function importPreviewMessage(preview) {
  const name = preview.displayName || preview.id;
  const version = preview.version || "unknown";
  const existing = preview.existingManagedVersion || preview.existingVisibleVersion || "";
  const source = preview.existingVisibleSourceKind || "";

  if (preview.versionRelation === "upgrade") {
    return `将覆盖 ${name}: v${existing || "unknown"} -> v${version}。`;
  }
  if (preview.versionRelation === "same") {
    return `已安装同版本 ${name} v${version}，继续会重新覆盖资源文件。`;
  }
  if (preview.versionRelation === "downgrade") {
    return `当前是 v${existing || "unknown"}，选择的 ${name} 是 v${version}，继续会降级。`;
  }
  if (preview.willReplaceManaged) {
    return `将覆盖 ${name}，新版本为 v${version}。`;
  }
  if (source && source !== "managed") {
    return `检测到同 id 宠物来自 ${source}，导入 ${name} v${version} 到应用数据后可能不会优先显示。`;
  }
  return `将导入 ${name} v${version}。`;
}

export function importConfirmLabel(preview) {
  if (!preview) {
    return "Import";
  }
  if (preview.versionRelation === "downgrade") {
    return "Confirm Downgrade";
  }
  if (preview.willReplaceManaged || preview.existingVisibleVersion) {
    return "Confirm Replace";
  }
  return "Confirm Import";
}
