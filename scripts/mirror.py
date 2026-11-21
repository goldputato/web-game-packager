#!/usr/bin/env python3
"""Mirror every runtime asset of a web game into a local folder.

Reads the _urls.json produced by collect-urls.js, drops analytics, keeps the
rest, and preserves the URL path structure so relative references keep working.

Example:
    python mirror.py --urls _urls.json --base https://example.com --out site \
        --proxy socks5h://127.0.0.1:7890
"""

import argparse
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

SKIP_HOSTS = ("google-analytics.com", "googletagmanager.com", "doubleclick.net",
              "facebook.net", "hotjar.com", "segment.io", "sentry.io")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--urls", default="_urls.json")
    ap.add_argument("--base", required=True, help="site origin, e.g. https://example.com")
    ap.add_argument("--out", default="site")
    ap.add_argument("--proxy", default=os.environ.get("MIRROR_PROXY", ""))
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--timeout", type=int, default=300)
    args = ap.parse_args()

    base = args.base.rstrip("/")
    data = json.load(open(args.urls, encoding="utf-8"))
    entries = data["urls"] if isinstance(data, dict) else data

    jobs, seen = [], set()
    for u in entries:
        if any(h in u for h in SKIP_HOSTS):
            continue
        if not u.startswith(base):
            print(f"  skip external: {u[:90]}")
            continue
        rel = urlparse(u).path
        if not rel or rel in seen:
            continue
        seen.add(rel)
        jobs.append((u, rel))

    print(f"{len(jobs)} files to mirror")

    ok, failed = 0, []

    def fetch(job):
        url, rel = job
        dest = os.path.join(args.out, rel.lstrip("/").replace("/", os.sep))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        cmd = ["curl", "-sSL", "--max-time", str(args.timeout), "--retry", "2",
               url, "-o", dest, "-w", "%{http_code}"]
        if args.proxy:
            cmd[1:1] = ["-x", args.proxy]
        r = subprocess.run(cmd, capture_output=True, text=True)
        code = (r.stdout or "").strip()
        size = os.path.getsize(dest) if os.path.exists(dest) else 0
        return rel, code, size

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        for rel, code, size in ex.map(fetch, jobs):
            if code == "200" and size > 0:
                ok += 1
            else:
                failed.append(f"{code} {size}B {rel}")

    print(f"\nok {ok}/{len(jobs)}")
    if failed:
        print("failed:")
        for f in failed[:20]:
            print("  ", f)

    total = sum(os.path.getsize(os.path.join(dp, f))
                for dp, _, fs in os.walk(args.out) for f in fs)
    print(f"total {total/1048576:.1f} MB under {args.out}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
