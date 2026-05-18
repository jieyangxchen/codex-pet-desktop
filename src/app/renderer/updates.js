import { arrayBufferToBase64 } from "./petpack.js";
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

function progressText(received, total) {
  if (total > 0) {
    const percent = Math.max(0, Math.min(100, Math.floor((received / total) * 100)));
    return `正在下载主程序安装包... ${percent}%`;
  }
  const downloaded = formatBytes(received);
  return downloaded ? `正在下载主程序安装包... ${downloaded}` : "正在下载主程序安装包...";
}

async function readResponseBuffer(response, onProgress) {
  const total = Number(response.headers?.get?.("content-length")) || 0;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    onProgress(received, total);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      chunks.push(chunk);
      received += chunk.byteLength;
      onProgress(received, total);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes.buffer;
  }
  const buffer = await response.arrayBuffer();
  onProgress(buffer.byteLength, buffer.byteLength || total);
  return buffer;
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
  async function checkForUpdates() {
    if (!state.appInfo.latestReleaseApi || typeof fetch !== "function") {
      setUpdateStatus("检查更新不可用。");
      return;
    }
    dom.checkUpdateButton.disabled = true;
    setUpdateStatus("正在检查主程序更新...");
    try {
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
      if (compareVersions(latestTag, state.appInfo.version) > 0) {
        const notes = String(latest.body || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 2)
          .join("；");
        const noteText = notes ? `更新内容：${notes}。` : "";
        const asset = findInstallerAsset(latest, state.appInfo.platform);
        if (!asset || !petDesktop?.installAppUpdate) {
          setUpdateStatus(
            `发现主程序新版本：当前 v${cleanVersion(state.appInfo.version)}，最新 ${latestTag}。${noteText}没有找到可自动安装的安装包，请点击“打开下载页”下载。`
          );
          return;
        }
        setProgress(dom.appUpdateProgressEl, { visible: true, received: 0, total: Number(asset.size) || 0 });
        setUpdateStatus(
          `发现主程序新版本：当前 v${cleanVersion(state.appInfo.version)}，最新 ${latestTag}。${noteText}正在准备自动更新...`
        );
        const installerResponse = await fetch(asset.browser_download_url, {
          headers: { Accept: "application/octet-stream" }
        });
        if (!installerResponse.ok) {
          throw new Error(`安装包下载失败 HTTP ${installerResponse.status}`);
        }
        const buffer = await readResponseBuffer(installerResponse, (received, responseTotal) => {
          const total = responseTotal || Number(asset.size) || 0;
          setProgress(dom.appUpdateProgressEl, { visible: true, received, total });
          setUpdateStatus(progressText(received, total));
        });
        setUpdateStatus("正在启动安装器...");
        await petDesktop.installAppUpdate(arrayBufferToBase64(buffer), asset.name);
        setUpdateStatus("已启动安装器，请按提示完成安装。");
        return;
      }
      setUpdateStatus(`主程序已是最新版本 v${cleanVersion(state.appInfo.version)}。`);
    } catch (error) {
      setUpdateStatus(`检查主程序更新失败：${error.message}`);
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
      setUpdateStatus(`检查宠物资源更新失败：${error.message}`);
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
        .catch((error) => setUpdateStatus(`打开下载页失败：${error.message}`));
    });
  }

  return {
    bind,
    checkForUpdates,
    checkPetpackUpdates
  };
}
