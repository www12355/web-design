// ============================================================
// screen1.html 控制器：经营总览（营收 / 流水线 / 交付资产 / 团队）
// 纯 ES 模块：AIC / World 由 import 引入，Bloub / gsap 为经典全局。
// ============================================================
import { AIC } from '../modules/common.js';
import { World } from '../modules/world.js';
import { monthRange, monthDay, yearMonth } from '../modules/time.js';

/* 定时器统一登记：pagehide 时集中清理，避免长会话泄漏（P0-3） */
const _scrIntervals = new Set();
const every = (fn, ms) => { const id = setInterval(fn, ms); _scrIntervals.add(id); return id; };
window.addEventListener('pagehide', () => { _scrIntervals.forEach(id => clearInterval(id)); _scrIntervals.clear(); });

// ============================================================
// 真实时间：把模板里的静态日期标签替换为当前日期口径
// ============================================================
(function applyRealTime() {
  // 甘特周期首尾：09.01 – 09.30 → 当前月
  const rangeEl = document.querySelector('.sched__range');
  if (rangeEl) rangeEl.textContent = monthRange();
  // 甘特周期标签与 tooltip 内的「MM.DD – MM.DD」→ 当前月相同日
  // 只改写文本节点，绝不触碰 <b>/<i> 等子元素：
  // 旧实现对整段 innerHTML 做正则替换，一旦正则命中或结构变化就会重建子节点，
  // 造成标签丢失、事件解绑；改为逐文本节点就地替换，标签结构零影响。
  const RANGE_RE = /(\d{2})\.(\d{2})\s*–\s*(\d{2})\.(\d{2})/g;
  const shiftRange = (text) => text.replace(RANGE_RE, (m, a, b, c, d) => {
    const from = Number(b), to = Number(d);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return m;
    return `${monthDay(from)} – ${monthDay(to)}`;
  });
  document.querySelectorAll('.sched__period, .sched .tip, .lane .tip').forEach(el => {
    if (!el) return;
    el.childNodes.forEach(node => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const next = shiftRange(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  });
  // 规格书封面「REV 2.3 · 2026-09」→ 当前年月
  const rev = document.getElementById('rev-date');
  if (rev) rev.textContent = `REV 2.3 · ${yearMonth()} · 规划协调组 编制`;
})();

// ============================================================
// 交付横带数据源：质量看板 / 今日交付节律 / 任务管线
// ------------------------------------------------------------
// 全部实时取自世界状态的非金钱字段：
//   counters.ontime · counters.done · kb.today · tasks[].status · tasks[].doneAt
// 引擎内部的账本运算照旧（ledger / spark / 计费都不动），这里只是不读它。
// ============================================================

/* 任务管线：按 status 分桶（queued=待派发 / doing=进行中 / blocked=阻塞 / done=已交付） */
function taskBuckets() {
  const b = { queued: 0, doing: 0, blocked: 0, done: 0 };
  Object.values(World.state.tasks).forEach(t => { if (b[t.status] != null) b[t.status]++; });
  return b;
}

/* 今日交付节律：把已完成任务的 doneAt("HH:MM") 按小时分箱，取最近 12 小时。
 * 注：跨零点时昨日 23 点附近的交付不会落进窗口，演示场景可接受。 */
function deliveryRhythm() {
  const nowH = Math.floor(World.nowMin() / 60);
  const slots = [];
  for (let i = 11; i >= 0; i--) slots.push({ h: nowH - i, n: 0 });
  const at = new Map(slots.map((s, i) => [s.h, i]));
  Object.values(World.state.tasks).forEach(t => {
    if (t.status !== 'done' || !t.doneAt) return;
    const h = Number(String(t.doneAt).split(':')[0]);
    if (!at.has(h)) return;
    slots[at.get(h)].n++;
  });
  return slots;
}

/* 复审占比：已完成交付物中经交叉质检复审的比例。
 * 主口径是「已完成任务里带复审标记的条数占比」（buildState 以 35% 概率给历史完成任务加
 * 「· 复审」后缀）；本会话新观测到的返工事件（reworkSeen）再叠加进分子分母，保证比率口径
 * 一致。日常模板 reworkRate=0 不产生返工事件，所以不能只靠事件计数，否则会长期显示 0。 */
let reworkSeen = 0;

function qualityMetrics() {
  const st = World.state;
  const done = Object.values(st.tasks).filter(t => t.status === 'done');
  const reviewed = done.filter(t => String(t.title).indexOf('复审') >= 0).length + reworkSeen;
  const denom = done.length + reworkSeen;
  return {
    ontime: Number(st.counters.ontime || 0),
    reviewShare: denom ? Math.min(99.9, reviewed / denom * 100) : 0,
    kbToday: Number(st.kb.today || 0),
    doneTotal: Number(st.counters.done || 0),
    buckets: taskBuckets()
  };
}

/* 交付节律折线：12 个采样点映射到 viewBox 260×48（preserveAspectRatio:none）。
 * 全为 0 时贴基线，不做假抬高。 */
function drawRhythm(slots) {
  const line = document.getElementById('spark-line');
  const area = document.getElementById('spark-area');
  if (!line || !area || !slots.length) return;
  const W = 260, H = 48, PAD = 4;
  const max = Math.max(1, ...slots.map(s => s.n));
  const pts = slots.map((s, i) => {
    const x = slots.length > 1 ? (i / (slots.length - 1)) * W : 0;
    const y = H - PAD - (s.n / max) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  line.setAttribute('points', pts.join(' '));
  area.setAttribute('points', `0,${H} ${pts.join(' ')} ${W},${H}`);
}

/* 入场前先把真实值写进 data-count / 管线计数 / 折线：
 * 避免 HTML 里的占位值先进数字管线，再被世界真实值覆盖而闪一帧旧数据。 */
(function seedMetrics() {
  const m = qualityMetrics();
  [['q-ontime', m.ontime], ['q-review', m.reviewShare], ['q-kb', m.kbToday]].forEach(([id, v]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.count = el.dataset.decimals ? v.toFixed(1) : String(Math.round(v));
  });
  Object.keys(m.buckets).forEach(key => {
    const el = document.querySelector(`[data-pipe="${key}"]`);
    if (el) el.textContent = String(m.buckets[key]);
  });
  drawRhythm(deliveryRhythm());
  const now = document.getElementById('spark-now');
  if (now) now.textContent = `${m.doneTotal} 件`;
})();

// ---- 世界数据源（共享 common.js / world.js） ----
  const CAST = AIC.CAST;
  const STATUS_TXT = AIC.STATUS_TXT;
  const statusText = AIC.statusText || ((status) => STATUS_TXT[status]);
  const reduceMotion = AIC.reduceMotion;
  const $ = s => document.querySelector(s);
  const st0 = World.state;

  /* 把世界引擎当前值写进刊头 / 脊线的 data-count。
   * 必须在入场动画读取 data-count 之前调用，否则 HTML 里的设计稿静态值（72/48/9/96.4）
   * 会先进入数字管线，再被世界真实值覆盖，出现一帧旧数据。 */
  function seedCounts() {
    const doing0 = Object.values(st0.tasks).filter(t => t.status === 'doing');
    const overall0 = Math.round((st0.counters.done + doing0.reduce((a, t) => a + t.pct / 100, 0)) / Math.max(1, st0.counters.total) * 100);
    const seed = {
      'mast-progress': overall0,
      'mast-total': st0.counters.total,
      'mast-doing': doing0.length,
      'mast-ontime': Number(st0.counters.ontime || 0),
      'spine-pct': overall0
    };
    Object.keys(seed).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.dataset.count = String(seed[id]);
    });
  }

  // ---- 接力线：主 AI 领跑 + 五名员工（状态实时同步） ----
  /* 浅色主题下小球「底纸」取纸面同色（主 AI 用深一档米色托住白球），
     与 .rider__orb 的 box-shadow 遮线色一致，避免发丝线穿球。 */
  const ORB_PAPER_MAIN = '#d8d0bf';
  const ORB_PAPER = '#f5f2ea';
  const RIDERS = [
    { key: 'main', name: '主 AI', shape: 'cercle', ink: '#ffffff', paper: ORB_PAPER_MAIN, expr: 'attentif', status: 'busy', st: '统筹中', task: '统筹全局 · 自动接单与归档', main: true },
    ...CAST.map(m => ({
      key: m.key, name: m.name, shape: m.shape, ink: m.color, expr: m.expr, paper: ORB_PAPER,
      status: st0.employees[m.key].status, st: statusText(st0.employees[m.key].status), task: st0.employees[m.key].task
    }))
  ];
  const orbSize = window.innerWidth >= 1920 ? 64 : 56;
  const team = document.getElementById('team');
  const riderRefs = {};
  RIDERS.forEach(r => {
    const el = document.createElement('div');
    el.className = 'rider reveal' + (r.main ? ' rider--main' : '');
    el.title = r.task;
    el.innerHTML = `
      <div class="rider__orb">${Bloub.static({ size: orbSize, shape: r.shape, ink: r.ink, expression: r.expr, state: 'idle', paper: r.paper })}</div>
      <i class="rider__st dot dot--${r.status}"></i>
      <b>${r.name}</b>
      <span>${r.st}</span>
      <span class="tip"><b>${r.name}</b> · ${r.task}</span>`;
    team.appendChild(el);
    if (!r.main) riderRefs[r.key] = { el, dot: el.querySelector('.rider__st'), st: el.querySelector('span') };
  });

  // ---- 入场动效（gsap 可选；CDN 失败或减弱动效时直接显示） ----
  if (!window.gsap) document.body.classList.add('no-anim');
  if (window.gsap && !reduceMotion) {
    const tl = gsap.timeline({ defaults: { duration: 0.55, ease: 'power2.out' } });
    /* clearProps：入场结束抹掉内联 transform，避免 .tpl-wrap 残留层叠上下文
       （会把模板浮层压在拼版瓦片之下，导致浮层点不中） */
    tl.fromTo('.mast__title > *', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.06, clearProps: 'transform' }, 0.05)
      .fromTo('.val',      { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, stagger: 0.08 }, 0.12)
      .fromTo('.spine__pct', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0 }, 0.25)
      .fromTo('.spine__step', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, stagger: 0.06 }, 0.3)
      .fromTo('.spine__stats span', { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, stagger: 0.04 }, 0.4)
      .fromTo('.tile',     { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, stagger: 0.09 }, 0.45)
      .fromTo('.folio',    { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7 }, 0.6)
      .fromTo('.sched .reveal', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.06 }, 0.65)
      .fromTo('.s1-ops .reveal, .s1-bridge .reveal', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.05 }, 0.55)
      .fromTo('.rider',    { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, stagger: 0.06, ease: 'back.out(1.6)' }, 0.75)
      .fromTo('.relay__note', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 1.0);
    gsap.fromTo('.spine__step .seg > i', { scaleX: 0 }, {
      scaleX: 1, duration: 0.8, ease: 'power2.out',
      transformOrigin: 'left center', stagger: 0.1, delay: 0.45
    });
    gsap.fromTo('.bar', { scaleX: 0 }, {
      scaleX: 1, duration: 0.8, ease: 'power2.out',
      transformOrigin: 'left center', stagger: 0.08, delay: 0.8
    });
    gsap.fromTo('.hero-progress .track > i', { scaleX: 0 }, {
      scaleX: 1, duration: 1, ease: 'power2.out', transformOrigin: 'left center', delay: 0.8
    });
  } else {
    document.body.classList.add('no-anim');
  }

  // 刊头数字滚动：先把世界引擎当前值写进 data-count，再交给 AIC.tweenNum 统一驱动。
  // 同一元素只有一个写者；gsap 不可用 / 减弱动效 / 窗口不可见时 tweenNum 直接落终值，
  // 因此不会出现旧实现里「入场动画把真实数据拉回设计稿静态默认值」的问题。
  seedCounts();
  document.querySelectorAll('[data-count]').forEach(el => {
    const end = parseFloat(el.dataset.count);
    if (!Number.isFinite(end)) return;
    AIC.tweenNum(el, end, { from: 0, dur: 1.1, decimals: parseInt(el.dataset.decimals || '0', 10) });
  });

  // 环境兜底：动画时钟被冻结时（后台标签 rAF 节流等），2.2s 后直接跳到最终状态
  setTimeout(() => {
    const first = document.querySelector('.reveal');
    if (first && getComputedStyle(first).opacity === '0') {
      gsap.globalTimeline.getChildren(true, true, false).forEach(t => t.progress(1));
    }
  }, 2200);

  // ---- 世界订阅：经营账本 / 流水线 / 交付资产 / 接力线 ----
  const mastProgress = $('#mast-progress'), mastTotal = $('#mast-total'), mastDoing = $('#mast-doing'), mastOntime = $('#mast-ontime');
  const spinePct = $('#spine-pct'), spineProd = $('#spine-prod'), spineAccept = $('#spine-accept'), spineSettle = $('#spine-settle');
  const stTotal = $('#st-total'), stDone = $('#st-done'), stDoing = $('#st-doing');
  const heroTrack = $('#hero-track'), heroNum = $('#hero-num'), heroPill = $('#hero-pill'), heroVer = $('#hero-ver'), heroSub = $('#hero-sub');
  const relayN1 = $('#relay-n1'), relayN2 = $('#relay-n2'), folioVal = $('#folio-val'), todayLine = $('#today-line');
  const qOntime = $('#q-ontime'), qReview = $('#q-review'), qKb = $('#q-kb'), sparkNow = $('#spark-now');

  function heroTask() {
    const regens = Object.values(World.state.tasks).filter(t => t.regen);
    return regens[regens.length - 1];
  }
  function updateLedger() {
    const st = World.state;
    const doing = Object.values(st.tasks).filter(t => t.status === 'doing');
    const overall = (st.counters.done + doing.reduce((a, t) => a + t.pct / 100, 0)) / Math.max(1, st.counters.total) * 100;
    AIC.tweenNum(mastProgress, Math.round(overall));
    AIC.tweenNum(mastTotal, st.counters.total);
    AIC.tweenNum(mastDoing, doing.length);
    AIC.tweenNum(mastOntime, st.counters.ontime, { decimals: 1 });
    if (folioVal) folioVal.textContent = '任务 ' + st.counters.total;
  }
  function updateSpine() {
    const st = World.state;
    const doing = Object.values(st.tasks).filter(t => t.status === 'doing');
    const avg = doing.length ? doing.reduce((a, t) => a + t.pct, 0) / doing.length : 0;
    const overall = (st.counters.done + doing.reduce((a, t) => a + t.pct / 100, 0)) / Math.max(1, st.counters.total) * 100;
    AIC.tweenNum(spinePct, Math.round(overall));
    spineProd.style.width = avg.toFixed(1) + '%';
    const producing = Object.values(st.orders).filter(o => o.status === 'producing').length;
    const settledNow = Object.values(st.orders).filter(o => o.status === 'settled').length;
    const totalO = producing + settledNow;
    spineAccept.style.width = (totalO ? settledNow / totalO * 100 : 0).toFixed(1) + '%';
    spineSettle.style.width = Math.min(100, st.kb.settledToday / Math.max(1, totalO) * 100).toFixed(1) + '%';
    stTotal.textContent = st.counters.total;
    stDone.textContent = st.counters.done;
    stDoing.textContent = doing.length;
  }
  function updateHero() {
    const t = heroTask(); if (!t) return;
    heroTrack.style.width = t.pct + '%';
    heroNum.textContent = Math.round(t.pct) + '% · 已合并 ' + Math.max(3, Math.round(t.pct / 100 * 5)) + ' / 5 份源文档';
    if (t.status === 'done') {
      heroPill.textContent = '已归档'; heroPill.className = 'pill pill--pine';
      heroVer.textContent = 'v0.' + (t.regen + 1);
    } else {
      heroPill.textContent = '生成中'; heroPill.className = 'pill pill--clay';
      heroVer.textContent = 'v0.' + t.regen;
    }
    heroSub.textContent = `v0.${t.status === 'done' ? t.regen + 1 : t.regen} · 主 AI 整合生成 · 自动滚动交付`;
  }
  function updateRelay() {
    const st = World.state;
    CAST.forEach(m => {
      const r = riderRefs[m.key]; const emp = st.employees[m.key];
      if (!r) return;
      r.dot.className = 'dot dot--' + emp.status;
      r.st.textContent = statusText(emp.status);
      r.el.title = `${emp.task} · 进度 ${Math.round(emp.pct)}%`;
    });
    relayN1.textContent = `今日 ${st.counters.todayOrders} 项推进 · 知识库 +${st.kb.today} · 全员在线`;
    const last = st.events[0];
    /* 统一脱敏出口：金额整段摘除、价格词换成中性表述（引擎内部照旧算账，只是不显示） */
    const lastText = last ? AIC.stripMoney(last.text) : '运行正常';
    relayN2.textContent = `最新 ${last ? last.t : World.timeHM()} · ${lastText}`;
  }
  /* 交付横带：质量看板 + 任务管线 + 交付节律，全部取世界状态的非金钱字段 */
  function renderMetrics() {
    const m = qualityMetrics();
    AIC.tweenNum(qOntime, m.ontime, { decimals: 1 });
    AIC.tweenNum(qReview, m.reviewShare, { decimals: 1 });
    AIC.tweenNum(qKb, m.kbToday);
    if (sparkNow) sparkNow.textContent = `${m.doneTotal} 件`;
    Object.keys(m.buckets).forEach(key => {
      const el = document.querySelector(`[data-pipe="${key}"]`);
      if (el && el.textContent !== String(m.buckets[key])) el.textContent = String(m.buckets[key]);
    });
    drawRhythm(deliveryRhythm());
  }
  /* 角色任务完成时，给对应瓦片短暂提示 */
  const EMP_TILE = { designer: '.t-visual', engineer: '.t-web', planner: '.tile--hero', writer: '.tile--hero', analyst: '.t-data' };
  function pulseTile(sel) {
    const el = document.querySelector(sel);
    if (!el || !window.gsap || reduceMotion) return;
    gsap.fromTo(el, { backgroundColor: 'rgba(31,111,92,0.10)' }, { backgroundColor: 'rgba(31,111,92,0)', duration: 1.4, ease: 'power2.out', clearProps: 'backgroundColor' });
  }
  function updateAll() { updateLedger(); updateSpine(); updateHero(); updateRelay(); renderMetrics(); }

  World.on(evts => {
    updateAll();
    const st = World.state;
    evts.forEach(e => {
      if (e.type === 'order' && st.orders[e.id]) {
        const o = st.orders[e.id];
        AIC.toast({ title: '新任务自动进入', body: `${o.client} · ${o.demand}`, color: 'var(--pine)', tag: '任务池' });
      } else if (e.type === 'settle' && st.orders[e.id]) {
        const o = st.orders[e.id];
        AIC.toast({ title: '交付完成 · 已归档', body: `${o.client} · ${o.demand}`, color: 'var(--pine)', tag: o.settledAt || World.timeHM() });
      } else if (e.type === 'block' && st.tasks[e.id]) {
        AIC.toast({ title: '任务阻塞 · 自动重试', body: st.tasks[e.id].title, color: 'var(--clay)', tone: 'clay', tag: World.timeHM() });
      } else if (e.type === 'taskDone' && st.tasks[e.id] && st.tasks[e.id].owner && EMP_TILE[st.tasks[e.id].owner]) {
        pulseTile(EMP_TILE[st.tasks[e.id].owner]);
      }
    });
  });

  // 甘特「今日」线随世界时钟推进（09.01–09.30 周期）
  function moveToday() { if (todayLine) todayLine.style.left = (World.dayFrac() / 30 * 100).toFixed(2) + '%'; }
  every(moveToday, 30000);

  updateHero(); updateRelay(); moveToday();
  setTimeout(() => { updateLedger(); updateSpine(); }, 1600);

  /* 窗口恢复可见 / 获得焦点：先把被暂停的数字立即落终值，再按最新世界数据重绘。
   * 后台窗口 rAF 暂停、定时器被节流，仅靠补间动画无法保证追上进度，
   * 这一步保证「切回第一屏的瞬间就是最新数据」。 */
  function refreshNow() { AIC.flushNums(); updateAll(); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshNow(); });
  window.addEventListener('focus', refreshNow);
  window.addEventListener('pageshow', refreshNow);

  /* ============================================================
     实时数据联动：交付瓦片 / 数字闪动 / 漏斗转化
     ============================================================ */
  (function () {
    const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- 交付瓦片：绑定各角色真实任务 ---- */
    const TILE_LIVE = [
      { role: 'writer',   bar: '#live-spec',   num: '#live-spec-num',   pill: '#pill-spec' },
      { role: 'analyst',  bar: '#live-data',   num: '#live-data-num',   pill: '#pill-data' },
      { role: 'designer', bar: '#live-visual', num: '#live-visual-num', pill: '#pill-visual' },
      { role: 'engineer', bar: '#live-web',    num: '#live-web-num',    pill: '#pill-web' }
    ];
    function roleTask(role) {
      const mine = Object.values(World.state.tasks).filter(t => t.owner === role);
      return mine.find(t => t.status === 'doing') || mine.find(t => t.status === 'blocked')
        || mine.filter(t => t.status === 'done').sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''))[0] || null;
    }
    function updateTiles() {
      TILE_LIVE.forEach(cfg => {
        const bar = document.querySelector(cfg.bar), num = document.querySelector(cfg.num), pill = document.querySelector(cfg.pill);
        if (!bar || !num || !pill) return;
        const t = roleTask(cfg.role);
        if (!t) { bar.style.width = '0%'; num.textContent = '等待派单'; pill.textContent = '待命中'; pill.className = 'pill pill--sage'; return; }
        if (t.status === 'blocked') {
          bar.style.width = t.pct + '%'; num.textContent = Math.round(t.pct) + '% · 自动重试中';
          pill.textContent = '阻塞'; pill.className = 'pill pill--clay';
        } else if (t.status === 'doing') {
          bar.style.width = t.pct + '%'; num.textContent = Math.round(t.pct) + '% · ' + t.title;
          pill.textContent = '生成中'; pill.className = 'pill pill--clay';
        } else {
          bar.style.width = '100%'; num.textContent = '已交付 · ' + t.title;
          pill.textContent = '已交付'; pill.className = 'pill pill--pine';
        }
      });
      /* 漏斗转化率随今日接单缓慢漂移（2.5–4.6% 合理带内） */
      const cvr = document.getElementById('data-cvr');
      if (cvr) {
        const base = 3.4 + Math.min(0.8, World.state.counters.todayOrders * 0.05);
        const v = Math.max(2.5, Math.min(4.6, base + Math.sin(Date.now() / 900000) * 0.25));
        cvr.textContent = `注册转化 ${v.toFixed(1)}% ${World.state.counters.todayOrders > 13 ? '↑' : '→'}`;
      }
    }

    function flashEl(sel) {
      const el = document.querySelector(sel);
      if (!el || reduceMotion) return;
      el.classList.remove('num-flash'); void el.offsetWidth; el.classList.add('num-flash');
    }

    World.on(evts => {
      updateTiles();
      evts.forEach(e => {
        if (e.type === 'settle') { flashEl('#mast-progress'); }
        else if (e.type === 'order') { flashEl('#mast-total'); }
        else if (e.type === 'rework') {
          const t = World.state.tasks[e.id];
          reworkSeen++;   /* 并入复审占比分子分母：日常模板不产生该事件，只在有样本时才抬高口径 */
          AIC.toast({ title: '质检返工 · 自动修正', body: t ? t.title : '', color: 'var(--clay)', tone: 'clay', tag: World.timeHM() });
        }
      });
    });

    updateTiles();
  })();

  /* ============================================================
     真实联动层：模板切换器 + 跨屏同步状态 + 事件流 + 流速 / 派发
     ------------------------------------------------------------
     单一真相源是 World（modules/world.js）：
     本页 data-world-prio="1"（跟随者），卷轴窗 window2 prio="2"（领导者）。
     本页指令走 World.setTemplate / setSpeed / dispatch——是 leader 时
     直接 applyBatch；不是 leader 时另投指令通道 aic-world-cmd-v1，
     由 leader 消费 → 写快照 → storage 事件回灌，两屏同时生效。
     ============================================================ */
  (function linkage() {
    const TPL = World.templates;
    const LEADER_KEY = 'aic-world-leader-v1';
    const LEASE_MS = 8000;          /* 与 world.js 的心跳新鲜期保持一致 */
    const EV_MAX = 3;
    const EV_KIND = { order: '受理', settle: '归档', done: '交付', risk: '风险', dispatch: '派发', mode: '模板', info: '动态' };
    /* 事件文本可能带上监管派发的原始输入，进 innerHTML 前统一转义 */
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    /* ---------------- 1. 运行模板切换器（真实联动） ---------------- */
    const chip = $('#tpl-chip'), pop = $('#tpl-pop'), chipName = $('#tpl-chip-name');
    const tplLabel = t => (window.L10n ? window.L10n.t('templates.' + t.id) : t.name);

    function renderPop() {
      const cur = World.template;
      pop.innerHTML = '<div class="tpl-pop__head">实时模拟模板 · 双窗口同步生效</div><div class="tpl-list">' +
        Object.values(TPL).map(t => `
          <button type="button" class="tpl-item${t.id === cur ? ' on' : ''}" data-tpl="${esc(t.id)}" role="menuitem">
            <span class="tpl-item__row"><b>${esc(tplLabel(t))}</b><span class="pill${t.id === cur ? ' pill--pine' : ''}">${esc(AIC.stripMoney(t.tag))}</span></span>
            <span class="tpl-item__desc">${esc(AIC.stripMoney(t.desc))}</span>
            <span class="tpl-item__meta">${t.meta.map(m => `<span>${esc(AIC.stripMoney(m))}</span>`).join('')}</span>
          </button>`).join('') + '</div>';
    }
    function closePop() {
      pop.classList.remove('open');
      chip.setAttribute('aria-expanded', 'false');
    }
    if (chip && pop && chipName) {
      chip.addEventListener('click', () => {
        const open = pop.classList.toggle('open');
        chip.setAttribute('aria-expanded', String(open));
        if (open) renderPop();
      });
      pop.addEventListener('click', e => {
        const btn = e.target.closest('[data-tpl]');
        if (!btn) return;
        World.setTemplate(btn.dataset.tpl);
        closePop();
      });
      document.addEventListener('click', e => {
        if (pop.classList.contains('open') && !e.target.closest('#tpl-wrap')) closePop();
      });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
    }
    /* 模板以幂等方式跟随世界状态：本页切换走 applyBatch，他窗切换走 sync 快照 */
    let curTplId = null;
    function syncTplUI() {
      if (!chip || World.template === curTplId) return;
      const first = curTplId === null;
      curTplId = World.template;
      chipName.textContent = tplLabel(TPL[curTplId] || TPL.daily);
      if (pop.classList.contains('open')) renderPop();
      if (!first) {
        const t = TPL[curTplId] || TPL.daily;
        AIC.toast({ title: '运行模板已切换', body: `${t.name} — ${t.desc}`, color: 'var(--pine)', tag: t.tag });
      }
    }

    /* ---------------- 2. 跨屏同步状态（读领导者租约） ---------------- */
    const dot = $('#link-dot'), stateEl = $('#link-state'), subEl = $('#link-sub'), openBtn = $('#link-open');
    function readLease() {
      try { return JSON.parse(localStorage.getItem(LEADER_KEY)); } catch (e) { return null; }
    }
    function renderSync() {
      if (!dot || !stateEl || !subEl) return;
      const lease = World.syncOK ? readLease() : null;
      const age = lease && lease.ts ? Date.now() - lease.ts : Infinity;
      const live = !!lease && !!lease.id && age < LEASE_MS;
      let cls, state, sub;
      if (!World.syncOK) {
        cls = 'is-warn';
        state = '本地模式 · 未联动';
        sub = '浏览器禁用了 localStorage，两个窗口各演各的';
      } else if (World.isLeader) {
        /* 卷轴窗 prio=2 更高：本页能拿到领导权，就说明它不在场 —— 即「独屏」。
           这里必须说清楚，避免单独打开时误以为联动已生效。 */
        cls = 'is-lead';
        state = '本页主导 · 未检测到联动窗口';
        sub = '本页持有领导者租约并在驱动世界；点右侧「打开联动窗口」双开后会自动让位、改为跟随';
      } else if (live) {
        cls = 'is-sync';
        state = `已同步 · 跟随 ${(lease.prio | 0) >= 2 ? 'window2' : '另一窗口'}`;
        sub = `领导者 P${lease.prio} · ${Math.max(0, Math.round(age / 1000))}s 前心跳`;
      } else {
        cls = 'is-idle';
        state = '未联动 · 独屏运行';
        sub = '点右侧「打开联动窗口」，与卷轴窗共享同一世界引擎';
      }
      dot.className = 's1-bridge__dot ' + cls;
      stateEl.textContent = state;
      subEl.textContent = sub;
      /* 只有「确实已同步」时按钮才安静下来；其余状态都提示去双开 */
      if (openBtn) openBtn.classList.toggle('is-hot', cls !== 'is-sync');
    }

    /* ---------------- 3. 最近事件流（World.state.events） ---------------- */
    const evList = $('#link-events');
    let evSig = '';
    function renderEvents() {
      if (!evList) return;
      const evts = (World.state.events || []).slice(0, EV_MAX);
      const sig = World.template + '|' + evts.map(e => e.t + e.text).join('~');
      if (sig === evSig) return;          /* 事件未变则不重排 DOM */
      evSig = sig;
      evList.innerHTML = evts.length
        ? evts.map(e => {
            const tx = esc(AIC.stripMoney(e.text));   /* 事件原文含金额：统一脱敏后再入 DOM */
            return `<li class="s1-ev">
            <span class="ev-tag ev-tag--${esc(e.kind || 'info')}">${esc(EV_KIND[e.kind] || '动态')}</span>
            <b class="num">${esc(e.t)}</b>
            <span class="s1-ev__tx" title="${tx}">${tx}</span>
          </li>`;
          }).join('')
        : '<li class="s1-ev is-empty">等待世界引擎事件…</li>';
    }

    /* ---------------- 4. 流速 + 监管派发（与第 3 屏监管终端同构） ---------------- */
    const speedWrap = $('#link-speed');
    if (speedWrap) {
      speedWrap.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () => World.setSpeed(+b.dataset.speed));
      });
    }
    function syncSpeedUI() {
      if (!speedWrap) return;
      speedWrap.querySelectorAll('button').forEach(b => {
        b.classList.toggle('on', +b.dataset.speed === World.speed);
      });
    }

    const input = $('#link-input'), send = $('#link-send');
    const RE_ROLE_AT = /@(视觉设计|内容撰写|数据分析|规划协调|工程开发)/;
    function routeRole(text) {
      const m = text.match(RE_ROLE_AT);
      if (m) { const c = CAST.find(x => x.name === m[1]); if (c) return c.key; }
      if (/(设计|视觉|海报|banner|色板|配色|图标|logo|UI)/i.test(text)) return 'designer';
      if (/(文案|撰写|稿|文章|口径|FAQ|邮件|标题|keynote)/i.test(text)) return 'writer';
      if (/(数据|分析|报表|漏斗|埋点|指标|转化)/i.test(text)) return 'analyst';
      if (/(开发|上线|部署|接口|前端|代码|修复|工程|压测|适配)/i.test(text)) return 'engineer';
      return 'planner';
    }
    function normalizeTitle(text) {
      const t = text.replace(/@[\u4e00-\u9fa5A-Za-z]+/g, '')
        .replace(/^(请|帮我|麻烦|立即|马上)/, '')
        .replace(/^(做|写|改|跑|查)(一下|下)?/, '')
        .trim();
      return (t || text.trim()).slice(0, 26);
    }
    function dispatchFromBridge() {
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      const owner = routeRole(text);
      const title = normalizeTitle(text);
      /* 经世界引擎下发：本页为 leader 时立即生效，否则投指令通道由 leader 执行 */
      World.dispatch({ id: 's1-' + Date.now().toString(36), title, owner, value: 6000 + Math.floor(Math.random() * 9000) });
      const emp = CAST.find(c => c.key === owner);
      AIC.toast({
        title: '监管指令已下发',
        body: `${title} → ${emp ? emp.name : owner}`,
        color: 'var(--pine)',
        tone: 'pine',
        tag: World.timeHM()
      });
    }
    if (input && send) {
      send.addEventListener('click', dispatchFromBridge);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); dispatchFromBridge(); }
      });
    }

    /* ---------------- 5. 打开联动窗口（双开主路径的补充入口） ---------------- */
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        const w = window.open('window2.html', 'window2');
        if (!w) {
          AIC.toast({
            title: '弹窗被拦截',
            body: '请允许本站弹出窗口，或直接打开 window2.html',
            color: 'var(--clay)',
            tone: 'clay'
          });
        }
      });
    }

    /* ---------------- 6. 刷新节奏：不轮询快照，只读一个租约 key ---------------- */
    function renderAll() { syncTplUI(); syncSpeedUI(); renderSync(); renderEvents(); }
    World.on(renderAll);
    window.addEventListener('storage', e => { if (e && e.key === LEADER_KEY) renderSync(); });
    every(renderSync, 3000);   /* 仅用于刷新「对方心跳新鲜度」文案 */
    renderAll();
  })();
