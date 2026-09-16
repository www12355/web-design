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

/* 金额格式化工具已移除（原 AIC.fmtMoney / AIC.fmtMoneyFull）：演示口径下界面不出现金额，
   统一走下面的 AIC.stripMoney 做反向脱敏。世界引擎内部的金额运算保留在
   src/modules/world.js 自己的 World.fmtMoney 上，不受此处影响。 */

/* ---------------- 去金钱化文本出口（演示口径） ----------------
 * 交互演示不出现任何金额与价格字眼，但世界引擎内部仍按账本运算
 * （ledger / spark / 算力计费 / 结算入账都不动）。所有「用户可见文本」
 * 统一经过本函数：金额整段摘除 + 价格词就地换成中性表述，
 * 并要求替换后句子仍然通顺可读。
 *
 * 设计要点：
 * 1) 分段各做「一次」replace。词表用单个联合正则 + 映射表一次替换，
 *    避免连续多次 replace 造成二次命中（如「两段结算」先命中「结算」→
 *    不可读的「两段归档」）。
 * 2) 幂等：映射结果里不含任何词表键，重复调用结果一致。
 * 3) 正则为线性、无嵌套量词，无回溯风险；收尾只处理空格/制表符，不吞换行。
 */
const MONEY_WORDS = [
  /* 长词在前：联合正则按序尝试，保证「结算尾款到账」不被「结算」截断 */
  ['结算尾款到账', '交付归档'],
  ['结算回款', '交付归档'],
  ['报价签约', '方案确认'],
  ['自动签约', '自动受理'],
  ['签约金额', '交付范围'],
  ['两段结算', '两阶段验收'],
  ['净利率', '一次通过率'],
  ['利润率', '一次通过率'],
  ['结算', '归档'],
  ['回款', '入库'],
  ['尾款', '验收余项'],
  ['到账', '完成'],
  ['入账', '归档'],
  ['签约', '受理'],
  ['报价', '方案'],
  ['营收', '交付量'],
  ['利润', '效率'],
  ['成本', '负载', '(?<![生完达变构造留形])'],
  ['计费', '调度'],
  ['预算', '容量'],
  ['金额', '交付量'],
  ['均价', '复杂度'],
  ['定价', '服务'],
  ['价格', '方案'],
  ['付费', '开通'],
  ['收费', '调用'],
  ['大额', '长链路'],
  ['小额', '小体量'],
  /* 兜底：账本 / 财务 / 经济 一类金钱语义词，避免漏网到界面 */
  ['账本', '档案'],
  ['财务', '运营'],
  ['经济', '产出']
];
const MONEY_MAP = {};
/* 第三项是可选「左边界护栏」：中文词会跨词边界误命中（「生成本次」里的「成本」、
   「平均价值」里的「均价」），故对易误伤的键加否定后顾，护栏为零宽，匹配文本仍是原词。 */
const MONEY_SOURCE = MONEY_WORDS.map(w => {
  MONEY_MAP[w[0]] = w[1];
  return (w[2] || '') + w[0];
});
const MONEY_RE = new RegExp(MONEY_SOURCE.join('|'), 'g');
/* 含金额的括号补充说明：「（预付 30% ¥1.3万 已到账）」整段摘除 */
const MONEY_PAREN_RE = /[（(][^（）()]*[¥￥][^（）()]*[）)]/g;
/* 整句式价格表述 → 中性句 */
const MONEY_SENT_RE = /签约收\s*\d+\s*%\s*预付[，,、]?\s*交付收\s*\d+\s*%\s*尾款[。.]?/g;
/* 价格区间「均价 2–10万」→ 同形状的「复杂度 2–10」 */
const MONEY_RANGE_RE = /均价\s*(\d+(?:\.\d+)?\s*[–—-]\s*\d+(?:\.\d+)?)\s*(?:亿元|亿|万元|万|千元|千|元)?/g;
/* 「¥/￥ + 数字 + 单位」整段摘除 */
const MONEY_NUM_RE = /[¥￥]\s*\d[\d,]*(?:\.\d+)?\s*(?:亿元|亿|万元|万|千元|千|元)?/g;

AIC.stripMoney = function (text) {
  if (text == null) return '';
  let s = String(text);
  if (!s) return '';
  s = s.replace(MONEY_PAREN_RE, '')                 /* 先摘含金额的括号补充 */
       .replace(MONEY_SENT_RE, '分阶段验收交付')
       .replace(MONEY_RANGE_RE, '复杂度 $1')         /* 先做区间：否则「均价」被词表换掉后数值会孤立 */
       .replace(MONEY_NUM_RE, '')
       .replace(MONEY_RE, m => MONEY_MAP[m]);
  /* 收尾：清掉摘除后留下的空括号 / 悬空分隔符 / 重复标点 / 多余空格 */
  return s.replace(/[（(]\s*[）)]/g, '')
          .replace(/[ \t]*[·、,，][ \t]*$/g, '')
          .replace(/[ \t]+([。；;，,、])/g, '$1')
          .replace(/([，,])[ \t]*\1/g, '$1')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();
};

/* ---------------- 数字补间（gsap 可选） ----------------
 * 页面数字的唯一写入口，保证「任何窗口可见性状态下，元素最终文本都等于最后一次传入的目标值」：
 * - 元素级补间登记：新补间启动前先 kill 旧补间，杜绝多个补间抢写同一元素；
 * - 早退判据看「DOM 现有文本」而非「上次目标值」——补间被中断（后台窗口 rAF 暂停）后仍能自愈；
 * - document.hidden / 无 gsap / reduceMotion / instant 时直接落终值（GSAP 在不可见窗口不会推进）；
 * - 起点取元素当前渲染值，onComplete 强制写终值，避免浮点尾差；
 * - AIC.flushNums()：把所有数字立即校准到终值，供窗口恢复可见时调用。
 * opt: { decimals, instant, dur, ease, from }
 */
const numState = new WeakMap();
const numEls = [];

function numFormat(v, dec) { return dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US'); }
function numRead(el) {
  const v = parseFloat(String(el.textContent == null ? '' : el.textContent).replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(v) ? v : null;
}
function numWrite(el, v, dec) {
  const txt = numFormat(v, dec);
  if (el.textContent !== txt) el.textContent = txt;
}

AIC.tweenNum = function (el, to, opt) {
  if (!el || !Number.isFinite(to)) return;
  opt = opt || {};
  const dec = opt.decimals || 0;
  const target = numFormat(to, dec);
  let rec = numState.get(el);
  if (!rec) { rec = { to: to, dec: dec, tween: null }; numState.set(el, rec); numEls.push(el); }
  const running = !!(rec.tween && rec.tween.isActive && rec.tween.isActive());
  rec.to = to; rec.dec = dec;

  const intro = Number.isFinite(opt.from);
  /* 已是最新值且没有在跑的补间：无需重画（同时保证不会因早退而留下旧文本） */
  if (!intro && !running && el.textContent === target) return;

  if (!window.gsap || AIC.reduceMotion || opt.instant || document.hidden) {
    if (rec.tween) { rec.tween.kill(); rec.tween = null; }
    numWrite(el, to, dec);
    return;
  }

  const now = numRead(el);
  const from = intro ? opt.from : (now === null ? to : now);
  if (rec.tween) rec.tween.kill();
  const o = { v: from };
  rec.tween = gsap.to(o, {
    v: to,
    duration: opt.dur || 0.8,
    ease: opt.ease || 'power1.out',
    onUpdate() { numWrite(el, o.v, dec); },
    onComplete() { rec.tween = null; numWrite(el, to, dec); }
  });
};

/* 把所有登记过的数字立即落终值（窗口恢复可见 / 动画时钟被冻结时调用） */
AIC.flushNums = function () {
  for (let i = numEls.length - 1; i >= 0; i--) {
    const el = numEls[i];
    if (!el || !el.isConnected) { numEls.splice(i, 1); continue; }
    const rec = numState.get(el);
    if (!rec || !Number.isFinite(rec.to)) continue;
    if (rec.tween) { rec.tween.kill(); rec.tween = null; }
    numWrite(el, rec.to, rec.dec);
  }
};

/* 后台窗口 rAF 暂停会让补间停在中间值：恢复可见先落终值，再交给上层重绘 */
document.addEventListener('visibilitychange', () => { if (!document.hidden) AIC.flushNums(); });

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
  /* 吐司是全屏共用出口：在这里统一脱敏，一处即覆盖 index / screen1 / window2 的所有调用方 */
  const title = AIC.stripMoney(o.title);
  const body = AIC.stripMoney(o.body);
  const tag = AIC.stripMoney(o.tag);
  const el = document.createElement('div');
  el.className = 'aic-toast' + (o.tone ? ' aic-toast--' + o.tone : '');
  el.innerHTML = `
    <i class="aic-toast__dot" style="background:${o.color || 'var(--pine)'}"></i>
    <div class="aic-toast__bd">
      <b>${title}</b>
      ${body ? `<span>${body}</span>` : ''}
    </div>
    ${tag ? `<span class="aic-toast__tag num">${tag}</span>` : ''}`;
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