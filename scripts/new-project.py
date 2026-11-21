#!/usr/bin/env python3
"""Scaffold a packaging project from the bundled Electron shell.

Creates:
    <dir>/
      app/            Electron shell (main.js, server.js, package.json, build/)
      site/           mirrored web game goes here
      tools/          working scripts and verification output
      release/        built artifacts

Example:
    python new-project.py --dir E:/AI/my-game --name "Punk Drive" \
        --title "赛博朋克：朋克驾驶" --artifact PunkDrive \
        --app-id com.example.punkdrive --author "Author Name"
"""

import argparse
import json
import re
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE.parent / "assets" / "electron-app"


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return s or "web-game"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True, help="project directory to create")
    ap.add_argument("--name", required=True, help="product name, e.g. 'Punk Drive'")
    ap.add_argument("--title", default=None, help="window title (Chinese allowed)")
    ap.add_argument("--artifact", default=None, help="exe file name without .exe")
    ap.add_argument("--app-id", default=None, help="reverse-domain app id")
    ap.add_argument("--author", default="unknown")
    ap.add_argument("--copyright", default=None)
    ap.add_argument("--bg", default="#000000", help="window background colour")
    args = ap.parse_args()

    root = Path(args.dir).resolve()
    app_dir = root / "app"
    for sub in (root / "site", root / "tools", root / "release", app_dir / "build", app_dir / "game"):
        Path(sub).mkdir(parents=True, exist_ok=True)

    title = args.title or args.name
    artifact = args.artifact or re.sub(r"\s+", "", args.name)
    app_id = args.app_id or f"com.{slugify(args.name).replace('-', '')}.standalone"
    slug = slugify(args.name)

    main_src = (TEMPLATE / "main.js").read_text(encoding="utf-8")
    main_src = (
        main_src.replace("__APP_TITLE__", title)
        .replace("__APP_ID__", app_id)
        .replace("__BG_COLOR__", args.bg)
    )
    (app_dir / "main.js").write_text(main_src, encoding="utf-8")

    shutil.copy2(TEMPLATE / "server.js", app_dir / "server.js")

    tpl = (TEMPLATE / "package.json.tpl").read_text(encoding="utf-8")
    pkg = (
        tpl.replace("__APP_SLUG__", slug)
        .replace("__PRODUCT_NAME__", args.name)
        .replace("__APP_ID__", app_id)
        .replace("__ARTIFACT_NAME__", artifact)
        .replace("__UNPACK_DIR__", artifact + "Game")
        .replace("__DESCRIPTION__", f"{args.name} — standalone offline build")
        .replace("__AUTHOR__", args.author)
        .replace("__COPYRIGHT__", args.copyright or args.name)
    )
    (app_dir / "package.json").write_text(pkg, encoding="utf-8")

    json.loads(pkg)  # fail fast on malformed JSON

    print(f"project  : {root}")
    print(f"app      : {app_dir}")
    print(f"title    : {title}")
    print(f"artifact : release/{artifact}.exe")
    print()
    print("next:")
    print(f'  python "{HERE / "mirror.py"}" --urls _urls.json --base <origin> --out "{root / "site"}"')
    print(f'  cd "{app_dir}" && npm i --registry=https://registry.npmmirror.com')


if __name__ == "__main__":
    main()
