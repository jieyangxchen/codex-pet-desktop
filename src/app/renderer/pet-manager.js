import { resolveSpritesheetSource } from "./bridge.js";

function versionLabel(pet) {
  return pet?.version ? pet.version : "未标版本";
}

function sourceLabel(sourceKind) {
  return (
    {
      managed: "应用内导入",
      external: "外部目录",
      bundled: "开发资源",
      codex: "Codex 目录"
    }[sourceKind] || "外部目录"
  );
}

export function createPetManager({
  animation,
  dom,
  petDesktop,
  scheduleWander,
  setPetStatus,
  state,
  stopWander,
  syncWindowLayout = () => {},
  tauriConvertFileSrc
}) {
  function pickPet(id) {
    state.activePet = state.pets.find((pet) => pet.id === id) || state.pets[0];
    if (!state.activePet) {
      stopWander();
      dom.petEl.style.backgroundImage = "";
      dom.petEl.setAttribute("aria-label", "未安装宠物");
      dom.petEl.textContent = "";
      dom.petEl.classList.add("empty");
      const panelVisible = !dom.panelEl.classList.contains("hidden");
      dom.emptyStateEl.classList.toggle("hidden", panelVisible);
      syncWindowLayout({ centerIfEmpty: !panelVisible }).catch?.(() => {});
      return;
    }
    dom.petEl.classList.remove("empty");
    dom.emptyStateEl.classList.add("hidden");
    const source = resolveSpritesheetSource(state.activePet, tauriConvertFileSrc);
    dom.petEl.style.backgroundImage = source ? `url("${source}")` : "";
    dom.petEl.textContent = "";
    dom.petEl.setAttribute("aria-label", state.activePet.displayName);
    dom.petSelect.value = state.activePet.id;
    animation.setState("idle");
    syncWindowLayout().catch?.(() => {});
    scheduleWander();
  }

  function renderPetOptions() {
    dom.petSelect.replaceChildren(
      ...state.pets.map((pet) => {
        const option = document.createElement("option");
        option.value = pet.id;
        option.textContent = pet.displayName;
        return option;
      })
    );
  }

  function renderPetManager() {
    if (!dom.petManagerEl) {
      return;
    }
    if (!state.pets.length) {
      const empty = document.createElement("div");
      empty.className = "pet-manager-empty";
      empty.textContent = "还没有安装宠物。";
      dom.petManagerEl.replaceChildren(empty);
      return;
    }
    dom.petManagerEl.replaceChildren(
      ...state.pets.map((pet) => {
        const row = document.createElement("article");
        row.className = "pet-manager-row";

        const title = document.createElement("div");
        title.className = "pet-manager-title";
        const name = document.createElement("span");
        name.textContent = pet.displayName;
        const version = document.createElement("span");
        version.textContent = versionLabel(pet);
        title.append(name, version);

        const meta = document.createElement("div");
        meta.className = "pet-manager-meta";
        meta.textContent = `${pet.id} · ${sourceLabel(pet.sourceKind)}`;

        const actions = document.createElement("div");
        actions.className = "pet-manager-actions";
        const reveal = document.createElement("button");
        reveal.type = "button";
        reveal.textContent = "打开目录";
        reveal.addEventListener("click", () => {
          petDesktop?.revealPet?.(pet.id).catch((error) => setPetStatus(error.message));
        });
        const uninstall = document.createElement("button");
        uninstall.type = "button";
        uninstall.textContent = "卸载";
        uninstall.disabled = !pet.canUninstall;
        uninstall.addEventListener("click", () => {
          uninstallPet(pet).catch((error) => setPetStatus(error.message));
        });
        actions.append(reveal, uninstall);

        row.append(title, meta, actions);
        return row;
      })
    );
  }

  function refreshPetList(result, preferredPetId) {
    state.pets = result.pets || [];
    renderPetOptions();
    renderPetManager();
    pickPet(preferredPetId || state.pets[0]?.id);
    if (result.errors?.length) {
      setPetStatus(`已跳过 ${result.errors.length} 个无效宠物目录。`);
    }
  }

  async function uninstallPet(pet) {
    if (!pet?.canUninstall) {
      setPetStatus("只能在这里卸载应用内导入的宠物包。");
      return;
    }
    const result = await petDesktop.uninstallPet(pet.id);
    setPetStatus(`已卸载 ${pet.displayName}`);
    refreshPetList(result, state.activePet?.id === pet.id ? undefined : state.activePet?.id);
  }

  return {
    pickPet,
    refreshPetList
  };
}
