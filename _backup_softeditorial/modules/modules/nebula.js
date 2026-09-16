/* ============================================================
   PL.04 · 自演化戴森知识球
   纯球状连接，无画布文字标签；知识点由智能体产出持续写入。
   ============================================================ */
import { AGENTS, DOCS, TOPICS } from '../data/documents.js';
import { dateKey } from './time.js';

DOCS.forEach(d => { d.time = d.time || ''; });

(function () {
  'use strict';
  const cv = document.getElementById('nebula');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const PAPER = '#f5f2ea';
  const INK = '#3a372f';
  const rgba = (hex, a) => {
    const v = parseInt(hex.slice(1), 16);
    return `rgba(${v >> 16 & 255},${v >> 8 & 255},${v & 255},${a})`;
  };
  const normalize = (v) => {
    const m = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / m, y: v.y / m, z: v.z / m };
  };
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const fibPoint = (i, n) => {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * GOLDEN;
    return { x: Math.cos(a) * r, y, z: Math.sin(a) * r };
  };

  const anchors = AGENTS.map((a, i) => ({ id: `agent-${a.key}`, key: a.key, color: a.color, p: fibPoint(i + 0.35, AGENTS.length + 0.7), pulse: 0 }));
  const anchorByKey = new Map(anchors.map(a => [a.key, a]));
  const points = [];
  const pulses = [];
  const sectorCounts = Object.fromEntries(AGENTS.map(a => [a.key, 0]));
  let links = [];
  let reservoirCursor = 0;

  let W = 0, H = 0, CX = 0, CY = 0, RX = 250, RY = 220;
  let rotY = 0.15, rotX = -0.18, spinY = reduceMotion ? 0 : 0.075, spinX = reduceMotion ? 0 : 0.012;
  let visible = false, raf = 0, lastMs = 0;
  let hover = -1;
  const readout = document.getElementById('neb-readout');

  function grainTile() {
    let seed = dateKey() >>> 0;
    const rand = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const g = c.getContext('2d'); const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) { const v = rand(); if (v < .42) { img.data[i] = 58; img.data[i + 1] = 55; img.data[i + 2] = 47; img.data[i + 3] = v * 16; } else if (v < .55) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = (v - .42) * 52; } }
    g.putImageData(img, 0, 0); return c;
  }
  const grain = ctx.createPattern(grainTile(), 'repeat');

  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    W = Math.max(2, r.width); H = Math.max(2, r.height);
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const padX = Math.max(28, Math.min(84, W * .032));
    const catalogW = W >= 3840 ? Math.min(500, W * .21) : W >= 2560 ? Math.min(420, W * .20) : W >= 1920 ? Math.min(320, W * .22) : Math.min(258, W * .215);
    const figW = W >= 3840 ? Math.min(700, W * .28) : W >= 2560 ? Math.min(560, W * .26) : W >= 1920 ? Math.min(430, W * .30) : (W > 1400 ? Math.min(340, W * .26) : Math.min(318, W * .245));
    const left = padX + catalogW + 46, right = W - padX - figW - 40, top = 138, bottom = H - 88;
    CX = (left + right) / 2; CY = (top + bottom) / 2;
    RX = Math.max(160, Math.min((right - left) / 2, W >= 3840 ? 1120 : W >= 2560 ? 760 : Infinity));
    RY = Math.max(140, Math.min((bottom - top) / 2, W >= 3840 ? 760 : W >= 2560 ? 540 : Infinity));
    kick();
  }

  function basisFor(a) {
    const ref = Math.abs(a.z) < .8 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
    const u = normalize(cross(a, ref));
    return { u, v: normalize(cross(a, u)) };
  }
  function sectorPoint(key, index) {
    const anchor = anchorByKey.get(key) || anchors[0];
    const basis = basisFor(anchor.p);
    const spread = .12 + Math.min(.92, index * .035);
    const angle = index * GOLDEN + (AGENTS.indexOf(AGENTS.find(a => a.key === key)) || 0) * .8;
    const tangent = { x: basis.u.x * Math.cos(angle) + basis.v.x * Math.sin(angle), y: basis.u.y * Math.cos(angle) + basis.v.y * Math.sin(angle), z: basis.u.z * Math.cos(angle) + basis.v.z * Math.sin(angle) };
    return normalize({ x: anchor.p.x * Math.cos(spread) + tangent.x * Math.sin(spread), y: anchor.p.y * Math.cos(spread) + tangent.y * Math.sin(spread), z: anchor.p.z * Math.cos(spread) + tangent.z * Math.sin(spread) });
  }
  function addPoint(agentKey, source, position) {
    const key = anchorByKey.has(agentKey) ? agentKey : AGENTS[0].key;
    const index = sectorCounts[key]++;
    const p = position || sectorPoint(key, index);
    const point = { id: `knowledge-${points.length + 1}`, agentKey: key, source: source || '', p, radius: .94 + ((index * 17) % 13) / 100, birth: performance.now(), phase: (index * .73) % TAU };
    points.push(point);
    pulses.push({ p, color: anchorByKey.get(key).color, born: performance.now(), radius: 0 });
    rebuildLinks(); updateReadout(); kick();
    return point;
  }
  function seed() {
    AGENTS.forEach(a => { sectorCounts[a.key] = 0; });
    DOCS.forEach(d => {
      addPoint(d.agent, d.title);
      (TOPICS[d.id] || []).forEach(topic => addPoint(d.agent, topic));
    });
  }
  function rebuildLinks() {
    links = [];
    points.forEach((p, i) => {
      const a = anchorByKey.get(p.agentKey);
      links.push({ a: { type: 'anchor', ref: a }, b: { type: 'point', ref: p }, family: 'agent' });
      const near = points.map((q, j) => ({ q, j, d: 1 - dot(p.p, q.p) })).filter(x => x.j !== i).sort((x, y) => x.d - y.d).slice(0, points.length > 100 ? 3 : 2);
      near.forEach(x => { if (i < x.j && x.d < .34) links.push({ a: { type: 'point', ref: p }, b: { type: 'point', ref: x.q }, family: 'mesh' }); });
    });
  }
  function targetCount() {
    const kb = window.World?.state?.kb?.total || 1284;
    return Math.min(190, Math.max(points.length, 42 + Math.floor(Math.sqrt(kb) * 3)));
  }
  function evolve() {
    if (points.length >= targetCount()) return;
    const key = AGENTS[reservoirCursor++ % AGENTS.length].key;
    addPoint(key, 'autonomous synthesis');
  }

  function rotate(p) {
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    let x = p.x * cy - p.z * sy, z = p.x * sy + p.z * cy;
    const cx = Math.cos(rotX), sx = Math.sin(rotX);
    return { x, y: p.y * cx - z * sx, z: p.y * sx + z * cx };
  }
  function project(p) {
    const q = rotate({ x: p.x, y: p.y, z: p.z });
    const perspective = 1 / (1 + q.z * .34);
    return { x: CX + q.x * RX * perspective, y: CY + q.y * RY * perspective, z: q.z, scale: perspective };
  }
  function itemPoint(item) { return item.type === 'anchor' ? item.ref.p : item.ref.p; }
  function render(ms) {
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    if (grain) { ctx.globalAlpha = .45; ctx.fillStyle = grain; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    const projected = new Map();
    anchors.forEach(a => projected.set(a.id, project(a.p)));
    points.forEach(p => projected.set(p.id, project(p.p)));

    const sortedLinks = links.slice().sort((a, b) => (projected.get(a.a.ref.id)?.z || 0) - (projected.get(b.a.ref.id)?.z || 0));
    sortedLinks.forEach(link => {
      const A = projected.get(link.a.ref.id), B = projected.get(link.b.ref.id); if (!A || !B) return;
      const alpha = link.family === 'agent' ? .22 + Math.max(0, A.z + B.z) * .08 : .12 + Math.max(0, A.z + B.z) * .06;
      ctx.strokeStyle = link.family === 'agent' ? rgba(anchorByKey.get(link.a.ref.agentKey || link.a.ref.key)?.color || INK, alpha) : rgba(INK, alpha);
      ctx.lineWidth = link.family === 'agent' ? 1.15 : .72;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    });

    const renderables = anchors.map(a => ({ kind: 'anchor', ref: a, s: projected.get(a.id) })).concat(points.map(p => ({ kind: 'point', ref: p, s: projected.get(p.id) }))).sort((a, b) => a.s.z - b.s.z);
    renderables.forEach(item => {
      const { ref, s } = item; const color = item.kind === 'anchor' ? ref.color : anchorByKey.get(ref.agentKey).color;
      const depth = .5 + (s.z + 1) * .25;
      if (item.kind === 'anchor') {
        const r = 6.5 * s.scale;
        ctx.globalAlpha = .35 + depth * .55; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(color, .7); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(s.x, s.y, r + 3.5, 0, TAU); ctx.stroke();
        if (ref.pulse > 0) { ctx.strokeStyle = rgba(color, ref.pulse * .65); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s.x, s.y, r + (1 - ref.pulse) * 22, 0, TAU); ctx.stroke(); }
      } else {
        const age = Math.min(1, (ms - ref.birth) / 900); const r = (2.2 + depth * 2.3) * s.scale;
        ctx.globalAlpha = .32 + depth * .62; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
        if (hover === points.indexOf(ref)) { ctx.strokeStyle = rgba(color, .9); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(s.x, s.y, r + 4, 0, TAU); ctx.stroke(); }
        if (age < 1) { ctx.strokeStyle = rgba(color, 1 - age); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(s.x, s.y, r + age * 18, 0, TAU); ctx.stroke(); }
      }
    });
    pulses.splice(0, pulses.length, ...pulses.filter(p => ms - p.born < 1100));
    pulses.forEach(p => { const s = project(p.p), age = (ms - p.born) / 1100; ctx.strokeStyle = rgba(p.color, 1 - age); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(s.x, s.y, 5 + age * 24, 0, TAU); ctx.stroke(); });
    anchors.forEach(a => { a.pulse = Math.max(0, a.pulse - (ms - (a._lastPulse || ms)) / 1100); a._lastPulse = ms; });
    ctx.globalAlpha = 1; updateReadout();
  }
  function updateReadout() {
    if (!readout) return;
    const target = targetCount();
    readout.textContent = `节点 ${points.length + anchors.length} · 球状连接 ${links.length} · 覆盖率 ${Math.min(100, Math.round(points.length / target * 100))}%`;
  }
  function frame(ms) {
    raf = 0; if (!visible) { lastMs = 0; return; }
    if (!lastMs) lastMs = ms;
    const dt = Math.min(.05, (ms - lastMs) / 1000); lastMs = ms;
    if (!reduceMotion) { rotY += spinY * dt; rotX += spinX * dt; }
    render(ms); if (!reduceMotion || pulses.length) kick();
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  let drag = false, lastX = 0, lastY = 0;
  cv.addEventListener('pointerdown', e => { drag = true; lastX = e.clientX; lastY = e.clientY; cv.setPointerCapture?.(e.pointerId); cv.classList.add('is-dragging'); });
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    if (drag) { rotY += (e.clientX - lastX) * .006; rotX += (e.clientY - lastY) * .006; lastX = e.clientX; lastY = e.clientY; kick(); return; }
    let best = -1, bd = 1e9; points.forEach((p, i) => { const s = project(p.p), d = Math.hypot(e.clientX - r.left - s.x, e.clientY - r.top - s.y); if (d < bd && d < 14) { bd = d; best = i; } });
    if (best !== hover) { hover = best; kick(); }
  });
  cv.addEventListener('pointerup', () => { drag = false; cv.classList.remove('is-dragging'); });
  cv.addEventListener('pointerleave', () => { drag = false; hover = -1; cv.classList.remove('is-dragging'); });

  const catRows = [...document.querySelectorAll('.atlas-catalog .shelf-row[data-doc]')];
  catRows.forEach(row => row.addEventListener('mouseenter', () => {
    const doc = DOCS.find(d => d.id === row.dataset.doc); if (doc) pulse(doc.agent);
  }));
  function pulse(key) { const a = anchorByKey.get(key); if (a) { a.pulse = 1; a._lastPulse = performance.now(); kick(); } }

  window.Nebula = {
    addKnowledge(agentKey, source) { return addPoint(agentKey, source); },
    pulse,
    stats: () => ({ points: points.length + anchors.length, links: links.length, coverage: Math.min(100, Math.round(points.length / targetCount() * 100)) }),
    focus(key) { pulse(key); },
    unfocus() {},
    docs: () => DOCS,
    debug: /(^|[?&])debug/.test(location.search) ? () => ({ points: points.length, links: links.length, visible, coverage: Math.round(points.length / targetCount() * 100) }) : undefined
  };

  seed(); resize();
  const page = cv.closest('.reel__page');
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; if (visible) { kick(); } })).observe(page || cv);
  setInterval(evolve, reduceMotion ? 6000 : 2800);
  window.addEventListener('resize', resize);
  render(performance.now());
})();

const Nebula = window.Nebula;
export { Nebula };
