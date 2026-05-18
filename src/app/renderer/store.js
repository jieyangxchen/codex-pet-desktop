import { arrayBufferToBase64, friendlyPetpackError } from "./petpack.js";
import { compareVersions } from "./version.js";

function resolvePetpackAssetUrl(indexUrl, fileName) {
  if (!indexUrl || !fileName) {
    return "";
  }
  return new URL(fileName, indexUrl).href;
}

function localPetFor(remote, localPets) {
  return (localPets || []).find((pet) => pet.id === remote?.id);
}

function actionLabel(remote, local, appVersion) {
  if (!isCompatible(remote, appVersion)) {
    return "需要更新主程序";
  }
  if (!local) {
    return "安装";
  }
  if (remote.version && compareVersions(remote.version, local.version) > 0) {
    return "更新";
  }
  return "重新安装";
}

function remoteVersionLabel(remote) {
  return remote?.version ? `v${remote.version}` : "未标版本";
}

function localVersionLabel(local) {
  return local?.version ? `当前 v${local.version}` : "未安装";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  return `${Number.isInteger(kb) ? kb : kb.toFixed(1)} KB`;
}

function normalizeTags(remote) {
  return Array.isArray(remote?.tags) ? remote.tags.filter(Boolean) : [];
}

function changelogEntries(remote) {
  if (Array.isArray(remote?.changelog)) {
    return remote.changelog.filter(Boolean);
  }
  return typeof remote?.changelog === "string" && remote.changelog.trim() ? [remote.changelog.trim()] : [];
}

function isCompatible(remote, appVersion = window.petDesktopAppVersion || "0.0.0") {
  return !remote?.minAppVersion || compareVersions(appVersion, remote.minAppVersion) >= 0;
}

function hasUpdate(remote, local, appVersion) {
  return Boolean(local && isCompatible(remote, appVersion) && remote.version && compareVersions(remote.version, local.version) > 0);
}

function storeFilter(remote, local, selectedFilter, appVersion) {
  const updateAvailable = hasUpdate(remote, local, appVersion);
  if (selectedFilter === "updates") {
    return updateAvailable;
  }
  if (selectedFilter === "installed") {
    return Boolean(local);
  }
  if (selectedFilter === "uninstalled") {
    return !local;
  }
  return true;
}

function matchesSearch(remote, search) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }
  const haystack = [
    remote.id,
    remote.displayName,
    remote.description,
    ...(normalizeTags(remote))
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function matchesTag(remote, tag) {
  return !tag || tag === "all" || normalizeTags(remote).includes(tag);
}

async function sha256Hex(buffer) {
  const subtle = globalThis.crypto?.subtle || window.crypto?.subtle;
  if (!subtle) {
    throw new Error("当前运行环境不支持 SHA-256 校验。");
  }
  const digest = await subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createStoreController({ dom, petDesktop, refreshPetList, state }) {
  let remotePetpacks = [];
  let loading = false;

  function setStoreStatus(message) {
    if (dom.petStoreStatusEl) {
      dom.petStoreStatusEl.textContent = message || "";
    }
  }

  function setStoreProgress({ visible = false, received = 0, total = 0 } = {}) {
    if (!dom.petStoreProgressEl) {
      return;
    }
    dom.petStoreProgressEl.classList.toggle("hidden", !visible);
    if (!visible) {
      dom.petStoreProgressEl.max = 1;
      dom.petStoreProgressEl.value = 0;
      dom.petStoreProgressEl.removeAttribute?.("aria-valuetext");
      return;
    }
    if (total > 0) {
      dom.petStoreProgressEl.max = total;
      dom.petStoreProgressEl.value = Math.min(received, total);
      dom.petStoreProgressEl.removeAttribute?.("aria-valuetext");
      return;
    }
    dom.petStoreProgressEl.removeAttribute?.("max");
    dom.petStoreProgressEl.removeAttribute?.("value");
    dom.petStoreProgressEl.setAttribute?.("aria-valuetext", received > 0 ? `已下载 ${formatBytes(received)}` : "正在下载");
  }

  function progressStatus(name, received, total) {
    if (total > 0) {
      const percent = Math.max(0, Math.min(100, Math.floor((received / total) * 100)));
      return `正在下载 ${name}... ${percent}%`;
    }
    const downloaded = formatBytes(received);
    return downloaded ? `正在下载 ${name}... ${downloaded}` : `正在下载 ${name}...`;
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
    onProgress(buffer.byteLength, buffer.byteLength);
    return buffer;
  }

  function appVersion() {
    return state.appInfo.version || "0.0.0";
  }

  function renderTagOptions() {
    if (!dom.storeTagFilter) {
      return;
    }
    const selected = dom.storeTagFilter.value || "all";
    const tags = [...new Set(remotePetpacks.flatMap(normalizeTags))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    const options = [
      ["all", "全部分类"],
      ...tags.map((tag) => [tag, tag])
    ].map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    });
    dom.storeTagFilter.replaceChildren(...options);
    dom.storeTagFilter.value = tags.includes(selected) ? selected : "all";
  }

  function visiblePetpacks() {
    const selectedFilter = dom.storeFilter?.value || "all";
    const selectedTag = dom.storeTagFilter?.value || "all";
    const search = dom.storeSearch?.value || "";
    return remotePetpacks.filter((remote) => {
      const local = localPetFor(remote, state.pets);
      return (
        storeFilter(remote, local, selectedFilter, appVersion()) &&
        matchesTag(remote, selectedTag) &&
        matchesSearch(remote, search)
      );
    });
  }

  function renderStore() {
    if (!dom.petStoreListEl) {
      return;
    }
    renderTagOptions();
    const pets = visiblePetpacks();
    if (!pets.length) {
      const empty = document.createElement("div");
      empty.className = "pet-store-empty";
      empty.textContent = loading ? "正在载入资源库..." : "当前筛选下没有宠物包。";
      dom.petStoreListEl.replaceChildren(empty);
      return;
    }

    dom.petStoreListEl.replaceChildren(
      ...pets.map((remote) => {
        const local = localPetFor(remote, state.pets);
        const compatible = isCompatible(remote, appVersion());
        const card = document.createElement("article");
        card.className = "pet-store-card";

        const preview = document.createElement("div");
        preview.className = "pet-store-preview";
        const previewUrl = resolvePetpackAssetUrl(state.appInfo.petpackIndexUrl, remote.previewAtlas);
        if (previewUrl) {
          preview.style.backgroundImage = `url("${previewUrl}")`;
        }
        preview.setAttribute("aria-label", `${remote.displayName || remote.id} 预览`);

        const body = document.createElement("div");
        body.className = "pet-store-body";
        const title = document.createElement("div");
        title.className = "pet-store-title";
        title.textContent = remote.displayName || remote.id;
        const meta = document.createElement("div");
        meta.className = "pet-store-meta";
        meta.textContent = `${remoteVersionLabel(remote)} · ${localVersionLabel(local)}`;
        const description = document.createElement("div");
        description.className = "pet-store-description";
        description.textContent = remote.description || "暂无描述";
        const details = document.createElement("div");
        details.className = "pet-store-details";
        const tags = normalizeTags(remote);
        const compatibility = compatible ? "" : `需要主程序 v${remote.minAppVersion} 或更高版本`;
        const hash = remote.sha256 ? `sha256 ${String(remote.sha256).slice(0, 8)}` : "";
        const parts = [
          formatBytes(remote.sizeBytes),
          remote.updatedAt,
          remote.author ? `作者 ${remote.author}` : "",
          remote.license,
          remote.minAppVersion ? `最低主程序 v${remote.minAppVersion}` : "",
          tags.length ? tags.join(" · ") : "",
          changelogEntries(remote)[0] ? `更新说明：${changelogEntries(remote)[0]}` : "",
          hash,
          compatibility
        ].filter(Boolean);
        details.textContent = parts.join(" · ");
        body.append(title, meta, description, details);

        const install = document.createElement("button");
        install.type = "button";
        install.textContent = actionLabel(remote, local, appVersion());
        install.disabled = !compatible;
        install.addEventListener("click", () => {
          installFromStore(remote, install).catch((error) => setStoreStatus(friendlyPetpackError(error)));
        });

        card.append(preview, body, install);
        return card;
      })
    );
  }

  async function loadStore() {
    if (!state.appInfo.petpackIndexUrl || typeof fetch !== "function") {
      setStoreStatus("资源库不可用。");
      return;
    }
    loading = true;
    dom.refreshStoreButton.disabled = true;
    setStoreStatus("正在刷新资源库...");
    renderStore();
    try {
      const response = await fetch(state.appInfo.petpackIndexUrl, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      remotePetpacks = (await response.json()).filter((petpack) => petpack?.id && petpack?.fileName);
      setStoreStatus(`已载入 ${remotePetpacks.length} 个宠物包。`);
      renderStore();
    } catch (error) {
      setStoreStatus(`刷新资源库失败：${error.message}`);
    } finally {
      loading = false;
      dom.refreshStoreButton.disabled = false;
      renderStore();
    }
  }

  async function installFromStore(remote, button) {
    const url = resolvePetpackAssetUrl(state.appInfo.petpackIndexUrl, remote.fileName);
    if (!url) {
      throw new Error("资源包下载地址缺失。");
    }
    button.disabled = true;
    const local = localPetFor(remote, state.pets);
    const action = actionLabel(remote, local, appVersion());
    const name = remote.displayName || remote.id;
    setStoreStatus(`正在${action} ${name}...`);
    setStoreProgress({ visible: true, received: 0, total: Number(remote.sizeBytes) || 0 });
    try {
      if (!isCompatible(remote, appVersion())) {
        throw new Error(`需要主程序 v${remote.minAppVersion} 或更高版本。`);
      }
      const response = await fetch(url, { headers: { Accept: "application/octet-stream" } });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buffer = await readResponseBuffer(response, (received, responseTotal) => {
        const total = responseTotal || Number(remote.sizeBytes) || 0;
        setStoreProgress({ visible: true, received, total });
        setStoreStatus(progressStatus(name, received, total));
      });
      setStoreStatus(`正在校验 ${name}...`);
      if (remote.sha256) {
        const actual = await sha256Hex(buffer);
        if (actual !== remote.sha256) {
          throw new Error("资源包 SHA-256 校验失败。");
        }
      }
      const data = arrayBufferToBase64(buffer);
      setStoreStatus(`正在安装 ${name}...`);
      const preview = await petDesktop.inspectPetpack(data);
      if (preview.id !== remote.id) {
        throw new Error(`资源索引和宠物包 id 不一致：${remote.id} / ${preview.id}`);
      }
      const result = await petDesktop.importPetpack(data);
      refreshPetList(result.pets, result.importedPetId);
      renderStore();
      const done = action === "重新安装" ? "已重新安装" : result.replaced ? "已更新" : "已安装";
      setStoreStatus(`${done} ${result.displayName || result.importedPetId}。`);
      return true;
    } catch (error) {
      setStoreStatus(`${action}失败：${friendlyPetpackError(error)}。可以打开下载页手动下载。`);
      return false;
    } finally {
      setStoreProgress({ visible: false });
      button.disabled = false;
    }
  }

  async function updateAllPetpacks() {
    const updates = remotePetpacks.filter((remote) => hasUpdate(remote, localPetFor(remote, state.pets), appVersion()));
    if (!updates.length) {
      setStoreStatus("当前没有可更新的宠物包。");
      return;
    }
    dom.updateAllPetpacksButton.disabled = true;
    let updated = 0;
    for (const remote of updates) {
      const ok = await installFromStore(remote, dom.updateAllPetpacksButton);
      if (ok) {
        updated += 1;
      }
    }
    setStoreStatus(`已更新 ${updated}/${updates.length} 个宠物包。`);
    dom.updateAllPetpacksButton.disabled = false;
  }

  function openStore() {
    dom.petStoreEl?.scrollIntoView?.({ block: "start" });
    return loadStore();
  }

  function bind() {
    dom.refreshStoreButton?.addEventListener("click", () => {
      loadStore();
    });
    dom.storeFilter?.addEventListener("change", renderStore);
    dom.storeTagFilter?.addEventListener("change", renderStore);
    dom.storeSearch?.addEventListener("input", renderStore);
    dom.updateAllPetpacksButton?.addEventListener("click", () => {
      updateAllPetpacks().catch((error) => setStoreStatus(friendlyPetpackError(error)));
    });
  }

  return {
    bind,
    loadStore,
    openStore,
    renderStore
  };
}
