#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""逐路径比对两份回归快照；有差异则非零退出。

用法：
    python tools/visual/compare.py base after-theme
退出码：0 = 完全一致；1 = 存在差异（打印清单）；2 = 文件缺失。
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"

MAX_PRINT = 150


def flatten(snapshot):
    """(page, group, selector, index) -> {rect, props, count}"""
    flat = {}
    for pn, entry in snapshot.get("pages", {}).items():
        for s in entry.get("samples", []):
            flat[(pn, "main", s["selector"], s["index"])] = s
        for gname, arr in (entry.get("groups") or {}).items():
            for s in arr:
                flat[(pn, gname, s["selector"], s["index"])] = s
    return flat


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", help="基线快照标签")
    ap.add_argument("after", help="对比快照标签")
    ap.add_argument("--quiet-props", default="", help="逗号分隔：忽略这些属性（调试用）")
    args = ap.parse_args()

    fa = OUT / (args.base + ".json")
    fb = OUT / (args.after + ".json")
    for p in (fa, fb):
        if not p.exists():
            print("[compare] 缺少快照文件：%s" % p, file=sys.stderr)
            return 2

    a = json.loads(fa.read_text(encoding="utf-8"))
    b = json.loads(fb.read_text(encoding="utf-8"))
    ignore = {x.strip() for x in args.quiet_props.split(",") if x.strip()}

    A, B = flatten(a), flatten(b)
    diffs = []

    for key in sorted(set(A) | set(B), key=lambda k: (k[0], k[1], k[2], k[3])):
        if key not in A:
            diffs.append((key, "only-in-after", "", ""))
            continue
        if key not in B:
            diffs.append((key, "only-in-base", "", ""))
            continue
        sa, sb = A[key], B[key]
        if sa.get("count") != sb.get("count"):
            diffs.append((key, "count", str(sa.get("count")), str(sb.get("count"))))
        if sa.get("rect") != sb.get("rect"):
            diffs.append((key, "rect", str(sa.get("rect")), str(sb.get("rect"))))
        pa, pb = sa.get("props", {}), sb.get("props", {})
        for prop in sorted(set(pa) | set(pb)):
            if prop in ignore:
                continue
            if pa.get(prop) != pb.get(prop):
                diffs.append((key, prop, str(pa.get(prop)), str(pb.get(prop))))

    # 断言与 console error 变化
    for pn in sorted(set(a.get("pages", {})) | set(b.get("pages", {}))):
        ea = a.get("pages", {}).get(pn, {})
        eb = b.get("pages", {}).get(pn, {})
        if ea.get("assertions") != eb.get("assertions"):
            diffs.append(((pn, "assertions", "", 0), "assertions", str(ea.get("assertions")), str(eb.get("assertions"))))
        cea, ceb = ea.get("console_errors", []), eb.get("console_errors", [])
        if ceb and ceb != cea:
            diffs.append(((pn, "console_errors", "", 0), "console-errors", str(cea), str(ceb)))

    if not diffs:
        print("[compare] IDENTICAL  %s  vs  %s   (%d samples)" % (args.base, args.after, len(A)))
        return 0

    print("[compare] %d DIFFERENCE(S)  %s  vs  %s" % (len(diffs), args.base, args.after))
    for key, kind, va, vb in diffs[:MAX_PRINT]:
        print("  %s | %s" % (key, kind))
        print("    - %s" % va[:220])
        print("    + %s" % vb[:220])
    if len(diffs) > MAX_PRINT:
        print("  ... 另有 %d 处未显示" % (len(diffs) - MAX_PRINT))
    return 1


if __name__ == "__main__":
    sys.exit(main())
