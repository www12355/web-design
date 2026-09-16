#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""计算样式 / 几何回归快照采集（Playwright）。

用法：
    python tools/visual/snapshot.py --label base
    python tools/visual/snapshot.py --label after-theme

要点：
  * 自行启动 node serve.js（默认端口 4188，可用环境变量 VISUAL_PORT 覆盖），跑完即杀；
  * 以 prefers-reduced-motion=reduce 打开，并在页面上下文冻结
    Date.now / performance.now / Math.random / setTimeout / setInterval，
    使「同输入必得同输出」——否则快照比对无意义；
  * 只采集 computedStyle 与几何（不采集文本），每个选择器最多取 maxPerSelector 个。

输出：tools/visual/out/<label>.json
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / "out"
PORT = int(os.environ.get("VISUAL_PORT", "4188"))
BASE = f"http://127.0.0.1:{PORT}"
PAGES = ["index.html", "screen1.html", "window2.html"]

# 页面上下文内冻结不确定性来源（顺序：先冻结随机/时钟，再冻结定时器）
FREEZE_JS = r"""
(() => {
  const FIXED_MS = 1767225600000; /* 2026-01-01T00:00:00Z */
  try { Date.now = () => FIXED_MS; } catch (e) {}
  try { if (window.performance) { performance.now = () => 0; } } catch (e) {}
  try { Math.random = () => 0.42; } catch (e) {}
  const noop = () => 0;
  try { window.setTimeout = noop; } catch (e) {}
  try { window.setInterval = noop; } catch (e) {}
  try { window.clearTimeout = noop; } catch (e) {}
  try { window.clearInterval = noop; } catch (e) {}
})();
"""

COLLECT_JS = r"""
(spec) => {
  const out = [];
  for (const sel of spec.selectors) {
    let els = [];
    try { els = [...document.querySelectorAll(sel)]; } catch (e) { els = []; }
    const count = els.length;
    els = els.slice(0, spec.max);
    els.forEach((el, i) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const props = {};
      for (const p of spec.props) props[p] = cs.getPropertyValue(p);
      out.push({
        selector: sel,
        index: i,
        count: count,
        rect: [
          Math.round(r.x * 100) / 100,
          Math.round(r.y * 100) / 100,
          Math.round(r.width * 100) / 100,
          Math.round(r.height * 100) / 100
        ],
        props
      });
    });
  }
  return out;
}
"""

ASSERT_JS = r"""
() => ({
  BallCore: typeof window.BallCore,
  Bloub: typeof window.Bloub,
  EmotionBall: typeof window.EmotionBall,
  World: typeof window.World,
  Nebula: typeof window.Nebula,
  AIC: typeof window.AIC
})
"""


def wait_server(timeout=20.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(BASE + "/index.html", timeout=1.5) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.3)
    return False


def launch_browser(pw, preferred=None):
    """按可用性依次尝试：显式指定 → msedge（本机已装）→ chromium 通道 → 默认。

    本机 Playwright 需要的 chrome-headless-shell 版本可能未下载，
    但完整 chromium 与系统 Edge 均可用，故做通道降级，避免额外下载。
    """
    candidates = []
    if preferred:
        candidates.append(preferred)
    candidates += ["msedge", "chromium", None]
    last_err = None
    for ch in candidates:
        try:
            if ch:
                return pw.chromium.launch(channel=ch)
            return pw.chromium.launch()
        except Exception as exc:  # noqa: BLE001
            last_err = exc
    raise last_err


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", required=True, help="快照标签，输出 out/<label>.json")
    ap.add_argument("--keep-server", action="store_true", help="跑完不杀服务（调试用）")
    ap.add_argument("--channel", default=None, help="浏览器通道（如 msedge / chromium）")
    args = ap.parse_args()

    spec = json.loads((HERE / "selectors.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)

    node = shutil.which("node") or "node"
    srv = subprocess.Popen(
        [node, "serve.js"],
        cwd=str(ROOT),
        env={**os.environ, "PORT": str(PORT)},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        if not wait_server():
            print("[snapshot] 服务不可达：%s" % BASE, file=sys.stderr)
            return 2

        try:
            from playwright.sync_api import sync_playwright
        except Exception as exc:  # noqa: BLE001
            print("[snapshot] 未能导入 playwright：%s" % exc, file=sys.stderr)
            print("[snapshot] 提示：改用项目 Python 解释器，例如 "
                  r"C:\Users\<你>\AppData\Local\Programs\Python\Python313\python.exe tools/visual/snapshot.py ...",
                  file=sys.stderr)
            return 3

        result = {"label": args.label, "pages": {}}
        max_n = spec.get("maxPerSelector", 12)
        props = spec["props"]

        with sync_playwright() as pw:
            browser = launch_browser(pw, args.channel)
            try:
                for page_name in PAGES:
                    page_spec = spec["pages"].get(page_name, {})
                    ctx = browser.new_context(
                        viewport={"width": 1920, "height": 1080},
                        device_scale_factor=1,
                        reduced_motion="reduce",
                    )
                    page = ctx.new_page()
                    errors = []
                    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
                    page.on(
                        "console",
                        lambda m: errors.append("console.%s: %s" % (m.type, m.text))
                        if m.type == "error"
                        else None,
                    )
                    page.add_init_script(FREEZE_JS)
                    page.goto(BASE + "/" + page_name, wait_until="load")
                    page.wait_for_timeout(700)

                    samples = page.evaluate(
                        COLLECT_JS,
                        {"selectors": page_spec.get("selectors", []), "props": props, "max": max_n},
                    )
                    asserts = page.evaluate(ASSERT_JS)
                    entry = {
                        "console_errors": errors,
                        "assertions": asserts,
                        "samples": samples,
                        "groups": {},
                    }

                    for gname, gspec in (page_spec.get("groups") or {}).items():
                        trigger = gspec.get("trigger")
                        if trigger:
                            try:
                                page.evaluate(trigger)
                                page.wait_for_timeout(500)
                            except Exception as exc:  # noqa: BLE001
                                errors.append("group-trigger(%s): %s" % (gname, exc))
                        entry["groups"][gname] = page.evaluate(
                            COLLECT_JS,
                            {
                                "selectors": gspec.get("selectors", []),
                                "props": props,
                                "max": max_n,
                            },
                        )

                    result["pages"][page_name] = entry
                    ctx.close()
            finally:
                browser.close()

        outfile = OUT / (args.label + ".json")
        outfile.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")

        for pn, e in result["pages"].items():
            print(
                "[snapshot] %-14s samples=%-4d consoleErrors=%d assertions=%s"
                % (pn, len(e["samples"]), len(e["console_errors"]), e["assertions"])
            )
        print("[snapshot] wrote %s" % outfile)
        return 0
    finally:
        if not args.keep_server:
            try:
                srv.terminate()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
