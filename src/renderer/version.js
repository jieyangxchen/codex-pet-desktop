export function cleanVersion(value) {
  return String(value || "")
    .trim()
    .replace(/^v/i, "")
    .split(/[+-]/)[0];
}

export function versionParts(value) {
  return cleanVersion(value)
    .split(".")
    .slice(0, 3)
    .map((part) => {
      const match = part.match(/^\d+/);
      return match ? Number(match[0]) : 0;
    });
}

export function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

export function summarizePetpackUpdates(localPets, remotePetpacks) {
  const localById = new Map((localPets || []).map((pet) => [pet.id, pet]));
  const upgrades = [];
  const missing = [];

  for (const remote of remotePetpacks || []) {
    if (!remote?.id) {
      continue;
    }
    const local = localById.get(remote.id);
    if (!local) {
      missing.push(remote);
      continue;
    }
    if (remote.version && compareVersions(remote.version, local.version) > 0) {
      upgrades.push({ local, remote });
    }
  }

  if (upgrades.length) {
    const first = upgrades[0];
    const name = first.remote.displayName || first.remote.id;
    const more = upgrades.length > 1 ? `，另有 ${upgrades.length - 1} 个资源可更新` : "";
    return {
      kind: "upgrade",
      message: `${name}有新资源 v${first.remote.version}，当前 v${
        first.local.version || "unknown"
      }${more}。点击 Open Downloads 下载后手动导入。`
    };
  }

  if (missing.length) {
    return {
      kind: "missing",
      message: `下载页有 ${missing.length} 个未安装宠物资源。点击 Open Downloads 下载后手动导入。`
    };
  }

  return {
    kind: "current",
    message: "宠物资源已是当前下载页版本。"
  };
}
