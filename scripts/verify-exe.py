#!/usr/bin/env python3
"""Launch a packaged EXE, screenshot its client area, then close it.

Works with Chinese window titles and windows that are not focused — capture
uses PrintWindow, so background/occluded windows still render.

Example:
    python verify-exe.py "release/PunkDrive.exe" --title "赛博朋克" --wait 48
"""

import argparse
import ctypes
import os
import subprocess
import sys
import time
from ctypes import wintypes

user32 = ctypes.WinDLL("user32", use_last_error=True)
gdi32 = ctypes.WinDLL("gdi32", use_last_error=True)
user32.SetProcessDPIAware()

SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW = 0x0002, 0x0001, 0x0040


class BIH(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD), ("biWidth", wintypes.LONG), ("biHeight", wintypes.LONG),
        ("biPlanes", wintypes.WORD), ("biBitCount", wintypes.WORD), ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD), ("biXPelsPerMeter", wintypes.LONG), ("biYPelsPerMeter", wintypes.LONG),
        ("biClrUsed", wintypes.DWORD), ("biClrImportant", wintypes.DWORD),
    ]


def find_window(needles):
    hits = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def cb(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return True
        n = user32.GetWindowTextLengthW(hwnd)
        if not n:
            return True
        buf = ctypes.create_unicode_buffer(n + 1)
        user32.GetWindowTextW(hwnd, buf, n + 1)
        title = buf.value.lower()
        if any(x.lower() in title for x in needles):
            cr = wintypes.RECT()
            user32.GetClientRect(hwnd, ctypes.byref(cr))
            if cr.right - cr.left > 600 and cr.bottom - cr.top > 400:
                hits.append(hwnd)
        return True

    user32.EnumWindows(cb, 0)
    return hits


def capture(hwnd, path, max_width=1500):
    from PIL import Image

    cr = wintypes.RECT()
    user32.GetClientRect(hwnd, ctypes.byref(cr))
    w, h = cr.right - cr.left, cr.bottom - cr.top

    hdc = user32.GetWindowDC(hwnd)
    mem = gdi32.CreateCompatibleDC(hdc)
    bmp = gdi32.CreateCompatibleBitmap(hdc, w, h)
    gdi32.SelectObject(mem, bmp)
    user32.PrintWindow(hwnd, mem, 2)

    bi = BIH()
    bi.biSize = ctypes.sizeof(BIH)
    bi.biWidth = w
    bi.biHeight = -h
    bi.biPlanes = 1
    bi.biBitCount = 32
    buf = ctypes.create_string_buffer(w * h * 4)
    gdi32.GetDIBits(mem, bmp, 0, h, buf, ctypes.byref(bi), 0)

    img = Image.frombuffer("RGBA", (w, h), buf, "raw", "BGRA", 0, 1).convert("RGB")
    if w > max_width:
        img = img.resize((max_width, int(h * max_width / w)), Image.LANCZOS)
    img.save(path)

    gdi32.DeleteObject(bmp)
    gdi32.DeleteDC(mem)
    user32.ReleaseDC(hwnd, hdc)
    print(f"captured {w}x{h} -> {path}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("exe")
    ap.add_argument("--title", action="append", default=[], help="window title substring (repeatable)")
    ap.add_argument("--wait", type=int, default=45, help="seconds before screenshot")
    ap.add_argument("--out", default="_exe.png")
    ap.add_argument("--timeout", type=int, default=120)
    args = ap.parse_args()

    exe = os.path.abspath(args.exe)
    if not os.path.exists(exe):
        return sys.exit(f"not found: {exe}")

    env = dict(os.environ)
    for k in ("ELECTRON_RUN_AS_NODE", "NODE_OPTIONS", "http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"):
        env.pop(k, None)

    print("launching…")
    proc = subprocess.Popen([exe], cwd=os.path.dirname(exe), env=env)

    needles = args.title or [os.path.splitext(os.path.basename(exe))[0]]
    hwnd, deadline = None, time.time() + args.timeout
    while time.time() < deadline:
        hits = find_window(needles)
        if hits:
            hwnd = hits[0]
            break
        if proc.poll() is not None:
            return sys.exit("process exited before a window appeared")
        time.sleep(0.5)

    if not hwnd:
        proc.kill()
        return sys.exit(f"window not found for titles: {needles}")

    user32.SetWindowPos(hwnd, -1, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW)
    user32.SetForegroundWindow(hwnd)
    time.sleep(args.wait)
    capture(hwnd, os.path.abspath(args.out))

    proc.terminate()
    try:
        proc.wait(timeout=10)
    except Exception:
        proc.kill()
    print("closed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
