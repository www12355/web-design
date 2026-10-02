# -*- coding: utf-8 -*-
"""员工卡截图工具：employee.html 指定员工，多视口输出 PNG。
用法: py -3 tools/shot-emp.py <uid> <out.png> [w] [h] [--carousel]
"""
import sys, asyncio, os
from playwright.async_api import async_playwright

async def main():
    uid = sys.argv[1] if len(sys.argv) > 1 else 'designer'
    out = sys.argv[2] if len(sys.argv) > 2 else 'emp-redesign.png'
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 1920
    h = int(sys.argv[4]) if len(sys.argv) > 4 else 1080
    base = os.environ.get('EMP_BASE', 'http://localhost:4173/employee.html')
    url = base
    if uid != 'carousel':
        url += f'?emp={uid}'
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='msedge')
        page = await browser.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await page.goto(url, wait_until='networkidle')
        await page.wait_for_timeout(1800)
        await page.screenshot(path=out)
        await browser.close()
        if errors:
            print('CONSOLE/PAGE ERRORS:')
            for e in errors[:8]:
                print(' -', e[:200])
        else:
            print('no console errors')

asyncio.run(main())
