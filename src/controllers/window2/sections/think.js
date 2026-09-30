/* ============================================================
   第 3 屏 section · 思考链（原 window2.js 推理流逐行等价迁移，P3-1）
   挂载条件：页面存在 #think。缺容器时整体不挂载，bus.think 保持 no-op，
   事件处理器与其它 section 的 thinkChain/thinkQuick 调用自然空转。
   ============================================================ */
import {
  AIC, World, fmtAgo, reduceMotion, chatEsc, bus
} from '../shared.js';

const thinkPane = document.getElementById('think');

const thinkQ = [];
let thinkBusy = false;
const thinkRecent = new Map();       /* dedupeKey → { at, el, n }：同文巡检合并 */
const THINK_MAX_STEPS = 260;
const PHASE_META = {
  obs:   { label: '观察', pause: 180 },
  cut:   { label: '拆解', pause: 400 },
  sim:   { label: '推演', pause: 720 },
  judge: { label: '决策', pause: 450 },
  concl: { label: '结论', pause: 980 }
};
const thinkSleep = ms => new Promise(r => setTimeout(r, ms));
const thinkScale = ms => Math.max(55, ms / Math.max(1, World.speed));
const holdForText = text => Math.max(130, Math.min(1450, Math.max(340, 280 + String(text).length * 24)) / Math.max(1, World.speed));

let thinkAutoScroll = true;
let thinkJump = null;
let thinkAutoTop = -1;        /* 程序滚动落点：区分「自动吸底」与「用户上滑回看」 */
(function armThinkScroll() {
  if (!thinkPane) return;
  thinkJump = document.createElement('button');
  thinkJump.type = 'button';
  thinkJump.className = 'eb-jump';
  thinkJump.hidden = true;
  thinkJump.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg><span>回到最新</span>';
  thinkJump.addEventListener('click', () => {
    thinkAutoScroll = true;
    thinkJump.hidden = true;
    thinkPane.scrollTop = thinkPane.scrollHeight;
    thinkAutoTop = thinkPane.scrollTop;
  });
  const host = thinkPane.closest('.tp__panel') || thinkPane.parentElement;
  if (host) host.appendChild(thinkJump);
  thinkPane.addEventListener('scroll', () => {
    if (Math.abs(thinkPane.scrollTop - thinkAutoTop) < 2) return;   /* 自动吸底引起的滚动，不算用户操作 */
    const nearBottom = thinkPane.scrollHeight - thinkPane.scrollTop - thinkPane.clientHeight < 52;
    thinkAutoScroll = nearBottom;
    thinkJump.hidden = nearBottom;
  }, { passive: true });
})();
function thinkScroll(force) {
  if (!thinkPane) return;
  if (!force && !thinkAutoScroll) return;
  thinkPane.scrollTop = thinkPane.scrollHeight;
  thinkAutoTop = thinkPane.scrollTop;
}
function trimThinking() {
  if (!thinkPane) return;
  const chains = thinkPane.querySelectorAll('.eb-chain');
  let steps = thinkPane.querySelectorAll('.eb-step').length;
  let i = 0;
  while (steps > THINK_MAX_STEPS && i < chains.length - 1) {
    steps -= chains[i].querySelectorAll('.eb-step').length;
    chains[i].remove();
    i++;
  }
  if (thinkAutoScroll) { thinkPane.scrollTop = thinkPane.scrollHeight; thinkAutoTop = thinkPane.scrollTop; }
}
function markChainRepeat(head, n) {
  const meta = head.querySelector('.eb-chain__meta');
  if (!meta) return;
  let badge = meta.querySelector('.eb-chain__n');
  if (!badge) { badge = document.createElement('span'); badge.className = 'eb-chain__n'; meta.appendChild(badge); }
  badge.textContent = '×' + n;
}
async function typeStep(row, text) {
  const tx = row.querySelector('.eb-think__tx');
  if (!tx) return;
  /* 打字机必须在「进入动画之前」脱敏，否则会一个字一个字地把金额打出来 */
  const full = AIC.stripMoney(String(text));
  if (reduceMotion) { tx.textContent = full; return; }
  const sp = Math.max(1, World.speed);
  const chunk = sp >= 6 ? 4 : sp >= 3 ? 3 : 2;
  const delay = Math.max(7, 27 / sp);
  for (let i = chunk; i < full.length + chunk; i += chunk) {
    tx.textContent = full.slice(0, i);
    thinkScroll(false);
    await thinkSleep(delay);
  }
  tx.textContent = full;
}
async function playThinking(spec) {
  if (!thinkPane) return;
  trimThinking();
  const total = spec.steps.length;
  const head = document.createElement('div');
  head.className = 'eb-chain' + (spec.tone === 'risk' ? ' eb-chain--risk' : '');
  head.innerHTML = `<div class="eb-chain__head"><span class="eb-chain__pulse"></span><b>${chatEsc(spec.title || '推演')}</b><span class="eb-chain__meta"><span class="num" data-ts="${Date.now()}">${fmtAgo(Date.now())}</span><i>·</i><em>${total} 步推演</em></span></div>`;
  thinkPane.appendChild(head);
  if ((spec.repeat || 1) > 1) markChainRepeat(head, spec.repeat);
  thinkScroll(false);
  await thinkSleep(thinkScale(180));
  for (let i = 0; i < total; i++) {
    const st = spec.steps[i];
    const phase = PHASE_META[st.p] ? st.p : 'sim';
    const row = document.createElement('div');
    row.className = `eb-step eb-step--${phase}` + (st.risk ? ' eb-step--risk' : '');
    row.innerHTML = `<span class="eb-step__idx"><b>${i + 1}</b><i>/${total}</i></span><span class="eb-step__phase">${PHASE_META[phase].label}</span><span class="eb-think__tx"></span>`;
    head.appendChild(row);
    row.classList.add('is-run');
    thinkScroll(false);
    await typeStep(row, st.t);
    row.classList.remove('is-run');
    row.classList.add('is-done');
    if (phase === 'concl') head.classList.add('is-concluded');
    thinkScroll(false);
    await thinkSleep(holdForText(st.t) + thinkScale(PHASE_META[phase].pause));
  }
  head.classList.add('is-done');
  if (spec.dedupe) {
    thinkRecent.set(spec.dedupe, { at: Date.now(), el: head, n: spec.repeat || 1 });
    while (thinkRecent.size > 40) thinkRecent.delete(thinkRecent.keys().next().value);
  }
}
function pumpThinking() {
  if (thinkBusy || !thinkQ.length) return;
  const spec = thinkQ.shift();
  thinkBusy = true;
  playThinking(spec).catch(err => console.error('[think]', err)).then(() => {
    thinkBusy = false;
    if (thinkQ.length) setTimeout(pumpThinking, thinkScale(300));
  });
}
/* 入队：高优先级插队；同文巡检先合并；队列过长时丢弃最低优先级链 */
function thinkChain(title, steps, opts = {}) {
  if (!thinkPane || !steps || !steps.length) return;
  const spec = { title, steps, prio: opts.prio || 4, tone: opts.tone, dedupe: opts.dedupe, repeat: 1 };
  if (spec.dedupe) {
    const queued = thinkQ.find(c => c.dedupe === spec.dedupe);
    if (queued) { queued.repeat++; queued.steps = spec.steps; return; }
    const recent = thinkRecent.get(spec.dedupe);
    if (recent && Date.now() - recent.at < 60000) { recent.n++; markChainRepeat(recent.el, recent.n); return; }
  }
  if (spec.prio >= 8) thinkQ.unshift(spec); else thinkQ.push(spec);
  while (thinkQ.length > 7) {
    let idx = -1, low = Infinity;
    thinkQ.forEach((c, i) => { if (c.prio < low) { low = c.prio; idx = i; } });
    thinkQ.splice(idx, 1);
  }
  pumpThinking();
}
/* 一般事件：观察 → 推演 → 结论 */
function thinkQuick(title, obs, sim, concl, opts = {}) {
  thinkChain(title, [{ p: 'obs', t: obs }, { p: 'sim', t: sim }, { p: 'concl', t: concl }], opts);
}
/* 巡检推演：把复读式播报变成「读指标 → 推影响 → 给判定」 */
export function patrolSim(text, s) {
  if (/任务池/.test(text)) return `推演：并行度 ${s.doing} · 排队 ${s.queued}，背压阈值未触及，无需限流。`;
  if (/交付量|营收/.test(text)) return `推演：负载随并行度线性浮动，一次通过率仍在上限区间，无需干预。`;
  if (/知识库/.test(text)) return `推演：入库速率与产出速率匹配，索引无积压。`;
  if (/在产订单/.test(text)) return `推演：逐单复核交付窗口，产能与排期对齐。`;
  if (/算力/.test(text)) return `推演：剩余算力可再承接 ${Math.max(2, 20 - s.doing)} 路并行任务。`;
  return `推演：节律与接单速率匹配，无异常波动。`;
}
export function patrolVerdict(text) {
  if (/无死锁|无风险|无异常|正常|无积压|未触及/.test(text)) return '判定：无需干预，继续无人值守。';
  if (/风险|死锁|偏高|超期|阻塞/.test(text)) return '判定：转入下一次重点复核，暂不打断产线。';
  return '判定：无需干预，继续无人值守。';
}
/* 启动链：接管经营现场（替代原先写死在 HTML 里的静态思考行） */
function bootThinking() {
  if (!thinkPane) return;
  const st = World.state;
  const tasks = Object.values(st.tasks);
  const doing = tasks.filter(t => t.status === 'doing').length;
  const queued = tasks.filter(t => t.status === 'queued').length;
  const producing = Object.values(st.orders).filter(o => o.status === 'producing').length;
  thinkChain('接管经营现场 · 启动推演', [
    { p: 'obs',   t: `读取任务池 ${st.counters.total} 项：进行 ${doing} · 排队 ${queued}，无死锁。` },
    { p: 'cut',   t: `关键路径识别：数据 → 视觉 → 前端 → 整合，四段交付物依次串联。` },
    { p: 'sim',   t: `交付窗口推演：在产 ${producing} 单，前端联调是关键路径上最紧的一环。` },
    { p: 'judge', t: `资源再平衡：把文案终校并入工程联调时段并行执行，可追回约 0.5 天。` },
    { p: 'concl', t: `执行序列就绪：交付窗口锁定周五 10:00，预留 40 分钟缓冲。` }
  ], { prio: 10 });
}

export function initThink() {
  if (!thinkPane) return;
  bus.think = { chain: thinkChain, quick: thinkQuick };
  bootThinking();
}
