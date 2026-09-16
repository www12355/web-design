/* ============================================================
   知识图谱 v3 · 平面图谱 — PL.04 Knowledge Graph
   知识库（中心）→ 智能体球（bloub 静态缩小版，不动）→ 文档卡 → 知识点
   常规状态为静态平面图；点击节点放大集群，拖拽平移，悬停高亮。
   ============================================================ */
(function () {
  'use strict';

  const cv = document.getElementById('nebula');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 数据：智能体 / 文档 / 知识点 ---------- */
  const AGENTS = [
    { key: 'main',     name: '主 AI', color: '#1f6f5c', rel: '统筹', ball: { shape: 'cercle',   ink: '#ffffff', paper: '#d8d0bf' }, expr: 'attentif' },
    { key: 'planner',  name: '规划',  color: '#3b93f0', rel: '规划', ball: { shape: 'hexagone', ink: '#3b93f0', paper: '#f5f2ea' }, expr: 'neutre'   },
    { key: 'writer',   name: '内容',  color: '#2fbfa0', rel: '撰写', ball: { shape: 'nuage',    ink: '#2fbfa0', paper: '#f5f2ea' }, expr: 'heureux'  },
    { key: 'analyst',  name: '数据',  color: '#f08a24', rel: '分析', ball: { shape: 'galet',    ink: '#f08a24', paper: '#f5f2ea' }, expr: 'attentif' },
    { key: 'designer', name: '设计',  color: '#e152b0', rel: '设计', ball: { shape: 'goutte',   ink: '#e152b0', paper: '#f5f2ea' }, expr: 'curieux'  },
    { key: 'engineer', name: '工程',  color: '#8b5cf6', rel: '开发', ball: { shape: 'capsule',  ink: '#8b5cf6', paper: '#f5f2ea' }, expr: 'neutre'   }
  ];
  const DOCS = [
    { id: 'doc-integrate', agent: 'main',     title: '发布方案整合稿 v0.7',    type: 'PPTX', ft: 'ft-ppt',  time: '11:52' },
    { id: 'doc-plan7',     agent: 'main',     title: '执行序列 · 7 子任务拆解', type: 'PDF',  ft: 'ft-pdf',  time: '11:55' },
    { id: 'doc-prd',       agent: 'planner',  title: '产品需求规格书 v2.3',    type: 'DOCX', ft: 'ft-word', time: '10:08' },
    { id: 'doc-schedule',  agent: 'planner',  title: '传播节奏排期表 v1.2',    type: 'XLSX', ft: 'ft-xls',  time: '09:47' },
    { id: 'doc-copy',      agent: 'writer',   title: '发布会主文案 v4',        type: 'DOCX', ft: 'ft-word', time: '11:20' },
    { id: 'doc-faq',       agent: 'writer',   title: '对外口径 FAQ 32 条',     type: 'DOCX', ft: 'ft-word', time: '10:55' },
    { id: 'doc-report',    agent: 'analyst',  title: '市场数据分析报告 v1.8',  type: 'PDF',  ft: 'ft-pdf',  time: '11:41' },
    { id: 'doc-brand',     agent: 'designer', title: '品牌视觉规范 v3.0',      type: 'FIG',  ft: 'ft-fig',  time: '11:58' },
    { id: 'doc-landing',   agent: 'engineer', title: '落地页前端工程 v0.9-rc', type: 'REPO', ft: 'ft-code', time: '11:12' },
    { id: 'doc-api',       agent: 'engineer', title: '联调接口时序说明 v1.0',  type: 'PDF',  ft: 'ft-pdf',  time: '11:30' }
  ];
  const TOPICS = {
    'doc-integrate': ['叙事主线', '数据引用', '页面节奏', '讲稿分页', '彩排反馈', '风险预案', '附件索引'],
    'doc-plan7':     ['依赖拆解', '里程碑', '并行策略', '资源平衡', '回滚点', '交付窗口', '状态同步'],
    'doc-prd':       ['用户故事', '功能范围', '验收标准', '边界条件', '术语表', '变更记录'],
    'doc-schedule':  ['传播节奏', '渠道排期', '素材就绪', '审核流', '缓冲策略'],
    'doc-copy':      ['主标题方案', '正文段落', '口号变体', '灰度自查', '终校清单'],
    'doc-faq':       ['高频问题', '口径统一', '敏感应对', '更新日志'],
    'doc-report':    ['漏斗异常', '埋点补录', '渠道对比', '移动端回落', '结论摘要'],
    'doc-brand':     ['色板对比度', '字体层级', '版式栅格', '组件样式', '附页索引'],
    'doc-landing':   ['路由结构', '静态资源', '表单校验', '预览部署'],
    'doc-api':       ['时序图', '字段字典', '错误码', '联调用例']
  };

  /* ---------- 图谱构建（节点 + 层级边） ---------- */
  const NODES = [];
  const byId = new Map();
  function addNode(n) { NODES.push(n); byId.set(n.id, n); return n; }

  const core = addNode({ id: 'core', kind: 'core', label: '知识库', u: { x: 0, y: 0 }, r: 30 });
  const TAU = Math.PI * 2, SEC = TAU / AGENTS.length, SEC_LIM = 26 * Math.PI / 180;
  const clampAng = (a, center) => {
    let d = a - center;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return center + Math.max(-SEC_LIM, Math.min(SEC_LIM, d));
  };
  const angleOf = {};
  AGENTS.forEach((a, i) => {
    const mid = -Math.PI / 2 + i * SEC;
    angleOf[a.key] = mid;
    addNode({
      id: 'agent-' + a.key, kind: 'agent', agentKey: a.key,
      label: a.name, color: a.color, rel: a.rel, ang: mid,
      u: { x: Math.cos(mid) * 0.40, y: Math.sin(mid) * 0.44 }, r: 36
    });
  });
  DOCS.forEach(d => {
    const a = angleOf[d.agent];
    const same = DOCS.filter(x => x.agent === d.agent);
    const k = same.indexOf(d);
    const ang = clampAng(a + (k - (same.length - 1) / 2) * 0.44, a);
    addNode({
      id: d.id, kind: 'doc', doc: d, agentKey: d.agent, ang,
      label: d.title, u: { x: Math.cos(ang) * 0.66, y: Math.sin(ang) * 0.72 }, r: 32
    });
  });
  DOCS.forEach(d => {
    const topics = TOPICS[d.id] || [];
    const dn = byId.get(d.id);
    const base = Math.atan2(dn.u.y, dn.u.x);
    topics.forEach((label, k) => {
      const row = k % 2; // 内外两排交错
      const t = Math.floor(k / 2) - (Math.ceil(topics.length / 2) - 1) / 2;
      const ang = clampAng(base + t * 0.165 + (row ? 0.055 : -0.02), base);
      const rad = row ? 0.96 : 0.84;
      addNode({
        id: d.id + '#' + k, kind: 'point', docId: d.id, agentKey: d.agent, ang,
        label, u: { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 1.05 }, r: 5
      });
    });
  });

  const EDGES = [];
  AGENTS.forEach(a => EDGES.push({ a: 'core', b: 'agent-' + a.key, label: a.rel }));
  DOCS.forEach(d => EDGES.push({ a: 'agent-' + d.agent, b: d.id, label: '产出' }));
  DOCS.forEach(d => (TOPICS[d.id] || []).forEach((_, k) => EDGES.push({ a: d.id, b: d.id + '#' + k, label: '包含' })));

  /* ---------- 纸纹 ---------- */
  function makeCanvas(s) { const c = document.createElement('canvas'); c.width = c.height = s; return c; }
  function grainTile() {
    const r = (function (s) { let x = s >>> 0; return () => { x |= 0; x = (x + 0x6D2B79F5) | 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(20260912);
    const s = 160, c = makeCanvas(s), g = c.getContext('2d');
    const img = g.createImageData(s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r();
      if (v < 0.42) { img.data[i] = 58; img.data[i + 1] = 55; img.data[i + 2] = 47; img.data[i + 3] = v * 16; }
      else if (v < 0.55) { img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 250; img.data[i + 3] = (v - 0.42) * 52; }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  const GRAIN = ctx.createPattern(grainTile(), 'repeat');
  const INK = '#3a372f', INK_SOFT = '#6d675c', FAINT = '#8a857a', PAPER = '#f5f2ea';
  const rgba = (hex, a) => {
    const v = parseInt(hex.slice(1), 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
  };
  const SERIF = 'Georgia, "Times New Roman", "Songti SC", "Noto Serif SC", serif';

  /* ---------- 布局投影 ---------- */
  let W = 0, H = 0, CX = 0, CY = 0, RX = 300, RY = 240;
  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(2, r.width); H = Math.max(2, r.height);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const padX = Math.max(28, Math.min(84, W * 0.032));
    const wide = W >= 1920;
    const catalogW = W >= 3840 ? Math.min(500, W * 0.21) : W >= 2560 ? Math.min(420, W * 0.20) : wide ? Math.min(320, W * 0.22) : Math.min(258, W * 0.215);
    const figW = W >= 3840 ? Math.min(700, W * 0.28) : W >= 2560 ? Math.min(560, W * 0.26) : wide ? Math.min(430, W * 0.30) : (W > 1400 ? Math.min(340, W * 0.26) : Math.min(318, W * 0.245));
    const left = padX + catalogW + 46, right = W - padX - figW - 40;
    const top = 138, bottom = H - 88;
    CX = (left + right) / 2; CY = (top + bottom) / 2;
    RX = Math.max(160, Math.min((right - left) / 2, W >= 3840 ? 1120 : W >= 2560 ? 760 : Infinity));
    RY = Math.max(140, Math.min((bottom - top) / 2, W >= 3840 ? 760 : W >= 2560 ? 540 : Infinity));
    needRender = true;
    kick();
  }

  const cam = { z: 1, px: 0, py: 0, tz: 1, tpx: 0, tpy: 0 };
  const screen = new Array(NODES.length);
  function project(n) {
    const bx = CX + n.u.x * RX + cam.px;
    const by = CY + n.u.y * RY + cam.py;
    return { x: W / 2 + (bx - W / 2) * cam.z, y: H / 2 + (by - H / 2) * cam.z };
  }

  /* ---------- 聚焦集群 ---------- */
  let focusId = null, hoverIdx = -1;
  function clusterOf(id) {
    const set = new Set(['core']);
    const n = byId.get(id);
    if (!n) return set;
    set.add(id);
    if (n.kind === 'agent') {
      NODES.forEach(o => { if (o.agentKey === n.agentKey) set.add(o.id); });
    } else if (n.kind === 'doc') {
      set.add('agent-' + n.agentKey);
      NODES.forEach(o => { if (o.docId === n.id) set.add(o.id); });
    } else if (n.kind === 'point') {
      set.add(n.docId);
      set.add('agent-' + n.agentKey);
    }
    return set;
  }
  function dimOf(n) {
    if (!focusId) return 1;
    const cs = clusterOf(focusId);
    if (cs.has(n.id)) return 1;
    if (n.kind === 'agent' || n.kind === 'core') return 0.3;
    return 0.07;   /* 聚焦时让圈外幽灵标签更彻底退后，减少视觉噪音 */
  }

  /* ---------- DOM 节点层（智能体球 + 文档卡） ---------- */
  const layer = document.getElementById('graph-nodes');
  const domNodes = []; // { el, node }
  function buildDom() {
    if (!layer) return;
    const frag = document.createDocumentFragment();
    AGENTS.forEach(a => {
      const n = byId.get('agent-' + a.key);
      const el = document.createElement('div');
      el.className = 'gnode gnode--agent';
      el.dataset.node = n.id;
      const docs = DOCS.filter(d => d.agent === a.key);
      const recent = docs[docs.length - 1];
      el.innerHTML =
        `<div class="gnode__ball">${window.Bloub.static({ size: 62, shape: a.ball.shape, ink: a.ball.ink, paper: a.ball.paper, expression: a.expr, state: 'idle', frozenAt: 1 })}</div>` +
        `<div class="gnode__plate" style="--gc:${a.color}"><b>${a.name}</b><span>产出 ${docs.length} 项 · 最近「${recent ? recent.title.split(' ')[0] : '—'}」</span></div>`;
      frag.appendChild(el);
      domNodes.push({ el, node: n });
    });
    DOCS.forEach(d => {
      const n = byId.get(d.id);
      const el = document.createElement('div');
      el.className = 'gnode gnode--doc';
      el.dataset.node = n.id;
      el.style.setProperty('--gc', (AGENTS.find(a => a.key === d.agent) || {}).color);
      el.innerHTML =
        `<span class="gnode__ic"><svg class="ft-ic ft-ic--xs" aria-hidden="true"><use href="#${d.ft}"/></svg></span>` +
        `<span class="gnode__tx"><span class="gnode__title" title="${d.title}">${d.title}</span><span class="gnode__meta">${d.type} · 入库 ${d.time}</span></span>`;
      frag.appendChild(el);
      domNodes.push({ el, node: n });
    });
    layer.appendChild(frag);
    // 量取文档卡半宽高（连线按真实边缘裁切，保证"接到"卡片上）
    requestAnimationFrame(() => {
      domNodes.forEach(dn => {
        if (dn.node.kind !== 'doc') return;
        dn.node.hw = dn.el.offsetWidth / 2 + 6;
        dn.node.hh = dn.el.offsetHeight / 2 + 5;
      });
      needRender = true; kick();
    });
  }
  function syncDom() {
    for (const dn of domNodes) {
      const p = screen[NODES.indexOf(dn.node)];
      if (!p) continue;
      dn.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%) scale(${cam.z.toFixed(3)})`;
      dn.el.style.opacity = dimOf(dn.node).toFixed(2);
    }
  }

  /* ---------- 手记卡 / tooltip / 读数 ---------- */
  const focusCard = document.getElementById('neb-focus');
  const elOwner = document.getElementById('neb-focus-owner');
  const elTitle = document.getElementById('neb-focus-title');
  const elMeta = document.getElementById('neb-focus-meta');
  const elNo = document.getElementById('neb-focus-no');
  const elReadout = document.getElementById('neb-readout');
  const tip = document.getElementById('graph-tip');
  const catRows = Array.from(document.querySelectorAll('.atlas-catalog .shelf-row[data-doc]'));
  const docIndexById = new Map(DOCS.map((d, i) => [d.id, i]));

  function highlightRow(docId) {
    catRows.forEach(r => r.classList.toggle('is-hl', r.dataset.doc === docId));
  }
  function setCard(docNode) {
    if (!focusCard) return;
    if (!docNode) { focusCard.classList.remove('show'); focusCard.__id = null; highlightRow(null); return; }
    if (focusCard.__id === docNode.id) return;
    const d = docNode.doc;
    const agent = AGENTS.find(a => a.key === d.agent);
    elOwner.textContent = agent.name;
    elOwner.style.color = agent.color;
    elNo.textContent = 'N°' + String(DOCS.indexOf(d) + 1).padStart(2, '0');
    elTitle.textContent = d.title;
    elMeta.innerHTML = `<svg class="ft-ic ft-ic--xs" aria-hidden="true"><use href="#${d.ft}"/></svg> ${d.type} · 入库 ${d.time} · 分区 ${agent.name}`;
    focusCard.querySelector('.neb-focus__tag i').style.background = agent.color;
    focusCard.classList.add('show');
    focusCard.__id = docNode.id;
    highlightRow(d.id);
  }
  function showTip(x, y, html) {
    if (!tip) return;
    tip.innerHTML = html;
    tip.classList.add('show');
    const r = cv.getBoundingClientRect();
    tip.style.left = Math.min(r.width - 180, x + 14) + 'px';
    tip.style.top = Math.max(46, y - 40) + 'px';
  }
  function hideTip() { if (tip) tip.classList.remove('show'); }
  function tipHtml(n) {
    if (n.kind === 'agent') {
      const docs = DOCS.filter(d => d.agent === n.agentKey);
      return `<b>${n.label}</b><span>已记录 ${docs.length} 项 · ${docs.map(d => d.title.split(' ')[0]).join(' / ')}</span>`;
    }
    if (n.kind === 'doc') return `<b>${n.doc.title}</b><span>${n.doc.type} · 入库 ${n.doc.time} · 点击放大知识簇</span>`;
    if (n.kind === 'point') { const d = byId.get(n.docId).doc; return `<b>${n.label}</b><span>收录于 ${d.title}</span>`; }
    return `<b>知识库</b><span>全部记录的总源</span>`;
  }

  /* ---------- 交互 ---------- */
  let dragDown = false, dragMoved = false, lastPX = 0, lastPY = 0;
  function nodeAt(x, y) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < NODES.length; i++) {
      const n = NODES[i], p = screen[i];
      if (!p || dimOf(n) < 0.3) continue;
      if (n.kind === 'doc') {
        if (Math.abs(x - p.x) < 66 * cam.z && Math.abs(y - p.y) < 15 * cam.z) {
          const d = Math.hypot(x - p.x, (y - p.y) * 3);
          if (d < bd) { bd = d; best = i; }
        }
      } else {
        const rr = (n.r + 8) * cam.z;
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < rr && d < bd) { bd = d; best = i; }
      }
    }
    return best;
  }
  function focusNode(n) {
    focusId = n.id;
    const b = { x: CX + n.u.x * RX, y: CY + n.u.y * RY };
    cam.tz = n.kind === 'point' ? 2.3 : n.kind === 'doc' ? 1.85 : n.kind === 'agent' ? 1.5 : 1.25;
    cam.tpx = W / 2 - b.x;
    cam.tpy = H / 2 - b.y;
    if (n.kind === 'doc') setCard(n); else setCard(null);
    kick();
  }
  function unfocus() {
    focusId = null;
    cam.tz = 1; cam.tpx = 0; cam.tpy = 0;
    setCard(null);
    kick();
  }

  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    try { cv.setPointerCapture(e.pointerId); } catch (_) { }
    dragDown = true; dragMoved = false;
    lastPX = e.clientX; lastPY = e.clientY;
    cv.classList.add('is-dragging');
  });
  cv.addEventListener('pointermove', e => {
    if (dragDown) {
      const dx = e.clientX - lastPX, dy = e.clientY - lastPY;
      if (dragMoved || Math.abs(dx) + Math.abs(dy) > 4) {
        dragMoved = true;
        cam.px -= dx / cam.z; cam.py -= dy / cam.z;
        cam.tpx = cam.px; cam.tpy = cam.py;
        lastPX = e.clientX; lastPY = e.clientY;
        hideTip();
        kick();
      }
      return;
    }
    const r = cv.getBoundingClientRect();
    const hit = nodeAt(e.clientX - r.left, e.clientY - r.top);
    if (hit !== hoverIdx) {
      hoverIdx = hit;
      cv.classList.toggle('is-pick', hit >= 0);
      needRender = true;
      kick();
    }
    if (hit >= 0) showTip(e.clientX - r.left, e.clientY - r.top, tipHtml(NODES[hit]));
    else hideTip();
  });
  cv.addEventListener('pointerup', e => {
    if (!dragDown) return;
    dragDown = false;
    cv.classList.remove('is-dragging');
    if (!dragMoved) {
      const r = cv.getBoundingClientRect();
      const hit = nodeAt(e.clientX - r.left, e.clientY - r.top);
      if (hit >= 0) {
        const n = NODES[hit];
        if (focusId === n.id) unfocus();
        else focusNode(n);
      } else if (focusId) unfocus();
    }
  });
  cv.addEventListener('pointerleave', () => {
    if (!dragDown) { hoverIdx = -1; cv.classList.remove('is-pick'); hideTip(); needRender = true; kick(); }
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && focusId) unfocus();
  });

  /* 星表行联动：悬停高亮 + 点击放大 */
  catRows.forEach(row => {
    const id = row.dataset.doc;
    const idx = NODES.findIndex(n => n.id === id);
    row.addEventListener('mouseenter', () => { if (idx >= 0) { hoverIdx = idx; needRender = true; kick(); } });
    row.addEventListener('mouseleave', () => { hoverIdx = -1; needRender = true; kick(); });
    row.addEventListener('click', () => { if (idx >= 0) focusNode(NODES[idx]); });
  });

  /* ---------- 渲染 ---------- */
  let needRender = true;
  function render() {
    try { renderImpl(); } catch (e) { window.__nebErr = String((e && e.stack) || e); }
  }
  function renderImpl() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    if (GRAIN) { ctx.globalAlpha = 0.5; ctx.fillStyle = GRAIN; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

    for (let i = 0; i < NODES.length; i++) screen[i] = project(NODES[i]);

    const hoverN = hoverIdx >= 0 ? NODES[hoverIdx] : null;
    const focusSet = focusId ? clusterOf(focusId) : null;
    // 悬停路径：该节点到中心的整条祖先链
    const chain = new Set();
    if (hoverN) {
      chain.add(hoverN.id);
      let cur = hoverN;
      while (cur && cur.kind !== 'core') {
        const pid = cur.kind === 'point' ? cur.docId
          : (cur.kind === 'doc' ? 'agent-' + cur.agentKey : 'core');
        chain.add(pid);
        cur = byId.get(pid);
      }
    }
    const edgeLit = (e) => {
      if (hoverN && chain.has(e.a) && chain.has(e.b)) return 2;
      return (focusId && focusSet.has(e.a) && focusSet.has(e.b)) ? 1 : 0;
    };

    // 边（灰细线 + 箭头，指向下游）
    for (const e of EDGES) {
      const na = byId.get(e.a), nb = byId.get(e.b);
      const A = screen[NODES.indexOf(na)], B = screen[NODES.indexOf(nb)];
      const dim = Math.min(dimOf(na), dimOf(nb));
      const lit = edgeLit(e);
      const base = focusId ? (lit ? 0.5 : 0.05) : (lit === 2 ? 0.62 : 0.3);
      const alpha = base * Math.max(dim, lit ? 0.5 : dim);
      if (alpha <= 0.02) continue;
      let dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      // 按真实形状裁切：起点=圆，终点=文档卡矩形边缘 / 圆
      const tA = (na.r + 2) * cam.z;
      let tB = (nb.r + 7) * cam.z;
      if (nb.kind === 'doc') {
        const hw = (nb.hw || 60) * cam.z, hh = (nb.hh || 13) * cam.z;
        const tx = Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : 1e9;
        const ty = Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : 1e9;
        tB = Math.min(tx, ty);
      }
      const ax = A.x + ux * tA, ay = A.y + uy * tA;
      const bx = B.x - ux * tB, by = B.y - uy * tB;
      ctx.strokeStyle = rgba(INK, alpha);
      ctx.lineWidth = lit ? 1.2 : 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      // 箭头
      const hs = 4.6;
      ctx.fillStyle = rgba(INK, alpha);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - ux * hs - uy * hs * 0.55, by - uy * hs + ux * hs * 0.55);
      ctx.lineTo(bx - ux * hs + uy * hs * 0.55, by - uy * hs - ux * hs * 0.55);
      ctx.closePath(); ctx.fill();
      // 关系标签（放大态 / 悬停邻边）
      if ((cam.z > 1.45 || lit === 2) && dim > 0.5) {
        ctx.font = `8.5px ${SERIF}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = rgba(FAINT, Math.min(0.85, alpha + 0.15));
        ctx.fillText(e.label, (ax + bx) / 2 + 8, (ay + by) / 2 - 4);
        ctx.textAlign = 'left';
      }
    }

    // 中心圆章
    {
      const p = screen[NODES.indexOf(core)];
      const dim = dimOf(core);
      ctx.globalAlpha = dim;
      ctx.fillStyle = '#2b2a26';
      ctx.beginPath(); ctx.arc(p.x, p.y, core.r * cam.z, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba('#2b2a26', 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, (core.r + 5) * cam.z, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f5f2ea';
      ctx.font = `600 ${Math.round(11.5 * cam.z)}px "Segoe UI", "PingFang SC", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('知识库', p.x, p.y + 1);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    // 知识点（小墨点；放大/悬停簇时浮现名称）
    for (let i = 0; i < NODES.length; i++) {
      const n = NODES[i];
      if (n.kind !== 'point') continue;
      const p = screen[i];
      const dim = dimOf(n);
      const near = hoverN && (hoverN.id === n.id || hoverN.id === n.docId || hoverN.id === 'agent-' + n.agentKey || (hoverN.kind === 'point' && hoverN.docId === n.docId));
      const showLabel = dim > 0.15; // 名称全景常显（对齐参考图）
      const ag = AGENTS.find(a => a.key === n.agentKey) || AGENTS[0];
      ctx.globalAlpha = dim;
      ctx.fillStyle = rgba(ag.color, 0.85);
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.2 * cam.z, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba('#f5f2ea', 0.9);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.2 * cam.z, 0, Math.PI * 2); ctx.stroke();
      if (showLabel) {
        const right = Math.cos(n.ang) >= 0;
        ctx.font = `600 9.5px "Segoe UI", "PingFang SC", sans-serif`;
        ctx.textAlign = right ? 'left' : 'right';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = rgba(PAPER, 0.9 * dim);   /* 纸色衬底：关键词压在连线上仍可读 */
        ctx.lineWidth = 3;
        ctx.strokeText(n.label, p.x + (right ? 8 : -8) * cam.z, p.y + 3);
        ctx.fillStyle = rgba(near ? INK : INK_SOFT, (near ? 0.98 : 0.85) * dim);
        ctx.fillText(n.label, p.x + (right ? 8 : -8) * cam.z, p.y + 3);
        ctx.textAlign = 'left';
      }
      if (hoverIdx === i) {
        ctx.strokeStyle = rgba(ag.color, 0.8);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, 8 * cam.z, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // 悬停/聚焦虚线圈（画在 DOM 节点下层）
    const ringN = hoverN || (focusId ? byId.get(focusId) : null);
    if (ringN && ringN.kind !== 'doc') {
      const p = screen[NODES.indexOf(ringN)];
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = rgba(ringN.color || INK, 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, (ringN.r + 10) * cam.z, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    syncDom();
  }

  /* ---------- 动画循环：仅在需要时渲染 ---------- */
  let raf = 0, lastMs = 0, visible = false, visClock = 0, entered = false;
  function frame(ms) {
    raf = 0;
    if (!visible) { lastMs = 0; return; }
    if (!lastMs) lastMs = ms;
    const dt = Math.min((ms - lastMs) / 1000, 0.05);
    lastMs = ms;
    visClock += dt;
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 6.5);
    cam.z += (cam.tz - cam.z) * k;
    cam.px += (cam.tpx - cam.px) * k;
    cam.py += (cam.tpy - cam.py) * k;
    if (Math.abs(cam.tz - cam.z) < 0.001) cam.z = cam.tz;
    if (Math.abs(cam.tpx - cam.px) < 0.4) cam.px = cam.tpx;
    if (Math.abs(cam.tpy - cam.py) < 0.4) cam.py = cam.tpy;
    const settled = cam.z === cam.tz && cam.px === cam.tpx && cam.py === cam.tpy;
    render();
    if (!settled) kick();
    if (!entered && visClock > 0.15) { entered = true; enter(); }
  }
  function kick() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }
  /* 对外 API：目录/搜索联动聚焦（调试钩子仅在 ?debug 时暴露） */
  window.Nebula = {
    focus(id) { const i = NODES.findIndex(n => n.id === id); if (i >= 0) focusNode(NODES[i]); },
    unfocus,
    docs: () => DOCS,   /* 文档数据引用（可变），供世界引擎同步版本号 */
    debug: /(^|[?&])debug/.test(location.search) ? () => ({
      z: +cam.z.toFixed(2), focus: focusId, hover: hoverIdx, vis: visible,
      nodes: NODES.length, links: EDGES.length
    }) : undefined
  };
  const page = cv.closest('.reel__page');
  const io = new IntersectionObserver(es => es.forEach(e => {
    visible = e.isIntersecting;
    if (visible) { needRender = true; kick(); }
  }), { threshold: 0.05 });
  if (page) io.observe(page); else { visible = true; kick(); }

  /* ---------- 入场编排（GSAP 可选，带看门狗兜底） ---------- */
  function enter() {
    if (page && page.dataset.page === '2') return;
    if (reduceMotion || !window.gsap || document.body.classList.contains('no-anim')) return;
    // 仅清理入场透明度，保留 syncDom 写入的图谱定位 transform
    gsap.from('.graph-nodes .gnode', { opacity: 0, y: 10, duration: 0.45, stagger: 0.05, ease: 'power2.out', clearProps: 'opacity' });
    setTimeout(() => {
      document.querySelectorAll('.graph-nodes .gnode').forEach(el => {
        if (getComputedStyle(el).opacity !== '1') el.style.opacity = '1';
      });
    }, 1600);
  }

  /* ---------- 读数 ---------- */
  if (elReadout) elReadout.textContent = `节点 ${NODES.length} · 连线 ${EDGES.length} · 层级 4`;

  resize();
  buildDom();
  window.addEventListener('resize', resize);
  render();
  syncDom();

  /* 图集翻页（复用卷轴键盘逻辑） */
  document.querySelectorAll('.atlas-pagenav button').forEach(btn => {
    btn.addEventListener('click', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: btn.dataset.nav === 'prev' ? 'ArrowLeft' : 'ArrowRight'
      }));
    });
  });
})();
