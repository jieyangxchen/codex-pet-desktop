<h1 align="center">宠物·永生计划</h1>

<p align="center">
  一个独立运行的 Windows/macOS 桌面宠物应用。主程序和宠物资源包解耦，让米粉、米酒、红糖这类宠物以 <code>.petpack</code> 的方式长期保存、独立更新、随时导入。
</p>

<p align="center">
  <a href="https://jieyangxchen.github.io/codex-pet-desktop/">下载页</a> ·
  <a href="https://github.com/jieyangxchen/codex-pet-desktop/releases/latest">最新 Release</a> ·
  <a href="https://jieyangxchen.github.io/codex-pet-desktop/petpacks/petpacks.json">宠物包索引</a> ·
  <a href="https://jieyangxchen.github.io/codex-pet-desktop/petpacks/visual-qa.html">视觉 QA</a>
</p>

<p align="center">
  <a href="https://github.com/jieyangxchen/codex-pet-desktop/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/jieyangxchen/codex-pet-desktop?label=release"></a>
  <a href="https://github.com/jieyangxchen/codex-pet-desktop/actions/workflows/release.yml"><img alt="Release workflow" src="https://github.com/jieyangxchen/codex-pet-desktop/actions/workflows/release.yml/badge.svg"></a>
  <a href="https://github.com/jieyangxchen/codex-pet-desktop/actions/workflows/pages.yml"><img alt="Pages workflow" src="https://github.com/jieyangxchen/codex-pet-desktop/actions/workflows/pages.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue"></a>
</p>

<p align="center">
  <a href="https://jieyangxchen.github.io/codex-pet-desktop/petpacks/visual-qa.html">
    <img width="30%" alt="米粉宠物包动作预览" src="https://jieyangxchen.github.io/codex-pet-desktop/petpacks/previews/mi-fen-1.0.3-atlas.webp">
  </a>
  <a href="https://jieyangxchen.github.io/codex-pet-desktop/petpacks/visual-qa.html">
    <img width="30%" alt="米酒宠物包动作预览" src="https://jieyangxchen.github.io/codex-pet-desktop/petpacks/previews/mi-jiu-1.0.1-atlas.webp">
  </a>
  <a href="https://jieyangxchen.github.io/codex-pet-desktop/petpacks/visual-qa.html">
    <img width="30%" alt="红糖宠物包动作预览" src="https://jieyangxchen.github.io/codex-pet-desktop/petpacks/previews/tigris-whippet-1.0.2-atlas.webp">
  </a>
</p>

> 这是社区项目，不是 OpenAI 或 Codex 官方应用。项目复用了 Codex 风格的 `pet.json` + `spritesheet.webp` 宠物资源格式，但主程序不依赖 Codex 启动或运行。

## 三步开始

1. 打开 [下载页](https://jieyangxchen.github.io/codex-pet-desktop/) 或 [最新 Release](https://github.com/jieyangxchen/codex-pet-desktop/releases/latest)，下载适合你系统的安装包。
2. 启动主程序，进入资源库安装米粉、米酒或红糖，也可以手动导入 `.petpack`。
3. 把桌宠拖到顺手的位置，右键打开控制面板，调整大小、置顶、自动散步和资源更新。

如果这个项目帮你留下了一只想长期保存的桌宠，欢迎点一个 Star；问题、宠物资源建议和适配反馈可以发到 [Discussions](https://github.com/jieyangxchen/codex-pet-desktop/discussions) 或 [Issues](https://github.com/jieyangxchen/codex-pet-desktop/issues)。

## 这是什么

宠物·永生计划把桌宠分成两部分：

- 主程序：一个 Tauri/Rust 桌面应用，负责透明窗口、拖动、托盘、互动、导入和资源库。
- 宠物包：每只宠物一个 `.petpack`，里面放 `petpack.json`、`pet.json` 和 `spritesheet.webp`。

这样主程序优化和宠物资源更新可以分开发布。换图、加动作、修宠物资源时，只需要更新 Pages 上的宠物包，不需要重新构建安装包。

## 下载入口

推荐从下载页开始：
[https://jieyangxchen.github.io/codex-pet-desktop/](https://jieyangxchen.github.io/codex-pet-desktop/)

| 类型 | 链接 | 说明 |
| --- | --- | --- |
| Windows 主程序 | [yongsheng-plan-windows-x64.exe](https://github.com/jieyangxchen/codex-pet-desktop/releases/latest/download/yongsheng-plan-windows-x64.exe) | Windows x64 安装包 |
| macOS Apple Silicon | [yongsheng-plan-macos-arm64.dmg](https://github.com/jieyangxchen/codex-pet-desktop/releases/latest/download/yongsheng-plan-macos-arm64.dmg) | M 系列芯片 Mac |
| 最新 Release | [GitHub Releases](https://github.com/jieyangxchen/codex-pet-desktop/releases/latest) | 主程序发布页 |
| 宠物包索引 | [petpacks.json](https://jieyangxchen.github.io/codex-pet-desktop/petpacks/petpacks.json) | 应用内资源库读取的索引 |
| 资源视觉检查 | [visual-qa.html](https://jieyangxchen.github.io/codex-pet-desktop/petpacks/visual-qa.html) | 查看每个宠物包的动作帧 |

首次安装主程序后，如果还没有宠物，会自动打开宠物资源库。可以直接在应用里安装宠物，也可以从下载页下载 `.petpack` 后手动导入。

## 当前宠物包

| 宠物 | 文件 | 说明 |
| --- | --- | --- |
| 米粉 | [mi-fen-1.0.3.petpack](https://jieyangxchen.github.io/codex-pet-desktop/petpacks/mi-fen-1.0.3.petpack) | 全白猫咪，常态趴着待机 |
| 米酒 | [mi-jiu-1.0.1.petpack](https://jieyangxchen.github.io/codex-pet-desktop/petpacks/mi-jiu-1.0.1.petpack) | 深色长毛虎斑猫，常态趴着待机 |
| 红糖 | [tigris-whippet-1.0.2.petpack](https://jieyangxchen.github.io/codex-pet-desktop/petpacks/tigris-whippet-1.0.2.petpack) | 虎斑色惠比特，常态贴近地面休息 |

同一个宠物 id 再次导入时会覆盖应用数据目录里的旧版本。应用内资源库会按索引里的版本、大小、SHA-256 和更新说明判断是否可更新。

## 运行规则

- 主程序正式安装包不内置宠物资源。
- 首次启动如果没有已安装宠物，会显示空状态并打开资源库入口。
- `CODEX_PETS_DIR`、应用数据目录和 `~/.codex/pets` 仍可作为外部宠物目录。
- 宠物包通过 GitHub Pages 分发；主程序通过 GitHub Releases 分发。
- 推送 `v*` tag 会触发 Release workflow，构建 Windows 和 macOS 主程序。
- 修改 `resources/pets/**`、下载页或宠物包脚本会触发 Pages workflow，重新生成 `.petpack`、资源索引和下载页。

## 交互

| 操作 | 行为 |
| --- | --- |
| 拖动桌宠 | 移动位置，拖动时暂停自动游走 |
| 单击桌宠 | 播放当前宠物配置的互动动画 |
| 双击桌宠 | 播放跳跃动画 |
| 右键桌宠 | 打开或关闭控制面板 |
| 托盘左键 | 显示或隐藏桌宠 |
| 托盘右键 | 打开急救菜单，支持显示、隐藏、召回、暂停/恢复自动散步、打开资源库、打开数据目录、置顶和退出 |

控制面板包含控制、资源库、已安装、更新等分区，支持安装/更新宠物包、本地导入、切换宠物、调整大小、切换动作状态、置顶、自动散步、卸载资源和检查更新。

## 宠物资源格式

仓库内每只宠物位于 `resources/pets/<pet-id>/`，至少包含：

```text
pet.json
spritesheet.webp
```

`.petpack` 是 zip 容器，根目录包含：

```text
petpack.json
pet.json
spritesheet.webp
```

`petpack.json` 最小字段：

```json
{
  "format": "codex-petpack",
  "formatVersion": 1,
  "id": "mi-fen",
  "displayName": "米粉",
  "version": "1.0.3"
}
```

图集要求：

| 项 | 要求 |
| --- | --- |
| 文件尺寸 | `1536x1872` |
| 网格 | 8 列 x 9 行 |
| 单帧 | `192x208` |

| 行号 | 状态 | 帧数 |
| --- | --- | --- |
| 0 | `idle` | 6 |
| 1 | `running-right` | 8 |
| 2 | `running-left` | 8 |
| 3 | `waving` | 4 |
| 4 | `jumping` | 5 |
| 5 | `failed` | 8 |
| 6 | `waiting` | 6 |
| 7 | `running` | 6 |
| 8 | `review` | 6 |

## 开发

环境要求：

- Node.js 22
- Rust stable
- Tauri CLI v2

常用命令：

```bash
npm install
npm run smoke

cd src-tauri
cargo test
cargo run
```

打包主程序：

```bash
node scripts/build-app.js build windows
node scripts/build-app.js build macos-arm64
```

生成宠物包和下载页：

```bash
node scripts/build-petpacks.js
node scripts/render-download-page.js
```

开发模式会扫描仓库里的 `resources/pets`，方便制作和预览资源；正式安装包不依赖这个目录。

## 项目结构

```text
resources/pets/                 宠物资源源目录，用于生成独立 .petpack
src-tauri/                      Rust/Tauri 主进程、窗口、托盘、打包配置
src/app/                        打包进主程序的前端运行时文件
src/*-smoke.js                  Node 冒烟测试
scripts/build-app.js            生成无内置资源的主程序安装包
scripts/build-petpacks.js       生成独立宠物资源包和 petpacks.json
scripts/qa-petpack-assets.js    校验宠物 manifest、图集尺寸和动作帧
scripts/render-download-page.js 根据 petpacks.json 生成 GitHub Pages 下载页
docs/index.html                 GitHub Pages 静态下载页
```

## 发布

主程序发布：

```bash
git tag v0.2.10
git push origin v0.2.10
```

GitHub Actions 会构建并发布：

- `yongsheng-plan-windows-x64.exe`
- `yongsheng-plan-macos-arm64.dmg`

宠物包发布：

```bash
node scripts/build-petpacks.js
node scripts/render-download-page.js
```

提交 `resources/pets/**`、`scripts/build-petpacks.js`、`scripts/render-download-page.js` 或 `docs/index.html` 后，Pages workflow 会重新部署下载页和宠物包资源。

## 许可证

MIT
