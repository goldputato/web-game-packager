# web-game-packager

把一个能在线玩的网页游戏（Three.js / WebGL / WebGPU / Canvas 均可）打包成**单文件 Windows EXE**，可选**全量汉化**，并按可发布到 GitHub 的结构组织。

A skill for WorkBuddy that turns a playable web game into a single-file portable Windows EXE, with optional full Chinese localization.

## 能做什么

- 给一个链接，抓全运行时资源（模型、贴图、音频、字体、wasm），做成本地镜像
- Electron 外壳 + 内置静态服务器，离线可跑，单文件便携 EXE
- 图标优先复用游戏自己的 PWA 图标
- 汉化分两层：**长文本/剧情走源码替换**，短标签走渲染层注入
- 附带验证脚本：离线资源校验、成品 EXE 截图验证

## 安装

```bash
cp -r web-game-packager ~/.workbuddy/skills/
```

然后在对话里给出链接并说「打包成 exe」即可触发。

## 快速开始（手动跑一遍）

```bash
# 1. 建工程
python scripts/new-project.py --dir ~/games/my-game --name "My Game" --artifact MyGame

# 2. 抓资源清单（需要工程里先装好 electron）
node scripts/collect-urls.js https://example.com/game --wait 60000

# 3. 镜像
python scripts/mirror.py --urls _urls.json --base https://example.com --out site

# 4. 离线验证
node scripts/verify-offline.js site

# 5. 打包
cd app
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm i --registry=https://registry.npmmirror.com
npx electron-builder --win portable --x64
```

## 汉化

```bash
# 抓界面文案
node scripts/dump-strings.js site --advance 45

# 人工/模型翻译成 zh.json：{"English text": "中文"}

# 源码层替换（长句）
python scripts/patch-bundle.py --bundle site/assets/index-*.js --dict zh.json --report

# 短标签走渲染层：把 zh-overlay.js 放到站点根目录，</body> 前引入
```

为什么分两层：`STEER`、`DRIFT`、`CAR` 这类短词同时是输入动作的内部键，直接改源码会让游戏崩溃；而剧情长文如果只做渲染层替换，会因为打字机效果（逐字显示）永远匹配不上。

## 目录

```
scripts/          可执行脚本（抓取 / 镜像 / 验证 / 汉化 / 图标）
assets/electron-app/  Electron 外壳模板
references/        踩坑记录、GitHub 发布结构
```

细节读 `references/pitfalls.md`，那是这类活儿真正会卡住的地方。

## 声明

本仓库只包含打包与本地化**工具**，不含任何游戏资源。游戏版权归原作者所有；分发打包产物前请确认原作的许可条款，并在 README 中注明出处。

## License

MIT（仅限本仓库脚本与外壳模板）
