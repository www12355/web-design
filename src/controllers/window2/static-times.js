import { fmtAgo, mountTimeTicker } from '../../modules/time.js';

/* ============================================================
   第 2 屏 · 静态时间标签归一化（原 window2.js 内联 IIFE 抽出，P2-5 按屏拆分）
   把模板里写死的时间文案对齐到当前真实时钟，并挂 data-ts 供全局刷新器持续校准。
   ============================================================ */
export function initStaticTimes() {
  /* 群聊时间轴（今天 + 消息时间）：按 DOM 顺序从较早逼近「现在」，
     写入 data-ts（epoch）让全局刷新器持续校准为 刚刚/N分钟前/HH:MM */
  const tEls = [...document.querySelectorAll('.chat-day, .bubble__time')];
  tEls.forEach((el, i) => {
    const ago = Math.max(0, 40 - i * 2);
    const ts = Date.now() - ago * 60000;
    el.dataset.ts = ts;
    if (el.classList.contains('chat-day')) {
      el.dataset.tsPrefix = '今天 ';
      el.textContent = `今天 ${fmtAgo(ts)}`;
    } else {
      el.textContent = fmtAgo(ts);
    }
  });
  /* 思考标注「思考 · HH:MM」：把时间包进带 data-ts 的 <span>，保留前缀 */
  document.querySelectorAll('.bubble__think b').forEach((b, i) => {
    const ts = Date.now() - Math.max(0, 36 - i * 2) * 60000;
    b.innerHTML = b.innerHTML.replace(/(思考 · )\d{2}:\d{2}/, `$1<span data-ts="${ts}">${fmtAgo(ts)}</span>`);
  });
  /* 知识目录入库时间（已是真实时钟，挂 data-ts 以便自动刷新） */
  document.querySelectorAll('.shelf-row .meta .num').forEach((el, i) => {
    const ts = Date.now() - (2 + i * 3) * 60000;
    el.dataset.ts = ts;
    el.textContent = fmtAgo(ts);
  });
  /* 焦点卡「已验收 · 写入知识库 · HH:MM」 */
  document.querySelectorAll('p').forEach(p => {
    if (p.textContent.indexOf('写入知识库') >= 0) {
      const ts = Date.now() - 60000;
      p.innerHTML = p.innerHTML.replace(/(写入知识库 · )\d{2}:\d{2}/, `$1<span data-ts="${ts}">${fmtAgo(ts)}</span>`);
    }
  });
  /* 启动全局真实时间刷新器（幂等，doc-review 弹窗复用同一实例） */
  mountTimeTicker();
}
