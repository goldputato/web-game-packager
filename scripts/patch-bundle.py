#!/usr/bin/env python3
"""Localize a web game at the source level: rewrite its own JS string literals.

Safe by construction — it only ever replaces the matched English text itself,
never the delimiters around it. (Locating a template literal by "nearest
backtick" is what silently deletes kilobytes of a minified bundle.)

Usage:
    python patch-bundle.py --bundle site/assets/index-*.js --dict zh.json
    python patch-bundle.py --bundle ... --dict ... --short --report

Dictionary format: flat JSON, {"English text": "中文"}.
"""

import argparse
import glob
import json
import re
import sys

APOS = "['’‘]"


def build_regex(en: str) -> re.Pattern:
    parts = []
    for ch in en:
        if ch in "'’‘":
            parts.append(APOS)
        elif ch == " ":
            parts.append(r"\s+")
        else:
            parts.append(re.escape(ch))
    return re.compile("".join(parts))


def reflow(zh: str, width: int) -> str:
    """Break a translated paragraph into display lines with \\n."""
    segs = [s for s in re.split(r"(?<=[。！？…])", zh) if s]
    lines, cur = [], ""
    for seg in segs:
        if cur and len(cur) + len(seg) > width:
            lines.append(cur)
            cur = seg
        else:
            cur += seg
    if cur:
        lines.append(cur)
    return "\\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", required=True, help="path or glob to the JS bundle")
    ap.add_argument("--dict", required=True, help="JSON dictionary English -> Chinese")
    ap.add_argument("--min-len", type=int, default=10,
                    help="skip shorter strings at source level (they may be action keys)")
    ap.add_argument("--short", action="store_true",
                    help="also patch 4..min-len strings (dangerous: may be internal keys)")
    ap.add_argument("--reflow", type=int, default=120,
                    help="reflow translated paragraphs longer than this many EN chars")
    ap.add_argument("--width", type=int, default=32, help="display line width for reflowed text")
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    paths = glob.glob(args.bundle)
    if not paths:
        return sys.exit(f"bundle not found: {args.bundle}")
    path = paths[0]

    dict_raw = json.load(open(args.dict, encoding="utf-8"))
    text = open(path, encoding="utf-8", errors="surrogateescape").read()
    before_len = len(text)

    long_entries = {k: v for k, v in dict_raw.items() if len(k) >= args.min_len}
    short_entries = {}
    if args.short:
        short_entries = {k: v for k, v in dict_raw.items() if 4 <= len(k) < args.min_len}

    hits = 0
    missed = []
    for en in sorted(long_entries, key=len, reverse=True):
        zh = long_entries[en]
        if len(zh) > args.reflow and len(en) > 120:
            zh = reflow(zh, args.width)
        rx = build_regex(en)
        text, n = rx.subn(lambda _m: zh, text)
        if n:
            hits += n
        else:
            missed.append(en)

    short_hits = 0
    for en, zh in sorted(short_entries.items(), key=lambda kv: len(kv[0]), reverse=True):
        for q in ('"', "'"):
            needle = q + en + q
            if needle in text:
                c = text.count(needle)
                text = text.replace(needle, q + zh + q)
                short_hits += c

    delta = before_len - len(text)
    print(f"bundle   : {path}")
    print(f"sentences: {hits} replaced, {len(missed)} not found")
    if args.short:
        print(f"short    : {short_hits} replaced")
    print(f"size     : {before_len} -> {len(text)} ({delta:+d})")

    if delta > 40000:
        return sys.exit("aborting: unexpected size drop, a delimiter was probably swallowed")

    if not args.dry_run:
        open(path, "w", encoding="utf-8", errors="surrogateescape").write(text)

    if args.report:
        leftovers = []
        for sample in missed[:15]:
            if re.search(r"[A-Za-z]{3,}", sample):
                leftovers.append(sample)
        if leftovers:
            print("\nuntranslated (first 15):")
            for s in leftovers:
                print("   ", s[:80])
        print("\nverify syntax:")
        print(f'  cp "{path}" /tmp/check.mjs && node --check /tmp/check.mjs')

    return 0


if __name__ == "__main__":
    sys.exit(main())
