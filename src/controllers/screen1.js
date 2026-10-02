// ============================================================
// screen1.html 控制器：经营总览（营收 / 流水线 / 交付资产 / 团队）
// 纯 ES 模块：AIC / World 由 import 引入，Bloub / gsap 为经典全局。
// ============================================================
import { AIC } from '../modules/common.js';
import { World } from '../modules/world.js';
import { monthRange, monthDay, yearMonth } from '../modules/time.js';
import { Schedule, fmtMD, AXIS, TEAMS, DAY, HOLIDAYS, BASE } from '../modules/schedule.js';
import { initStaffCarousel } from './screen1/staff-carousel.js';

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

/* 管线计数为 0 时不占用语义色：0 个阻塞不是告警。
   此前 `.s1-step.is-blocked` 是静态声明，阻塞为 0 也照样亮琥珀，
   语义色因此失去可信度。 */
function syncPipeZero() {
  document.querySelectorAll('.s1-step').forEach(step => {
    const n = step.querySelector('[data-pipe]');
    step.classList.toggle('is-zero', !n || Number(n.textContent) === 0);
  });
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
  syncPipeZero();
  drawRhythm(deliveryRhythm());
  const now = document.getElementById('spark-now');
  if (now) now.textContent = `${m.doneTotal} 件`;
})();

// ---- 世界数据源（共享 common.js / world.js） ----
  const reduceMotion = AIC.reduceMotion;
  const $ = s => document.querySelector(s);
  const st0 = World.state;

  /* 状态徽章的唯一写法：类（颜色）+ 图标（形状）+ 中文文案（语义）三重编码，
     三者缺一不可（DESIGN.md §5）。图标由 common.js 注入的精灵提供。
     kind: success | running | warning | blocked | neutral | auto */
  function setPill(el, text, cls, kind) {
    if (!el) return;
    el.className = 'pill ' + cls;
    el.innerHTML = (kind ? AIC.stateIcon(kind) : '') + text;
  }

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
      'mast-ontime': Number(st0.counters.ontime || 0)
    };
    Object.keys(seed).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.dataset.count = String(seed[id]);
    });
  }

  // ---- 接力线：AI 员工轮播（3 套模板 × 随机名单，状态实时同步） ----
  /* 卡片渲染 / 拍节调度 / 知识库读数 / 模板层文案同步全部收在
     screen1/staff-carousel.js（见 src/data/staffRoster.js 的名单与去重口径）。
     必须在入场时间线注册 .staff-card 之前完成首轮渲染。 */
  initStaffCarousel();

  // ---- 入场动效（gsap 可选；CDN 失败或减弱动效时直接显示） ----
  if (!window.gsap) document.body.classList.add('no-anim');
  if (window.gsap && !reduceMotion) {
    const tl = gsap.timeline({ defaults: { duration: 0.55, ease: 'power2.out' } });
    /* clearProps：入场结束抹掉内联 transform，避免残留层叠上下文影响后方瓦片点击 */
    tl.fromTo('.mast__title > *', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.06, clearProps: 'transform' }, 0.05)
      .fromTo('.val',      { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, stagger: 0.08 }, 0.12)
      .fromTo('.spine__lead', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0 }, 0.25)
      .fromTo('.spine__step', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, stagger: 0.06 }, 0.3)
      .fromTo('.spine__stats span', { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, stagger: 0.04 }, 0.4)
      .fromTo('.tile',     { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, stagger: 0.09 }, 0.45)
      .fromTo('.folio',    { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7 }, 0.6)
      .fromTo('.sched .reveal', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.06 }, 0.65)
      .fromTo('.s1-ops .reveal', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.05 }, 0.55)
      .fromTo('.staff-card', { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, stagger: 0.06, ease: 'back.out(1.6)' }, 0.75)
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
  const spineReq = $('#spine-req'), spineConfirm = $('#spine-confirm'), spineProd = $('#spine-prod'), spineAccept = $('#spine-accept'), spineSettle = $('#spine-settle');
  const stDone = $('#st-done');
  const heroTrack = $('#hero-track'), heroNum = $('#hero-num'), heroPill = $('#hero-pill'), heroVer = $('#hero-ver'), heroSub = $('#hero-sub');
  const relayN1 = $('#relay-n1'), relayN2 = $('#relay-n2'), folioVal = $('#folio-val');
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

    /* 五段全部由 World 真实状态派生，无静态写死：
       需求接收 = 已立项（非排队）任务 / 任务池规模
       方案确认 = 已确认（进行中 + 已完成）任务 / 任务池规模
       并行生产 = 在制任务平均进度
       交付验收 = 已结算订单 / 订单总量
       交付归档 = 今日归档数 / 订单总量 */
    const totalT = Math.max(1, st.counters.total);
    const queued = Object.values(st.tasks).filter(t => t.status === 'queued').length;
    const reqPct = (totalT - queued) / totalT * 100;
    const confirmPct = (st.counters.done + doing.length) / totalT * 100;
    const producing = Object.values(st.orders).filter(o => o.status === 'producing').length;
    const settledNow = Object.values(st.orders).filter(o => o.status === 'settled').length;
    const totalO = Math.max(1, producing + settledNow);
    const acceptPct = settledNow / totalO * 100;
    const settlePct = Math.min(100, st.kb.settledToday / totalO * 100);

    /* 逐段落宽并依"是否已完成 / 是否当前活跃"注入状态 class：
       已完成（≥99.5%）标 is-done；首段未完成的标 is-now 作为当前推进前沿。 */
    const segs = [
      [spineReq, reqPct],
      [spineConfirm, confirmPct],
      [spineProd, avg],
      [spineAccept, acceptPct],
      [spineSettle, settlePct]
    ];
    let frontier = false;
    segs.forEach(([el, pct]) => {
      if (!el) return;
      el.style.width = pct.toFixed(1) + '%';
      const step = el.closest('.spine__step');
      step.classList.remove('is-done', 'is-now');
      if (pct >= 99.5) step.classList.add('is-done');
      else if (!frontier) { step.classList.add('is-now'); frontier = true; }
    });

    stDone.textContent = st.counters.done;
  }
  function updateHero() {
    const t = heroTask(); if (!t) return;
    const heroProgress = heroTrack.closest('.hero-progress');
    heroTrack.style.width = t.pct + '%';
    heroNum.textContent = Math.round(t.pct) + '% · 已合并 ' + Math.max(3, Math.round(t.pct / 100 * 5)) + ' / 5 份源文档';
    if (t.status === 'done') {
      setPill(heroPill, '已归档', 'pill--success', 'success');
      heroVer.textContent = 'v0.' + (t.regen + 1);
      heroProgress.classList.add('is-success'); heroProgress.classList.remove('is-run');
    } else {
      setPill(heroPill, '生成中', 'pill--run', 'running');
      heroVer.textContent = 'v0.' + t.regen;
      heroProgress.classList.add('is-run'); heroProgress.classList.remove('is-success');
    }
    heroSub.textContent = `v0.${t.status === 'done' ? t.regen + 1 : t.regen} · 主 AI 整合生成 · 自动滚动交付`;
  }
  function updateRelay() {
    const st = World.state;
    /* 员工卡片的状态 / 任务 / 进度由 staff-carousel 模块自行订阅 World 刷新 */
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
    syncPipeZero();
    drawRhythm(deliveryRhythm());
  }
  /* 角色任务完成时，给对应瓦片短暂提示。
     改用 CSS 类（.tile.is-flash）而不是 gsap 内联背景色：
     颜色取自 --color-accent-surface，不再硬编码 v1 的青绿 rgba；
     也不再依赖 gsap（CDN 缺失时同样有反馈）。 */
  const EMP_TILE = { designer: '.t-visual', engineer: '.t-web', planner: '.tile--hero', writer: '.tile--hero', analyst: '.t-data' };
  function pulseTile(sel) {
    const el = document.querySelector(sel);
    if (!el || reduceMotion) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;                 /* 强制重排，保证连击时动画重放 */
    el.classList.add('is-flash');
    /* 用 animationend 收尾而不是 setTimeout：不新增需在 pagehide 清理的定时器 */
    el.addEventListener('animationend', e => { if (e.target === el) el.classList.remove('is-flash'); }, { once: true });
  }
  /* ============ 全任务排期：多任务泳道甘特（由 Schedule 引擎实时驱动） ============ */
  /* 子行高度按视口高自适应：甘特带约占视口 1/3，视口越矮行越紧凑，
     避免 100vh 大屏布局里上方拼版区被压塌（.mosaic 是唯一的可压缩项）。 */
  const ROW_MAX = 23, ROW_MIN = 18, ROW_GAP = 6, HEAD_PX = 46;
  let ROW_PX = ROW_MAX;                               // 每次 renderGantt 重新求解
  function fitRowPx(totalRows) {
    const band = Math.max(220, window.innerHeight * 0.29);       // 甘特带目标高度（约占视口 3/10）
    const budget = band - HEAD_PX - 12 - 4 * ROW_GAP;            // 扣顶部留白/底留白/泳道间距
    return Math.max(ROW_MIN, Math.min(ROW_MAX, Math.floor(budget / Math.max(1, totalRows))));
  }
  const STATUS_LABEL = { done: '已完成', doing: '进行中', blocked: '阻塞', queued: '待派发' };
  const LANE_LABEL = { planner: '官网', writer: '社媒', analyst: 'EDM', designer: '设计', engineer: '媒介' };
  let ganttHi = null;                                // 当前高亮的受影响任务 id 集合
  let selEntry = null;                               // 影响面板当前选中变更
  let lastHistVer = -1;                              // 面板增量刷新用（历史长度会因上限而不变）
  let depsRaf = 0;                                   // 依赖层重绘节流句柄
  let nwdDone = false;                               // 非工作日底纹只依赖常量，渲染一次

  // 某一天的类型：holiday / weekend / null（工作日）
  const nwdType = off => {
    const d = new Date(BASE.getTime() + off * DAY);
    if (HOLIDAYS.has(mdKeyOf(d))) return 'holiday';
    const wd = d.getDay();
    return (wd === 0 || wd === 6) ? 'weekend' : null;
  };

  // 区间装箱：把同泳道任务分到互不重叠的子行
  function packRows(tasks) {
    const sorted = tasks.slice().sort((a, b) => a.startD - b.startD);
    const rowEnds = [];
    sorted.forEach(t => {
      let r = rowEnds.findIndex(end => end <= t.startD - 0.01);
      if (r < 0) { r = rowEnds.length; rowEnds.push(t.endD); } else { rowEnds[r] = t.endD; }
      t._row = r;
    });
    return rowEnds.length;
  }

  const mdKeyOf = d => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const PCT = d => Math.max(0, Math.min(100, d / AXIS * 100));
  const offsetToDate = off => new Date(BASE.getTime() + off * DAY);

  // 非工作日 / 节假日竖向底纹 + 周线周标（只依赖 BASE/AXIS 常量，整体渲染一次）
  function renderNwd() {
    if (nwdDone) return;
    const layer = document.getElementById('sched-nwd');
    const weeks = document.getElementById('sched-weeks');
    if (!layer || !weeks) return;

    // 底纹：逐日扫描，仅合并「同类型」的连续区间（周末带与节假日带分别成块）
    let i = 0;
    while (i < AXIS) {
      const type = nwdType(i);
      if (!type) { i++; continue; }
      let j = i + 1;
      while (j < AXIS && nwdType(j) === type) j++;
      const b = document.createElement('div');
      b.className = 'nwd-band nwd-band--' + type;
      b.style.left = (i / AXIS * 100) + '%';
      b.style.width = ((j - i) / AXIS * 100) + '%';
      if (type === 'holiday') {
        b.title = '法定节假日 · 非工作日';
        b.innerHTML = '<em>' + String(offsetToDate(i).getMonth() + 1) + '/' + String(offsetToDate(i).getDate()) + '</em>';
      }
      layer.appendChild(b);
      i = j;
    }

    // 周分隔线（贯穿轨道区）+ 周标（顶部刻度行）
    for (let k = 1; k * 7 < AXIS; k++) {
      const ln = document.createElement('div');
      ln.className = 'nwd-week';
      ln.style.left = (k * 7 / AXIS * 100) + '%';
      layer.appendChild(ln);
      const lb = document.createElement('span');
      lb.style.left = ((k - 0.5) * 7 / AXIS * 100) + '%';
      lb.textContent = 'W' + k;
      weeks.appendChild(lb);
    }
    nwdDone = true;
  }

  // 里程碑行
  function renderMilestones(S) {
    const row = document.getElementById('ms-row');
    if (!row) return;
    row.innerHTML = '';
    Object.values(S.nodes).filter(n => n.isMilestone).forEach(m => {
      const driving = m.deps.map(id => S.nodes[id]).filter(Boolean);
      const risk = m.endD > S.today && driving.some(d => d.conflict || d.status === 'blocked' || d.bufferLeft <= 0);
      const el = document.createElement('div');
      el.className = 'ms';
      el.dataset.ms = m.id;
      el.style.left = PCT(m.endD) + '%';
      el.title = `${m.name} · ${fmtMD(m.endD)}${risk ? ' · 存在触险风险' : ''}`;
      /* 触险里程碑：菱形转警示色，标签补 ic-warn 图标（颜色 + 形状 + 文案三冗余） */
      el.innerHTML = `<span class="ms__dia${risk ? ' is-risk' : ''}"></span>` +
        `<span class="ms__label${risk ? ' is-risk' : ''}">${risk ? AIC.stateIcon('warning') : ''}${m.name}</span>`;
      row.appendChild(el);
    });
  }

  // 依赖箭头覆盖层（finish-to-start；任务条 → 任务条 / 里程碑菱形）
  function drawDeps() {
    const svg = document.getElementById('sched-deps');
    const g = document.getElementById('deps-lines');
    if (!svg || !g) return;
    // SVG 无 viewBox：用户单位 = CSS 像素，直接用像素坐标绘制，避免非等比缩放导致线宽失真
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return;
    while (g.firstChild) g.removeChild(g.firstChild);

    const S = Schedule;
    const anchor = id => {
      const n = S.nodes[id];
      if (!n) return null;
      if (n.isMilestone) {
        const el = document.querySelector(`.ms[data-ms="${id}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - box.left, y: r.top + 9 - box.top, head: 'ms' };
      }
      const el = document.querySelector(`.bar[data-id="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - box.left, y: r.top + r.height / 2 - box.top, right: r.right - box.left, head: 'bar' };
    };

    const edges = [];
    Object.values(S.nodes).forEach(n => {
      if (!n.deps) return;
      n.deps.forEach(d => edges.push([d, n.id]));
    });

    edges.forEach(([from, to]) => {
      const a = anchor(from), b = anchor(to);
      if (!a || !b) return;
      const sx = a.head === 'ms' ? a.x : a.right, sy = a.y;
      const ex = b.x, ey = b.y;
      let d;
      if (ex > sx + 10) {
        const mx = ex - 8;                       // 目标在右侧：标准 Z 型折线
        d = `M ${sx} ${sy} H ${mx} V ${ey} H ${ex}`;
      } else {
        const detour = 12;                       // 目标与来源重叠/倒挂：向右绕行后折回
        d = `M ${sx} ${sy} H ${sx + detour} V ${ey} H ${ex}`;
      }
      const toN = S.nodes[to];
      const isCrit = (toN.critEdgeFrom || []).indexOf(from) >= 0;
      const isHi = !!(ganttHi && (ganttHi.has(from) || ganttHi.has(to)));
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      if (isCrit) p.classList.add('is-crit');
      if (isHi) p.classList.add('is-hi');
      p.setAttribute('marker-end', isHi ? 'url(#arr-hi)' : isCrit ? 'url(#arr-crit)' : 'url(#arr)');
      g.appendChild(p);
    });
  }
  // 依赖层重绘节流：一帧内只画一次（布局变动 / 高亮切换都会触发）
  function queueDeps() {
    if (depsRaf) return;
    depsRaf = requestAnimationFrame(() => { depsRaf = 0; drawDeps(); });
  }

  // 共享 tooltip（条目按 id 现取，避免复用节点时闭包持有过期对象）
  let tipEl = null;
  function showTip(t) {
    if (!t) return;
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'gantt-tip'; document.body.appendChild(tipEl); }
    const depNames = (t.deps || []).map(d => Schedule.nodes[d]).filter(Boolean).map(n => n.name).join('、') || '无前置';
    /* 状态一律「图标 + 文字」双编码，文字保持 --text-primary；
       v1 的行内 style="color:var(--pine/clay/c-danger)" 已全部删除。 */
    const buf = t.bufferLeft > 0
      ? `<span class="gt-flag gt-flag--ok">${AIC.stateIcon('success')}${t.bufferLeft} 工作日</span>`
      : `<span class="gt-flag gt-flag--bad">${AIC.stateIcon('blocked')}已超缓冲 ${Math.abs(t.bufferLeft)} 工作日</span>`;
    tipEl.innerHTML =
      `<b>${t.name}</b>` +
      `<div class="gt-row"><span class="gt-k">渠道</span><span>${LANE_LABEL[t.lane] || t.lane}</span></div>` +
      `<div class="gt-row"><span class="gt-k">状态</span><span>${STATUS_LABEL[t.status] || t.status}</span></div>` +
      `<div class="gt-row"><span class="gt-k">优先级</span><span class="gt-pri-${t.priority}">${t.priority}</span></div>` +
      `<div class="gt-row"><span class="gt-k">周期</span><span>${fmtMD(t.startD)} – ${fmtMD(t.endD)}</span></div>` +
      `<div class="gt-row"><span class="gt-k">工期</span><span>${t.durWd} 工作日${t.slipWd ? ` <span class="gt-flag gt-flag--warn">${AIC.stateIcon('warning')}延期 +${t.slipWd}</span>` : ''}</span></div>` +
      (t.wait ? `<div class="gt-row"><span class="gt-k">跨团队等待</span><span>${t.wait} 工作日</span></div>` : '') +
      (t.lead ? `<div class="gt-row"><span class="gt-k">并行重叠</span><span>前置已开工 ${t.lead} 工作日</span></div>` : '') +
      `<div class="gt-row"><span class="gt-k">风险缓冲</span><span>${buf}</span></div>` +
      `<div class="gt-row"><span class="gt-k">关键路径</span><span>${t.crit ? '是' : '否'}</span></div>` +
      `<div class="gt-row"><span class="gt-k">前置依赖</span><span>${depNames}</span></div>` +
      (t.conflict ? `<div class="gt-row"><span class="gt-k">资源</span><span class="gt-flag gt-flag--bad">${AIC.stateIcon('blocked')}同渠道时间重叠冲突</span></div>` : '');
    tipEl.classList.add('is-on');
  }
  function moveTip(e) { if (tipEl) { tipEl.style.left = (e.clientX + 14) + 'px'; tipEl.style.top = (e.clientY + 14) + 'px'; } }
  /* 键盘聚焦时把提示贴到条带旁（鼠标路径仍走 moveTip）。
     上方放不下（条带贴顶）就翻到下方，避免被钳到视口边缘而远离条带。 */
  function placeTipAt(el) {
    if (!tipEl || !el) return;
    const r = el.getBoundingClientRect();
    const h = tipEl.offsetHeight;
    const above = r.top - h - 10 >= 8;
    tipEl.style.left = Math.max(8, r.left + r.width / 2 - tipEl.offsetWidth / 2) + 'px';
    tipEl.style.top = (above ? r.top - h - 10 : r.bottom + 10) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.classList.remove('is-on'); }

  // 受影响任务高亮：脉冲描边 + 拽到最前
  function applyHi() {
    document.querySelectorAll('.sched .bar').forEach(b => {
      b.classList.toggle('is-hi', !!(ganttHi && ganttHi.has(b.dataset.id)));
    });
  }

  function focusTask(id) {
    const panel = document.getElementById('sched-impact');
    if (panel && panel.hasAttribute('hidden')) {
      panel.removeAttribute('hidden');
      const btn = document.getElementById('sched-impact-btn');
      if (btn) btn.setAttribute('aria-expanded', 'true');
      refreshImpactHistory();
    }
    ganttHi = new Set([id].concat([...Schedule._downstream(id)]));
    applyHi(); queueDeps();
  }

  function renderGantt() {
    const S = Schedule;
    const reduce = reduceMotion;
    const canTween = !reduce && !!window.gsap;

    // 刊头：范围 + 概要
    const rangeEl = document.getElementById('sched-range');
    if (rangeEl) rangeEl.textContent = `${fmtMD(0)} – ${fmtMD(AXIS - 1)}`;
    const meta = document.getElementById('sched-meta');
    if (meta) {
      const sm = S.summary();
      meta.innerHTML = `${sm.tasks} 任务 · ${sm.deps} 依赖 · ${sm.milestones} 里程碑<br>关键路径 <b>${sm.critLen}</b> 工作日` +
        (sm.conflicts ? ` · <span class="sched__conf">${AIC.stateIcon('blocked')}${sm.conflicts} 条资源冲突</span>` : '');
    }

    renderNwd();
    renderMilestones(S);

    // 先装箱求各泳道子行数（与行高无关），据此求解子行高；再进入渲染
    const laneTasks = TEAMS.map(lane => Object.values(S.nodes).filter(n => n.lane === lane && !n.isMilestone));
    const laneRows = laneTasks.map(packRows);
    ROW_PX = fitRowPx(laneRows.reduce((a, b) => a + b, 0));

    // 各泳道多任务条（节点按 id 复用，只更新几何与状态）
    TEAMS.forEach((lane, li) => {
      const laneEl = document.querySelector(`.lane[data-role="${lane}"]`);
      if (!laneEl) return;
      const track = laneEl.querySelector('.lane__track');
      const period = laneEl.querySelector('.sched__period');
      const tasks = laneTasks[li];
      const rows = laneRows[li];
      track.style.height = (rows * ROW_PX) + 'px';
      // 多子行时轨道中线会误导（它落在两行之间），只在单行时保留时间基线
      track.classList.toggle('is-multi', rows > 1);

      tasks.forEach(t => {
        let bar = track.querySelector(`.bar[data-id="${t.id}"]`);
        const isNew = !bar;
        if (isNew) {
          bar = document.createElement('i');
          bar.dataset.id = t.id;
          bar.innerHTML = '<span class="bar__wait"></span><span class="bar__fill"></span><span class="bar__buffer"></span><span class="bar__label"></span><span class="bar__pri"></span><span class="bar__flag">!</span>';
          track.appendChild(bar);
          /* 键盘可达：条带可聚焦，focus 复用同一份任务详情提示
             （此前任务详情只有 hover 能读到，键盘用户拿不到依赖/工期/缓冲信息） */
          bar.tabIndex = 0;
          bar.setAttribute('role', 'button');
          bar.addEventListener('mouseenter', () => showTip(Schedule.nodes[bar.dataset.id]));
          bar.addEventListener('mousemove', moveTip);
          bar.addEventListener('mouseleave', hideTip);
          bar.addEventListener('focus', () => { showTip(Schedule.nodes[bar.dataset.id]); placeTipAt(bar); });
          bar.addEventListener('blur', hideTip);
          bar.addEventListener('keydown', e => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            focusTask(bar.dataset.id);
          });
          bar.addEventListener('click', () => focusTask(bar.dataset.id));
        }

        const left = Math.max(0, Math.min(98, PCT(t.startD)));
        const width = Math.max(1.4, Math.min(100 - left, PCT(t.endD - t.startD)));
        const cls = ['bar', `bar--${lane}`];
        if (t.status === 'done') cls.push('is-done'); else if (t.status === 'queued') cls.push('is-queued'); else if (t.status === 'blocked') cls.push('is-blocked');
        if (t.crit) cls.push('is-crit');
        if (t.conflict && t.status !== 'done') cls.push('is-conflict');   // 已交付的重叠不再告警
        if (t.rush) cls.push('is-rush');
        if (t.needsAuth) cls.push('is-auth');      // 等待授权：与普通阻塞区分，界面需给出「要人放行」的读法
        if (ganttHi && ganttHi.has(t.id)) cls.push('is-hi');
        bar.className = cls.join(' ');
        bar.style.top = (t._row * ROW_PX + 2) + 'px';
        bar.style.height = (ROW_PX - 5) + 'px';
        bar.title = '';
        bar.setAttribute('aria-label', `${t.name} · 优先级 ${t.priority} · 工期 ${t.durWd} 工作日`);
        if (canTween && !isNew) {
          gsap.to(bar, { left: left + '%', width: width + '%', duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
        } else {
          bar.style.left = left + '%'; bar.style.width = width + '%';
        }
        if (isNew && canTween) gsap.fromTo(bar, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 });

        const fill = t.status === 'done' ? 100 : t.pct;
        bar.querySelector('.bar__fill').style.width = fill + '%';
        const span = Math.max(0.5, t.endD - t.startD);
        const waitW = t.wait ? Math.min(38, t.wait / span * 100) : 0;
        bar.querySelector('.bar__wait').style.width = waitW + '%';
        const bufEl = bar.querySelector('.bar__buffer');
        const bufW = Math.max(0, Math.min(45, Math.abs(t.bufferLeft) / Math.max(1, span) * 100));
        bufEl.style.width = t.bufferLeft > 0 ? bufW + '%' : '0%';
        bufEl.classList.toggle('is-tight', t.bufferLeft <= 1);
        bar.querySelector('.bar__label').textContent = t.name;
        const pri = bar.querySelector('.bar__pri');
        pri.textContent = t.priority;
        pri.className = 'bar__pri bar__pri--' + t.priority;
        const flag = bar.querySelector('.bar__flag');
        flag.style.display = t.conflict ? 'grid' : 'none';
      });

      // 清理已被移除的任务条（扰动消解 rush 任务时）
      track.querySelectorAll('.bar').forEach(b => { if (!tasks.find(t => t.id === b.dataset.id)) b.remove(); });

      if (period) {
        const conf = tasks.filter(t => t.conflict).length;
        const blocked = tasks.filter(t => t.status === 'blocked').length;
        period.innerHTML = `${tasks.length} 任务` +
          (blocked ? ` · <span class="per-conf">${AIC.stateIcon('blocked')}${blocked} 阻塞</span>` : '') +
          (conf ? ` · <span class="per-conf per-conf--warn">${AIC.stateIcon('warning')}${conf} 冲突</span>` : '');
      }
    });

    // 今日线
    const todayLine = document.getElementById('today-line');
    if (todayLine) todayLine.style.left = PCT(S.today) + '%';

    // 依赖箭头：布局稳定后绘制（补间结束再补一次，保证端点贴合）
    queueDeps();
    if (canTween) setTimeout(queueDeps, 640);
  }

  /* 影响分析面板：变更历史 + 波及范围 */
  function refreshImpactHistory() {
    const ol = document.getElementById('imp-hist');
    if (!ol) return;
    if (Schedule.histVersion !== lastHistVer) {
      lastHistVer = Schedule.histVersion;
      if (!Schedule.history.length) {
        ol.innerHTML = '<li class="imp__empty">排期稳定运行中，暂无变更记录…</li>';
        const det = document.getElementById('imp-detail');
        if (det) det.innerHTML = '<p class="imp__empty">选择左侧任一变更，查看其影响链：受波及任务、里程碑是否触险、关键路径长度变化。</p>';
        selEntry = null;
        return;
      }
      ol.innerHTML = Schedule.history.map((h, idx) => `
        <li class="imp__item${idx === 0 ? ' is-sel' : ''}" data-idx="${idx}">
          <span class="imp__dot imp__dot--${h.kind}"></span>
          <span class="imp__txt">
            <span class="t">${h.text}</span>
            <span class="m">${h.t} · 影响 ${(h.affects || []).length} 项${h.milestoneAtRisk ? ` · <span class="risk">${AIC.stateIcon('warning')}里程碑触险</span>` : ''}${h.slip ? ` · 关键路径 ${h.critBefore}→${h.critAfter}d` : ''}</span>
          </span>
        </li>`).join('');
      /* 键盘可达：变更历史行是可选项，原先只绑了 click ——
         键盘用户无法查看任何一条影响链。补 tabindex / role / Enter·Space，
         并用 aria-pressed 把选中态暴露给读屏（选中态此前只活在 CSS 里）。 */
      const select = li => {
        ol.querySelectorAll('.imp__item').forEach(x => {
          x.classList.remove('is-sel');
          x.setAttribute('aria-pressed', 'false');
        });
        li.classList.add('is-sel');
        li.setAttribute('aria-pressed', 'true');
        showImpact(Schedule.history[+li.dataset.idx]);
      };
      ol.querySelectorAll('.imp__item').forEach(li => {
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        li.setAttribute('aria-pressed', li.classList.contains('is-sel') ? 'true' : 'false');
        li.addEventListener('click', () => select(li));
        li.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(li); }
        });
      });
    }
    if (!selEntry || Schedule.history.indexOf(selEntry) < 0) selEntry = Schedule.history[0] || null;
    if (selEntry) showImpact(selEntry);
  }

  function showImpact(entry) {
    const det = document.getElementById('imp-detail');
    if (!det || !entry) return;
    const imp = Schedule.getImpact(entry);
    ganttHi = new Set(imp.downstream); ganttHi.add(entry.taskId);
    applyHi(); queueDeps();
    const aff = imp.affectedTasks.map(t => `<span class="imp__chip${t.crit ? ' is-crit' : ''}">${t.name}</span>`).join('');
    /* 里程碑不再用 ◆ 符号兜状态：改用精灵图标（ic-circle / ic-x），与其余状态同语言 */
    const down = imp.downstream.map(id => Schedule.nodes[id]).filter(Boolean)
      .map(t => `<span class="imp__chip${t.isMilestone ? ' is-risk' : ''}">${t.isMilestone ? AIC.stateIcon('blocked') + t.name : t.name}</span>`).join('');
    const riskMs = imp.milestonesAtRisk.map(m => `<span class="imp__chip is-risk">${AIC.stateIcon('blocked')}${m.name} 触险</span>`).join('');
    det.innerHTML =
      `<div class="imp__ttl">${entry.text}</div>` +
      `<div class="imp__stat">` +
        `<div class="s"><b class="${entry.critAfter > entry.critBefore ? 'up' : ''}">${entry.critAfter}</b><span>${entry.critAfter > entry.critBefore ? AIC.stateIcon('warning') : ''}关键路径(工作日)</span></div>` +
        `<div class="s"><b>${imp.affectedTasks.length}</b><span>直接受影响</span></div>` +
        `<div class="s"><b>${imp.downstream.length}</b><span>波及任务</span></div>` +
      `</div>` +
      `<div class="imp__sub">直接受影响任务</div><div class="imp__chips">${aff || '<span class="imp__chip">无</span>'}</div>` +
      (riskMs ? `<div class="imp__sub">里程碑触险</div><div class="imp__chips">${riskMs}</div>` : '') +
      `<div class="imp__sub">下游波及链</div><div class="imp__chips">${down || '<span class="imp__chip">无</span>'}</div>`;
  }

  function wireImpactPanel() {
    const btn = document.getElementById('sched-impact-btn');
    const panel = document.getElementById('sched-impact');
    const close = document.getElementById('sched-impact-close');
    const shut = () => {
      panel.setAttribute('hidden', '');
      panel.style.maxHeight = '';   // 清掉内联高度，否则内联值会盖过 CSS 的 max-height:0，收起后仍占位
      const b = document.getElementById('sched-impact-btn'); if (b) b.setAttribute('aria-expanded', 'false');
      ganttHi = null; applyHi(); queueDeps();
    };
    if (btn && panel) {
      btn.addEventListener('click', () => {
        if (panel.hasAttribute('hidden')) {
          panel.removeAttribute('hidden');
          btn.setAttribute('aria-expanded', 'true');
          syncImpactHeight();
          refreshImpactHistory();
        } else shut();
      });
    }
    if (close && panel) close.addEventListener('click', shut);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && panel && !panel.hasAttribute('hidden')) shut();
    });
    syncImpactHeight();
  }

  /* 影响面板展开高度：100vh 大屏里 .mosaic 是唯一可压缩项，
     面板只能吃掉它当下能让出的高度，否则会顶穿视口、末尾横带被裁掉。
     量取前先把面板临时收起一帧（并禁用过渡），避免量到「已被自己压扁」的拼版区。 */
  function measureMosaicFree() {
    const panel = document.getElementById('sched-impact');
    const mosaic = document.querySelector('.mosaic');
    if (!mosaic || !panel) return 0;
    const wasOpen = !panel.hasAttribute('hidden');
    const prevMax = panel.style.maxHeight, prevMt = panel.style.marginTop, prevTr = panel.style.transition;
    if (wasOpen) {
      panel.style.transition = 'none';
      panel.style.maxHeight = '0px';
      panel.style.marginTop = '0px';
    }
    const free = mosaic.getBoundingClientRect().height;
    if (wasOpen) {
      panel.style.maxHeight = prevMax;
      panel.style.marginTop = prevMt;
      void panel.offsetHeight;
      panel.style.transition = prevTr;
    }
    return free;
  }
  function syncImpactHeight() {
    const panel = document.getElementById('sched-impact');
    if (!panel) return;
    if (panel.hasAttribute('hidden')) { panel.style.maxHeight = ''; return; }
    panel.style.maxHeight = Math.max(132, Math.round(measureMosaicFree() - 14)) + 'px';
  }
  wireImpactPanel();

  /* 排期引擎：虚拟时钟推进 + 周期扰动 → 重绘甘特与影响面板 */
  Schedule.onChange(() => {
    if (document.hidden) return;
    renderGantt();
    const panel = document.getElementById('sched-impact');
    if (panel && !panel.hasAttribute('hidden')) refreshImpactHistory();
  });
  Schedule.start(15000);

  function updateAll() { updateLedger(); updateSpine(); updateHero(); updateRelay(); renderMetrics(); renderGantt(); }

  World.on(evts => {
    updateAll();
    const st = World.state;
    evts.forEach(e => {
      if (e.type === 'order' && st.orders[e.id]) {
        const o = st.orders[e.id];
        AIC.toast({ title: '新任务自动进入', body: `${o.client} · ${o.demand}`, color: 'var(--color-accent)', tag: '任务池' });
      } else if (e.type === 'settle' && st.orders[e.id]) {
        const o = st.orders[e.id];
        AIC.toast({ title: '交付完成 · 已归档', body: `${o.client} · ${o.demand}`, color: 'var(--color-accent)', tag: o.settledAt || World.timeHM() });
      } else if (e.type === 'block' && st.tasks[e.id]) {
        AIC.toast({ title: '任务阻塞 · 自动重试', body: st.tasks[e.id].title, color: 'var(--color-warning)', tone: 'clay', tag: World.timeHM() });
      } else if (e.type === 'taskDone' && st.tasks[e.id] && st.tasks[e.id].owner && EMP_TILE[st.tasks[e.id].owner]) {
        pulseTile(EMP_TILE[st.tasks[e.id].owner]);
      }
    });
  });

  // 甘特「今日」线由 schedule 引擎时钟统一驱动，随世界事件一并重绘
  function moveToday() { renderGantt(); }
  every(moveToday, 30000);

  /* 视口尺寸变化：子行高按视口高重解，防抖 180ms 后重绘 */
  let rzTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => { hideTip(); renderGantt(); syncImpactHeight(); }, 180);
  });

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
        /* 进度条填充色与徽章同源：容器状态类决定 --rc，避免静态类与实时状态脱节 */
        const live = bar.closest('.tile-live');
        const setLive = cls => {
          if (!live) return;
          live.classList.remove('is-success', 'is-run', 'is-warn', 'is-blocked', 'is-neutral');
          live.classList.add(cls);
        };
        if (!t) { bar.style.width = '0%'; num.textContent = '等待派单'; setPill(pill, '待命中', 'pill--neutral', 'neutral'); setLive('is-neutral'); return; }
        if (t.status === 'blocked') {
          bar.style.width = t.pct + '%'; num.textContent = Math.round(t.pct) + '% · 自动重试中';
          setPill(pill, '阻塞', 'pill--bad', 'blocked'); setLive('is-blocked');
        } else if (t.status === 'doing') {
          bar.style.width = t.pct + '%'; num.textContent = Math.round(t.pct) + '% · ' + t.title;
          setPill(pill, '生成中', 'pill--run', 'running'); setLive('is-run');
        } else {
          bar.style.width = '100%'; num.textContent = '已交付 · ' + t.title;
          setPill(pill, '已交付', 'pill--success', 'success'); setLive('is-success');
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
          AIC.toast({ title: '质检返工 · 自动修正', body: t ? t.title : '', color: 'var(--color-warning)', tone: 'clay', tag: World.timeHM() });
        }
      });
    });

    updateTiles();
  })();

