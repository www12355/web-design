# -*- coding: utf-8 -*-
"""验证独立页自动轮播 + URL 跟随 / 轮播模式无回归。
用法: py -3 tools/verify-emp-carousel.py
"""
import asyncio, os
from playwright.async_api import async_playwright

BASE = os.environ.get('EMP_BASE', 'http://localhost:4173/employee.html')

async def snapshot(page):
    return await page.evaluate("""() => ({
        id: document.getElementById('emp-id').textContent,
        search: location.search,
        dotOn: [...document.querySelectorAll('.emp-dot')].findIndex(d => d.getAttribute('aria-selected') === 'true')
    })""")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='msedge')
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

        # --- 独立页：?emp=designer 起步，6s 后自动步进，URL 跟随 ---
        await page.goto(BASE + '?emp=designer', wait_until='networkidle')
        await page.wait_for_timeout(1200)
        s0 = await snapshot(page)
        assert s0['id'] == 'DE-01', f"初始应展示 DE-01，实际 {s0['id']}"
        assert 'designer' in s0['search'], f"初始 URL 应含 designer，实际 {s0['search']}"
        await page.wait_for_timeout(7500)   # 跨过一个 6s 步进
        s1 = await snapshot(page)
        assert s1['id'] != 'DE-01', f"7.5s 后应已自动步进，实际仍为 {s1['id']}"
        assert s1['id'] in s1['search'].lower() or s1['search'] != s0['search'], f"URL 未跟随: {s1['search']}"
        # URL 中的 uid 与展示成员一致（emp= 是 uid 不是显示 ID，需用点选对照：直接读链接 href）
        link_href = await page.evaluate("document.getElementById('emp-id').textContent")
        print(f"独立页: {s0['id']} {s0['search']}  →  {s1['id']} {s1['search']}  ✓")
        await page.screenshot(path='tools/redesign/carousel-standalone-after-step.png')

        # 键盘 ← →：页内切换 + URL 同步
        await page.keyboard.press('ArrowRight')
        await page.wait_for_timeout(400)
        s2 = await snapshot(page)
        assert s2['id'] != s1['id'], "ArrowRight 应页内切换"
        print(f"键盘 →: {s1['id']} → {s2['id']} {s2['search']}  ✓")

        # 圆点点选：跳到第 0 位
        await page.evaluate("[...document.querySelectorAll('.emp-dot')][0].click()")
        await page.wait_for_timeout(400)
        s3 = await snapshot(page)
        assert s3['dotOn'] == 0, f"点选圆点 0 后 aria-selected 应为 0，实际 {s3['dotOn']}"
        print(f"圆点切换: → {s3['id']} (dot {s3['dotOn']})  ✓")

        # --- 轮播模式（无参数）：步进正常，URL 不被写入参数 ---
        await page.goto(BASE, wait_until='networkidle')
        await page.wait_for_timeout(1200)
        c0 = await snapshot(page)
        await page.wait_for_timeout(7500)
        c1 = await snapshot(page)
        assert c1['id'] != c0['id'], "轮播模式应继续步进"
        assert c1['search'] == '', f"轮播模式 URL 不应带参数，实际 {c1['search']}"
        print(f"轮播模式: {c0['id']} → {c1['id']}，URL 无参数  ✓")

        # --- 独立页深链写法：显示 ID（DE-01）也能命中 ---
        await page.goto(BASE + '?emp=QC-01', wait_until='networkidle')
        await page.wait_for_timeout(1000)
        q = await snapshot(page)
        assert q['id'] == 'QC-01', f"显示 ID 深链应命中 QC-01，实际 {q['id']}"
        print(f"显示 ID 深链: ?emp=QC-01 → {q['id']}  ✓")

        await browser.close()
        if errors:
            print('CONSOLE/PAGE ERRORS:')
            for e in errors[:8]:
                print(' -', e[:200])
            raise SystemExit(1)
        print('ALL PASS · no console errors')

asyncio.run(main())
