#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function petCard(pet) {
  const displayName = escapeHtml(pet.displayName || pet.id);
  const description = escapeHtml(pet.description || "宠物资源包。");
  const version = escapeHtml(pet.version || "1.0.0");
  const fileName = escapeHtml(pet.fileName);
  const previewAtlas = escapeHtml(pet.previewAtlas || "");
  const visualQaHref = `./petpacks/visual-qa.html#${encodeURIComponent(pet.id || "")}`;
  const previewStyle = previewAtlas ? ` style="background-image: url('./petpacks/${previewAtlas}')"` : "";
  return `          <article class="download pet-download">
            <div class="pet-preview"${previewStyle} aria-label="${displayName} idle 首帧预览"></div>
            <div class="download-body">
              <h3>${displayName}</h3>
              <p>${description}</p>
              <p class="meta">v${version}</p>
              <a href="./petpacks/${fileName}">下载 ${displayName}</a>
              <a class="secondary" href="${escapeHtml(visualQaHref)}">视觉 QA</a>
            </div>
          </article>`;
}

function renderDownloadPage(petpacks) {
  const cards = [...petpacks]
    .sort((a, b) => String(a.displayName || a.id).localeCompare(String(b.displayName || b.id), "zh-CN"))
    .map(petCard)
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>宠物·永生计划</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
        color: #17202a;
        background: #f4f7fb;
      }
      body {
        margin: 0;
      }
      main {
        max-width: 1080px;
        margin: 0 auto;
        padding: 0 20px 48px;
      }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(240px, 0.9fr);
        gap: 28px;
        align-items: center;
        min-height: 360px;
        padding: 48px 0 28px;
      }
      .hero-copy {
        max-width: 620px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 44px;
        line-height: 1.12;
        letter-spacing: 0;
      }
      h2 {
        margin: 0 0 10px;
        font-size: 21px;
        letter-spacing: 0;
      }
      p {
        color: #526171;
        line-height: 1.7;
      }
      .hero p {
        margin: 0;
        font-size: 17px;
      }
      .hero-preview {
        display: grid;
        grid-template-columns: repeat(3, 96px);
        gap: 12px;
        justify-content: end;
      }
      .hero-tile {
        width: 96px;
        height: 104px;
        border: 1px solid #dce3ec;
        border-radius: 8px;
        background-color: #ffffff;
        background-repeat: no-repeat;
        background-position: 0 0;
        background-size: 800% 900%;
      }
      .downloads {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      .section {
        margin-top: 34px;
      }
      .download {
        padding: 20px;
        border: 1px solid #dce3ec;
        border-radius: 8px;
        background: #ffffff;
      }
      .pet-download {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 14px;
        align-items: start;
      }
      .download-body {
        min-width: 0;
      }
      .download h3 {
        margin: 0 0 8px;
        font-size: 18px;
        letter-spacing: 0;
      }
      .pet-preview {
        width: 96px;
        height: 104px;
        border-radius: 6px;
        background-color: #eef3f8;
        background-repeat: no-repeat;
        background-position: 0 0;
        background-size: 800% 900%;
      }
      .download a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        margin-top: 10px;
        margin-right: 8px;
        padding: 0 14px;
        color: #ffffff;
        background: #1f7a55;
        border-radius: 6px;
        text-decoration: none;
      }
      .download a.secondary {
        color: #1f7a55;
        background: transparent;
        box-shadow: inset 0 0 0 1px #98c7b4;
      }
      .meta {
        margin: 0;
        color: #6d7b8a;
        font-size: 13px;
      }
      code {
        padding: 2px 5px;
        border-radius: 4px;
        background: #e8eef6;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          color: #eef3f8;
          background: #12161c;
        }
        p {
          color: #aeb9c6;
        }
        .download {
          border-color: #2b3542;
          background: #1a2028;
        }
        .hero-tile {
          border-color: #2b3542;
          background-color: #1a2028;
        }
        .pet-preview {
          background-color: #252d38;
        }
        .meta {
          color: #8492a3;
        }
        code {
          background: #252d38;
        }
      }
      @media (max-width: 760px) {
        .hero {
          grid-template-columns: 1fr;
          min-height: 0;
          padding-top: 34px;
        }
        h1 {
          font-size: 34px;
        }
        .hero-preview {
          justify-content: start;
        }
      }
      @media (max-width: 420px) {
        .pet-download {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero" aria-label="品牌介绍">
        <div class="hero-copy">
          <h1>宠物·永生计划</h1>
          <p>把熟悉的宠物留在桌面上。先安装主程序，再下载宠物资源包；主程序更新和宠物资源更新彼此独立。</p>
        </div>
        <div class="hero-preview" aria-label="宠物预览">
${[...petpacks]
  .slice(0, 3)
  .map((pet) => `          <div class="hero-tile" style="background-image: url('./petpacks/${escapeHtml(pet.previewAtlas || "")}')"></div>`)
  .join("\n")}
        </div>
      </section>

      <section class="section" aria-label="App downloads">
        <h2>主程序</h2>
        <div class="downloads">
          <article class="download">
            <h3>Windows</h3>
            <p>适合 Windows x64。</p>
            <a href="https://github.com/jieyangxchen/codex-pet-desktop/releases/latest/download/yongsheng-plan-windows-x64.exe">下载 Windows 版</a>
          </article>
          <article class="download">
            <h3>macOS</h3>
            <p>根据 Mac 芯片选择 Apple Silicon 或 Intel。</p>
            <a href="https://github.com/jieyangxchen/codex-pet-desktop/releases/latest/download/yongsheng-plan-macos-arm64.dmg">Apple Silicon</a>
            <a href="https://github.com/jieyangxchen/codex-pet-desktop/releases/latest/download/yongsheng-plan-macos-x64.dmg">Intel</a>
          </article>
        </div>
      </section>

      <section class="section" aria-label="Petpacks">
        <h2>宠物资源包</h2>
        <p>下载 <code>.petpack</code> 后，在主程序里点击 Import Petpack 导入。</p>
        <div class="downloads">
${cards}
        </div>
      </section>
    </main>
  </body>
</html>
`;
}

function main() {
  const indexPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(ROOT, "release", "petpacks", "petpacks.json");
  const outPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(ROOT, "docs", "index.html");
  const petpacks = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, renderDownloadPage(petpacks));
  console.log(JSON.stringify({ ok: true, outPath, petCount: petpacks.length }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  renderDownloadPage
};
