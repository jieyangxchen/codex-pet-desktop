import { cleanVersion, compareVersions, summarizePetpackUpdates } from "./version.js";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  }
  const kb = bytes / 1024;
  return `${Number.isInteger(kb) ? kb : kb.toFixed(1)} KB`;
}

function setProgress(progressEl, { visible = false, received = 0, total = 0 } = {}) {
  if (!progressEl) {
    return;
  }
  progressEl.classList.toggle("hidden", !visible);
  if (!visible) {
    progressEl.max = 1;
    progressEl.value = 0;
    progressEl.removeAttribute?.("aria-valuetext");
    return;
  }
  if (total > 0) {
    progressEl.max = total;
    progressEl.value = Math.min(received, total);
    progressEl.removeAttribute?.("aria-valuetext");
    return;
  }
  progressEl.removeAttribute?.("max");
  progressEl.removeAttribute?.("value");
  progressEl.setAttribute?.("aria-valuetext", received > 0 ? `已下载 ${formatBytes(received)}` : "正在下载");
}

function errorMessage(error) {
  if (error?.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error === undefined || error === null) {
    return "未知错误";
  }
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
}

function assetScore(asset, platform = "") {
  const name = String(asset?.name || "").toLowerCase();
  if (!asset?.browser_download_url || !name) {
    return -1;
  }
  if (/windows|win32|win64|win/i.test(platform)) {
    return name.endsWith(".exe") && name.includes("windows") ? 3 : name.endsWith(".exe") ? 2 : -1;
  }
  if (/mac|darwin|osx/i.test(platform)) {
    return name.endsWith(".dmg") && name.includes("macos") ? 3 : name.endsWith(".dmg") ? 2 : -1;
  }
  if (name.endsWith(".exe") || name.endsWith(".dmg")) {
    return 1;
  }
  return -1;
}

function findInstallerAsset(release, platform) {
  return (release?.assets || [])
    .filter((asset) => assetScore(asset, platform) >= 0)
    .sort((left, right) => assetScore(right, platform) - assetScore(left, platform))[0];
}

export function createUpdateController({ dom, petDesktop, setUpdateStatus, state }) {
  async function fetchLatestRelease() {
    const response = await fetch(state.appInfo.latestReleaseApi, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const latest = await response.json();
    const latestTag = latest.tag_name || latest.name || "";
    if (!latestTag) {
      throw new Error("最新版本号缺失");
    }
    return { latest, latestTag };
  }

  async function checkForUpdates() {
    if (!state.appInfo.latestReleaseApi || typeof fetch !== "function") {
      setUpdateStatus("检查更新不可用。");
      return;
    }
    dom.checkUpdateButton.disabled = true;
    setUpdateStatus("正在检查主程序更新...");
    try {
      let release;
      try {
        release = await fetchLatestRelease();
      } catch (error) {
        setUpdateStatus(`检查主程序版本失败：${errorMessage(error)}`);
        return;
      }
      const { latest, latestTag } = release;
      if (compareVersions(latestTag, state.appInfo.version) > 0) {
        const notes = String(latest.body || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 2)
          .join("；");
        const noteText = notes ? `更新内容：${notes}。` : "";
        const asset = findInstallerAsset(latest, state.appInfo.platform);
        if (!asset || !petDesktop?.downloadAndInstallAppUpdate) {
          setUpdateStatus(
            `发现主程序新版本：当前 v${cleanVersion(state.appInfo.version)}，最新 ${latestTag}。${noteText}没有找到可自动安装的安装包，请点击“打开下载页”下载。`
          );
          return;
        }
        setUpdateStatus(
          `发现主程序新版本：当前 v${cleanVersion(state.appInfo.version)}，最新 ${latestTag}。${noteText}正在下载并启动安装包...`
        );
        try {
          await petDesktop.downloadAndInstallAppUpdate(asset.browser_download_url, asset.name);
        } catch (error) {
          setUpdateStatus(`下载或启动主程序安装包失败：${errorMessage(error)}。可以点击“打开下载页”手动下载。`);
          return;
        }
        setUpdateStatus("已启动安装器，请按提示完成安装。");
        return;
      }
      setUpdateStatus(`主程序已是最新版本 v${cleanVersion(state.appInfo.version)}。`);
    } catch (error) {
      setUpdateStatus(`检查主程序版本失败：${errorMessage(error)}`);
    } finally {
      setProgress(dom.appUpdateProgressEl, { visible: false });
      dom.checkUpdateButton.disabled = false;
    }
  }

  async function checkPetpackUpdates() {
    if (!state.appInfo.petpackIndexUrl || typeof fetch !== "function") {
      setUpdateStatus("宠物资源更新检查不可用。");
      return;
    }
    dom.checkPetpackUpdatesButton.disabled = true;
    setUpdateStatus("正在检查宠物资源更新...");
    try {
      const response = await fetch(state.appInfo.petpackIndexUrl, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const remotePetpacks = await response.json();
      setUpdateStatus(summarizePetpackUpdates(state.pets, remotePetpacks, state.appInfo.version).message);
    } catch (error) {
      setUpdateStatus(`检查宠物资源更新失败：${errorMessage(error)}`);
    } finally {
      dom.checkPetpackUpdatesButton.disabled = false;
    }
  }

  function bind() {
    dom.checkUpdateButton?.addEventListener("click", () => {
      checkForUpdates();
    });
    dom.checkPetpackUpdatesButton?.addEventListener("click", () => {
      checkPetpackUpdates();
    });
    dom.openDownloadsButton?.addEventListener("click", () => {
      petDesktop
        ?.openDownloads?.()
        .then(() => setUpdateStatus("已打开下载页。"))
        .catch((error) => setUpdateStatus(`打开下载页失败：${errorMessage(error)}`));
    });
  }

  return {
    bind,
    checkForUpdates,
    checkPetpackUpdates
  };
}
