/* ============================================================
   window2 共享基座（原 window2.js 头部基础设施抽出，三屏拆分 P3-1）
   - 定时器登记 + pagehide 清理（P0-3/P0-5 契约不变）
   - 跨 section 事件总线 bus：各 section 挂载时覆写自己的钩子；
     页面缺某 section 时保持默认 no-op —— 事件在任何页面流过都安全。
   - PAGE 页面标记：<body data-page2="screen2|screen3|screen4">，
     缺省（window2.html 卷轴）= 'all'，行为与拆分前完全一致。
   ============================================================ */
import { AIC } from '../../modules/common.js';
import { World } from '../../modules/world.js';
import { fmtAgo, nowHM } from '../../modules/time.js';

export { AIC, World, fmtAgo, nowHM };

export const CAST = AIC.CAST;
export const STATUS_TXT = AIC.STATUS_TXT;
export const AVATAR_MAP = AIC.AVATAR_MAP;
export const statusText = AIC.statusText || ((status) => STATUS_TXT[status]);
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const gsapOK = () => window.gsap && !reduceMotion && !document.body.classList.contains('no-anim');
if (!window.gsap) document.body.classList.add('no-anim');

export const $ = s => document.querySelector(s);
export const setTxt = (s, v) => { const el = $(s); if (el) el.textContent = v; };

export const PAGE = document.body.dataset.page2 || 'all';

/* ---------------- 可变共享状态（跨 section 读写） ---------------- */
export const state = {
  patrolOn: true,
  taskBusy: false,
  sleeping: false
};

/* ---------------- 定时器统一登记：pagehide 集中清理（P0-3/P0-5） ---------------- */
const intervals = new Set();
const timeouts = new Set();
export function every(fn, ms) { const id = setInterval(fn, ms); intervals.add(id); return id; }
export function later(fn, ms) { const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); return id; }
export function clearPageTimers() {
  intervals.forEach(id => clearInterval(id)); intervals.clear();
  timeouts.forEach(id => clearTimeout(id)); timeouts.clear();
}
let pageHideExtra = null;
export function onPageHide(fn) { pageHideExtra = fn; }
window.addEventListener('pagehide', () => { clearPageTimers(); if (pageHideExtra) { try { pageHideExtra(); } catch (e) { console.error('[pagehide]', e); } } });

/* ---------------- 交付文档上下文登记（气泡复看反查用，P0-4 上限防泄漏） ---------------- */
const docRefs = new Map();
const DOC_REFS_MAX = 64;
export function setDocRef(key, val) {
  docRefs.set(key, val);
  if (docRefs.size > DOC_REFS_MAX) { const k = docRefs.keys().next().value; if (k !== undefined) docRefs.delete(k); }
}
export function getDocRef(key) { return docRefs.get(key); }

/* ---------------- 纯工具 ---------------- */
export function whoName(who) { return who === 'main' ? '主 AI' : (CAST.find(c => c.key === who) || {}).name || who; }
export function chatEsc(value = '') {
  return AIC.stripMoney(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/* 现场快照：推理链里的数字都取自真实世界状态，保证「想过」有依据 */
export function snapWorld() {
  const st = World.state;
  const tasks = Object.values(st.tasks);
  return {
    st,
    doing: tasks.filter(t => t.status === 'doing').length,
    queued: tasks.filter(t => t.status === 'queued').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    producing: Object.values(st.orders).filter(o => o.status === 'producing').length
  };
}

/* ---------------- 跨 section 事件总线 ----------------
   默认全部 no-op；挂载对应 section 的页面由其覆写实现。
   事件处理器只经 bus 调用，页面缺 section 时调用即安全空转。 */
export const bus = {
  /* 第 2 屏 · 群聊 */
  chat: {
    queueChat() {},
    addReact() {},
    lastRow() { return null; },
    threadRows() { return []; },
    discussion() { return []; }
  },
  /* 第 3 屏 · 思考链 */
  think: {
    chain() {},
    quick() {}
  },
  /* 第 3 屏 · 表情球 / 待机看门狗 */
  eb: {
    setEmotion() {},
    clearGaze() {},
    burst() {},
    wakeIdle() {},
    isBusy() { return state.taskBusy || state.sleeping; }
  },
  /* 第 3 屏 · 速度档 UI 回显 */
  hub: {
    syncSpeedUI() {}
  },
  /* 第 4 屏 · 知识 */
  shelf: {
    addShelfRow() {}
  },
  pulse() {},      /* 戴森球员工锚点点亮 */
  kbAdd() {},      /* 戴森球知识写入 */
  kbRework() {},   /* 返工时的知识图谱联动（stats/getPoint/inspect） */
  kb: {
    template() {}  /* 知识屏模板变换（knowledge section 挂载后覆写：芯片 + data-tpl） */
  },
  doc: {
    generate() {}  /* 交付文档生成 + 审阅（docgen section 挂载后覆写） */
  },
  badges: {
    renderBadges() {}
  }
};
