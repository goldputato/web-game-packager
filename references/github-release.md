# Shipping to GitHub

The output of this skill is a repo that builds a portable EXE, plus a release that
carries the binary. Keep source and binaries separate: the EXE is 100-150 MB, above
GitHub's comfortable file size and outside what belongs in git history.

## Repo layout

```
<repo>/
├── README.md               # what it is, how to run, credits, license
├── LICENSE                 # MIT for the shell; the game keeps its own license
├── .gitignore
├── .github/
│   └── workflows/
│       └── release.yml     # build EXE on tag, attach to release
├── app/                    # Electron shell (main.js, server.js, package.json, build/icon.ico)
├── site/                   # optional: mirrored game, only if redistribution is allowed
└── tools/                  # mirror / verify / localize scripts used to produce the build
```

Never commit: `node_modules/`, `release/`, `app/game/`, `*.exe`, `_urls.json`.

## .gitignore

```gitignore
node_modules/
release/
app/game/
*.exe
*.7z
_urls.json
_texts.json
_*.png
.DS_Store
```

## README skeleton

```markdown
# <Game title> — 离线桌面版

把 <original URL> 打包成单文件 Windows EXE，可离线运行。

- 原作出处：<author / url>
- 本地化：界面与剧情中文（源码层替换 + 短标签注入）
- 构建：Electron <version> + electron-builder（portable）

## 运行
下载 Releases 里的 `<Name>.exe`，双击即可，无需安装、无需联网。

## 自行构建
```bash
cd app
npm i --registry=https://registry.npmmirror.com
npx electron-builder --win portable --x64
```

## 致谢与声明
游戏版权归原作者所有，本仓库只提供打包与本地化脚本，不分发原作资源。
若原作者要求下架，请联系删除。
```

Keep the attribution block. Redistributing someone else's assets without credit is both
rude and a takedown magnet.

## Release workflow

```yaml
name: build

on:
  push:
    tags: ["v*"]
  workflow_dispatch:

jobs:
  windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install
        working-directory: app
        run: npm i --no-audit --no-fund
      - name: Build portable
        working-directory: app
        run: npx electron-builder --win portable --x64
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: exe
          path: release/*.exe
      - name: Attach to release
        if: startsWith(github.ref, 'refs/tags/')
        uses: softprops/action-gh-release@v2
        with:
          files: release/*.exe
```

`app/game/` is gitignored, so CI needs the mirrored assets. Two options:

1. Commit the mirror (only if the license permits redistribution) and drop `app/game/`
   from `.gitignore`.
2. Keep the mirror out and publish the EXE from a local build; CI then only produces a
   stub that will fail at runtime. Do not do this silently.

## Versioning

Tag `v1.0.0`, `v1.0.1`. Put the localized build notes in the release body: what was
translated, what remains Latin (proper nouns, units, model codes), and the original
version it was built from.

## License

The Electron shell and scripts can be MIT. The game assets remain under the original
author's terms — state that explicitly in `README.md` and `LICENSE`, and ship the assets
only when the license allows it.
