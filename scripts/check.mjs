#!/usr/bin/env node
/* ============================================================
   scripts/check.mjs · 零依赖质量门禁（npm run check / npm test）
   1) 引用完整性：HTML src/href、JS import、CSS @import 是否全部可解析
   2) 语法检查：node --check 逐个 JS 文件
   3) 未用导出：启发式扫描 export 名称在全仓的引用计数（仅告警）
   4) World 冒烟：Node 内 stub 浏览器环境，验证 reducer 与只读派生 API
   5) 颜色等价：ball-core 与原两套实现的逐值等价回归（1100 组）
   失败即 process.exit(1)。零运行时依赖、零 devDependency。
   ============================================================ */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PAGES = ['index.html', 'screen1.html', 'window2.html'];

const failures = [];
const warnings = [];
const passes = [];
const ok = (name, extra) => passes.push(name + (extra ? ` — ${extra}` : ''));
const fail = (name, detail) => failures.push(name + (detail ? ` — ${detail}` : ''));
const warn = (msg) => warnings.push(msg);

const rel = (p) => p.slice(ROOT.length + 1).split('\\').join('/');

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.includes(extname(e.name))) out.push(p);
  }
  return out;
}

/* ---------------- 1. 引用完整性 ---------------- */
(function refs() {
  const missing = [];
  for (const page of HTML_PAGES) {
    const p = join(ROOT, page);
    if (!existsSync(p)) { missing.push(`${page}（缺文件）`); continue; }
    const txt = readFileSync(p, 'utf8');
    for (const m of txt.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const u = m[1];
      if (/^(https?:|data:|#|\/\/)/.test(u)) continue;
      if (!existsSync(join(ROOT, u))) missing.push(`${page} → ${u}`);
    }
  }
  for (const js of walk(join(ROOT, 'src'), ['.js'])) {
    const txt = readFileSync(js, 'utf8');
    for (const m of txt.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const u = m[1];
      if (!u.startsWith('.')) continue;
      if (!existsSync(resolve(dirname(js), u))) missing.push(`${rel(js)} → ${u}`);
    }
  }
  for (const css of walk(join(ROOT, 'src'), ['.css'])) {
    const txt = readFileSync(css, 'utf8');
    for (const m of txt.matchAll(/@import\s+(?:url\()?["']([^"')]+)["']?/g)) {
      const u = m[1];
      if (/^https?:/.test(u)) continue;
      if (!existsSync(resolve(dirname(css), u))) missing.push(`${rel(css)} → ${u}`);
    }
  }
  if (missing.length) fail('引用完整性', missing.join('; '));
  else ok('引用完整性', 'HTML/JS/CSS 全部可解析');
})();

/* ---------------- 2. 语法检查 ---------------- */
(function syntax() {
  const files = [
    join(ROOT, 'serve.js'),
    join(ROOT, 'eslint.config.js'),
    ...walk(join(ROOT, 'src'), ['.js']),
    ...walk(join(ROOT, 'scripts'), ['.mjs']),
    ...walk(join(ROOT, 'scripts'), ['.js']),
    ...walk(join(ROOT, 'tools'), ['.mjs'])
  ].filter((f) => existsSync(f) && statSync(f).isFile());
  const bad = [];
  for (const f of files) {
    try {
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    } catch (e) {
      const line = String(e.stderr || e.message).split('\n').find((l) => l.trim()) || 'parse error';
      bad.push(`${rel(f)}: ${line.trim()}`);
    }
  }
  if (bad.length) fail('语法检查', bad.join(' | '));
  else ok('语法检查', `${files.length} 个 JS 文件`);
})();

/* ---------------- 3. 未用导出（启发式，仅告警） ---------------- */
(function unusedExports() {
  const jsFiles = walk(join(ROOT, 'src'), ['.js']);
  const corpus = [
    ...HTML_PAGES.map((p) => readFileSync(join(ROOT, p), 'utf8')),
    ...jsFiles.map((f) => readFileSync(f, 'utf8'))
  ].join('\n');
  const unused = [];
  const count = (name) => (corpus.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
  for (const f of jsFiles) {
    const txt = readFileSync(f, 'utf8');
    for (const m of txt.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) {
      if (count(m[1]) <= 1) unused.push(`${m[1]} (${rel(f)})`);
    }
    for (const m of txt.matchAll(/export\s*\{([^}]+)\}/g)) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        if (name && count(name) <= 1) unused.push(`${name} (${rel(f)})`);
      }
    }
  }
  if (unused.length) warn(`未用导出（启发式，请人工确认）：${[...new Set(unused)].join(', ')}`);
  else ok('未用导出', '未发现零引用导出');
})();

/* ---------------- 4. World 冒烟（stub 浏览器环境） ---------------- */
async function worldSmoke() {
  const store = new Map();
  const noop = () => 0;
  const classList = { contains: () => false, add() {}, remove() {}, toggle() {} };
  globalThis.window = globalThis;
  globalThis.document = {
    body: { dataset: { worldPrio: '1' }, classList },
    hidden: false,
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null
  };
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} });
  globalThis.requestAnimationFrame = noop;
  globalThis.cancelAnimationFrame = noop;
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  /* 关键：冻结定时器，避免 startSync 拉起心跳/轮询导致进程无法退出 */
  globalThis.setTimeout = noop;
  globalThis.setInterval = noop;
  globalThis.clearTimeout = noop;
  globalThis.clearInterval = noop;

  const mod = await import(pathToFileURL(join(ROOT, 'src/modules/world.js')).href);
  const World = mod.World;
  if (!World) throw new Error('World 未导出');

  const tplCount = Object.keys(World.templates || {}).length;
  if (tplCount < 4) throw new Error(`templates 数量异常：${tplCount}`);

  const st = World.state;
  for (const k of ['employees', 'tasks', 'orders', 'kb', 'ledger', 'counters', 'time']) {
    if (!(k in st)) throw new Error(`World.state 缺少 ${k}`);
  }
  const firstTpl = Object.keys(World.templates)[0];
  World.setTemplate(firstTpl);
  if (World.template !== firstTpl) throw new Error('setTemplate 未生效');

  World.setSpeed(2);
  if (World.speed !== 2) throw new Error('setSpeed 未生效');

  World.dispatch({ id: 'smoke-1', title: '冒烟任务', owner: 'planner', value: 1000 });
  if (!st.tasks['smoke-1']) throw new Error('dispatch 未生成任务');

  World.completeTask('smoke-1');
  if (st.tasks['smoke-1'].status !== 'done') {
    throw new Error(`completeTask 状态异常：${st.tasks['smoke-1'].status}`);
  }

  const info = World.leaderInfo();
  for (const k of ['syncOK', 'isLeader', 'lease', 'ageMs', 'live', 'prio']) {
    if (!(k in info)) throw new Error(`leaderInfo 缺少 ${k}`);
  }
  if (World.leaderKey !== 'aic-world-leader-v1') throw new Error('leaderKey 不符');

  const un = World.on(() => {});
  if (typeof un !== 'function') throw new Error('World.on 未返回退订函数');
  un();

  return `templates=${tplCount} tasks=${Object.keys(st.tasks).length} kb=${st.kb.total} events=${(st.events || []).length}`;
}

/* ---------------- 5. 颜色等价（ball-core 回归） ---------------- */
function colorEquivalence() {
  const src = readFileSync(join(ROOT, 'src/modules/ball-core.js'), 'utf8');
  const win = {};
  new Function('window', src)(win);
  const BC = win.BallCore;
  if (!BC) throw new Error('BallCore 未定义');

  const origMix = (from, to, t) => {
    const parse = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
    const a = parse(from), b = parse(to);
    const c = a.map((x, i) => Math.round(x + (b[i] - x) * t));
    return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
  };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const oHex = (h) => {
    let s = h.replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const oRgb = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const origLerp = (a, b, t) => {
    if (a === b) return b;
    const A = oHex(a), B = oHex(b);
    return oRgb(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  };

  const hexes = ['#000000', '#ffffff', '#eafdff', '#ff5a6a', '#2dd4bf', '#123456', '#abcdef', '#f472b6', '#0e1a2c', '#cfe7ff'];
  let bad = 0, total = 0;
  for (const a of hexes) {
    for (const b of hexes) {
      for (let i = 0; i <= 10; i++) {
        const t = i / 10; total++;
        const x = BC.lerpColor(a, b, t);
        if (x !== origMix(a, b, t) || x !== origLerp(a, b, t)) bad++;
      }
    }
  }
  if (bad) throw new Error(`${bad}/${total} 组与两套原实现不一致`);
  if (BC.mixHex !== BC.lerpColor) throw new Error('mixHex 未指向统一实现');
  if (BC.COLORS.length !== 12) throw new Error(`调色板长度异常：${BC.COLORS.length}`);
  return `hexToRgb/rgbToHex/lerpColor 与原实现 ${total} 组逐值一致，COLORS=${BC.COLORS.length}`;
}

/* ---------------- 汇总 ---------------- */
(async () => {
  try { ok('颜色等价', colorEquivalence()); } catch (e) { fail('颜色等价', e.message); }
  try { ok('World 冒烟', await worldSmoke()); } catch (e) { fail('World 冒烟', e.message); }

  console.log('\n=== scripts/check.mjs ===');
  for (const p of passes) console.log(`  PASS  ${p}`);
  for (const w of warnings) console.log(`  WARN  ${w}`);
  for (const f of failures) console.log(`  FAIL  ${f}`);
  console.log(`\n通过 ${passes.length} · 告警 ${warnings.length} · 失败 ${failures.length}\n`);

  if (failures.length) process.exit(1);
})();
