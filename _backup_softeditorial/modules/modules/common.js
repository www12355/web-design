/* ============================================================
 * 全自主 AI 经营体 · 共享工具 / Toast / 角色数据接入
 * 角色 / 状态 / 头像 / 图标数据来自 src/data/*，本模块只提供行为封装。
 * 供各页控制器 import；同时挂到 window.AIC 兼容历史引用。
 * ============================================================ */
import { CAST, STATUS_TXT, AVATAR_MAP } from '../data/cast.js';
import { SPRITE } from '../data/icons.js';
import { nowHM } from '../modules/time.js';

const AIC = {};
AIC.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- 角色数据源（唯一，四屏一致） ---------------- */
AIC.CAST = CAST;
AIC.STATUS_TXT = STATUS_TXT;
AIC.statusText = function (status) {
  const key = 'status.' + (status || 'idle');
  return window.L10n ? window.L10n.t(key) : (STATUS_TXT[status] || status || '待命');
};
AIC.castLabel = function (key, fallback) {
  return window.L10n ? window.L10n.t('roles.' + key) : (fallback || key);
};

AIC.AVATAR_MAP = AVATAR_MAP;

/* ---------------- 文件类型图标精灵（一次注入） ---------------- */
AIC.injectSprite = function () {
  if (document.getElementById('aic-ft-sprite')) return;
  document.body.insertAdjacentHTML('afterbegin', SPRITE);
};
if (document.body) AIC.injectSprite();
else document.addEventListener('DOMContentLoaded', AIC.injectSprite);

/* ---------------- 时间：委托世界引擎（未加载则退回真实时钟） ---------------- */
AIC.timeHM = function () {
  if (window.World) return World.timeHM();
  return window.L10n ? window.L10n.time(new Date()) : nowHM();
};

/* ---------------- 金额格式化 ---------------- */
AIC.fmtMoney = function (n) {
  if (window.L10n) return window.L10n.currency(n, 'CNY');
  if (n >= 10000) {
    const w = n / 10000;
    return (w >= 100 ? Math.round(w) : Math.round(w * 10) / 10) + '万';
  }
  return Math.round(n).toLocaleString('en-US');
};
AIC.fmtMoneyFull = n => window.L10n ? window.L10n.currency(n, 'CNY') : '¥' + Math.round(n).toLocaleString('en-US');

/* ---------------- 数字补间（gsap 可选，首次直接落值） ---------------- */
const numPrev = new WeakMap();
AIC.tweenNum = function (el, to, opt) {
  if (!el) return;
  opt = opt || {};
  const dec = opt.decimals || 0;
  const fmt = v => dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
  const prev = numPrev.get(el);
  if (prev === undefined) { numPrev.set(el, to); el.textContent = fmt(to); return; }
  if (Math.abs(prev - to) < 1e-9) return;
  numPrev.set(el, to);
  if (!window.gsap || AIC.reduceMotion || opt.instant) { el.textContent = fmt(to); return; }
  const o = { v: prev };
  gsap.to(o, { v: to, duration: opt.dur || 0.8, ease: 'power1.out', onUpdate() { el.textContent = fmt(o.v); } });
};

/* ---------------- Toast 通知（右下角，两窗口共用样式） ---------------- */
AIC.toast = function (o) {
  let host = document.getElementById('aic-toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'aic-toasts';
    host.className = 'aic-toasts';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'aic-toast' + (o.tone ? ' aic-toast--' + o.tone : '');
  el.innerHTML = `
    <i class="aic-toast__dot" style="background:${o.color || 'var(--pine)'}"></i>
    <div class="aic-toast__bd">
      <b>${o.title}</b>
      ${o.body ? `<span>${o.body}</span>` : ''}
    </div>
    ${o.tag ? `<span class="aic-toast__tag num">${o.tag}</span>` : ''}`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  let timer = setTimeout(kill, 5400);
  function kill() { clearTimeout(timer); el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 380); }
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(kill, 1600); });
  el.addEventListener('click', kill);
  while (host.children.length > 4) host.firstElementChild.remove();
};

/* ---------------- 小屏提示（桌面设计稿，窄屏给出引导） ---------------- */
AIC.smallScreenNotice = function () {
  if (!window.matchMedia('(max-width: 1100px)').matches) return;
  if (document.getElementById('aic-miniscreen')) return;
  const el = document.createElement('div');
  el.id = 'aic-miniscreen';
  el.innerHTML = '本设计稿为桌面大屏演示 · 建议 1280px 及以上宽度浏览';
  document.body.appendChild(el);
};
document.addEventListener('DOMContentLoaded', AIC.smallScreenNotice);

window.AIC = AIC;
export { AIC };