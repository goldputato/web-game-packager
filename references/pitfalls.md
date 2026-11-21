# Pitfalls

Failures that cost real time on previous jobs. Check here first.

## Packaging

**npm stalls on the default registry.** `registry.npmjs.org` can take 20-30 s per
package. Always pass `--registry=https://registry.npmmirror.com`, and export both
`ELECTRON_MIRROR` and `ELECTRON_BUILDER_BINARIES_MIRROR` before installing.

**The Electron binary is not fetched by `npm i`.** When a policy skips install
scripts, `node_modules/electron/dist/electron.exe` is missing. Run
`node node_modules/electron/install.js` manually.

**`node_modules` may appear empty for minutes.** A 90 MB folder with no `electron.exe`
means the postinstall is still downloading, not that npm failed.

**Build output appears in two stages.** `release/*.nsis.7z` + `win-unpacked/` means the
7z was packed but the portable stub was not yet wrapped. Interrupting here leaves no
EXE. Re-run; the second pass is faster because the Electron zip is cached.

**Portable, not NSIS, for a single file.** `--win portable` produces one self-extracting
EXE. NSIS produces a setup wizard.

## Windows specifics

**`.bat` files must be ASCII + CRLF.** A UTF-8 launcher containing Chinese comments is
read as GBK by `cmd`, the garbled `rem` line executes, and the following `cd` never runs:
the user sees `'播镇'? 不是内部或外部命令` plus `Windows 找不到文件`. Keep launchers
ASCII-only, end lines with CRLF, and `cd /d` into the game directory before `start`.

**`%~dp0` can produce doubled paths** when the script is launched through a shell that
already changed directory. For a launcher the user double-clicks, hardcode the absolute
path and note that moving the folder breaks it.

**Window title vs page title.** `<title>` always wins. Without
`win.on("page-title-updated", e => e.preventDefault())` the taskbar shows the site title
no matter what `title:` was passed to `BrowserWindow`.

**Chinese window titles break naive window lookup.** Match by substring, and include
both the English and Chinese forms when scripting `verify-exe.py`.

## Rendering

**Black window on VMs / integrated GPUs.** Add `ignore-gpu-blocklist`,
`enable-unsafe-swiftshader`, `enable-features=Vulkan,WebGPU`. A WebGPU title may still be
unplayable on old drivers; report that instead of debugging the shell.

**Fonts fail with `ERR_CACHE_MISS`.** Some PWAs probe `cache: only-if-cached` for
preloaded fonts. It is benign — the font renders from the normal path. Do not treat it
as a missing asset.

**CJK tofu.** If the page's font stack lacks CJK coverage, Chinese renders as boxes.
Check a screenshot after localizing; if glyphs are missing, the site needs a font with
CJK subsets, which usually means shipping the font and adding an `@font-face`.

**Text clipped at the panel edge.** Source-level paragraph replacement drops the `\n`
separators the original string had. Re-insert `\n` at sentence boundaries (32 chars per
line works for most dialogue panels), otherwise the panel shows one long line cut off on
the right.

## Localization

**DOM-only localization leaves dialogue in English.** Narrative text is usually injected
later and typed out character by character. An exact-match overlay never matches a
growing prefix. Patch the source for narrative, use the overlay only for short labels.

**Rewriting short strings breaks the game.** Labels such as `STEER`, `DRIFT`, `CAR`,
`PLAY`, `ON` are frequently also input-action names or dictionary keys. A source rewrite
of those produced an immediate runtime crash in the scene builder. Patch only strings
≥ 10 characters at source level.

**Locating a template literal by "nearest backtick" corrupts the bundle.** In minified
code the nearest pair can span kilobytes; replacing that span with a short Chinese
sentence deleted 84 KB of working code. Replace the matched text only, never the
delimiters, and abort if the file shrinks unexpectedly.

**Half-translated paragraphs.** Replacing one sentence inside a multi-line literal
leaves a Chinese/English mix that looks worse than English. Translate the whole
paragraph and replace it as one unit.

**Curly quotes.** Source text often uses `’` while the dictionary uses `'`. Build the
matcher to accept both (`['’‘]`) and to treat runs of spaces as `\s+`.

**Verification must be visual.** A dictionary entry existing proves nothing. Reload,
screenshot, and read `document.body.innerText` — this is how "UI is Chinese but the
cutscene is not" gets caught.

## Assets

**Absolute URLs in HTML/CSS/JS.** After mirroring, rewrite
`https://origin/assets/x.js` to `/assets/x.js`, or the offline build silently loads from
the network.

**Soft 404s.** Some hosts return 200 with an HTML error page. Check byte size and magic
bytes for `.glb` / `.ktx2` / `.mp3`, not just the status code.

**Service workers.** A cached SW can serve stale assets and hide a broken mirror. Load
the offline build with a clean profile (a new random port per run is enough).

**Third-party CDNs.** Roblox/Unity/itch-style embeds pull from several origins. Mirror
each origin and keep its path structure, or the build breaks when the CDN blocks
`127.0.0.1`.
