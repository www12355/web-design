/* ============================================================
 * 真实时钟工具（Real-time clock）
 * 所有时间戳统一取自系统时钟；支持格式化为 HH:MM / HH:MM:SS /
 * MM.DD / 当前年月 / 当月区间，以及「N 分钟前」的相对时间换算。
 * ============================================================ */

const pad = n => String(n).padStart(2, '0');

/** 当前真实时间的分钟数（自当日 0 点起） */
export const wallMin = () => Date.now() / 60000;

/** 将「分钟（可跨日，取模 1440）」格式化为 HH:MM */
export function hmWallMin(m) {
  const mm = Math.floor(m) % 1440;
  return `${pad(Math.floor(mm / 60))}:${pad(mm % 60)}`;
}

/** 当前真实时间 HH:MM */
export function nowHM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** N 分钟前的真实时间 HH:MM */
export function hmAgo(minAgo) {
  return hmWallMin(wallMin() - minAgo);
}

/** 今日日期 key：yyyymmdd（用于确定性随机种子，同一天一致） */
export function dateKey() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** 当月内某一天 MM.DD（day 越界自动收敛到月末） */
export function monthDay(day) {
  const d = new Date();
  const y = d.getFullYear(), m = d.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const dd = Math.max(1, Math.min(last, day));
  return `${pad(m + 1)}.${pad(dd)}`;
}

/** 当前年份（如 2026） */
export function year() {
  return new Date().getFullYear();
}

/** 当前「年-月」（如 2026-09） */
export function yearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** 当月区间 MM.DD – MM.DD（如 09.01 – 09.30） */
export function monthRange() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${pad(m)}.01 – ${pad(m)}.${pad(last)}`;
}

/** 把 epoch ms 格式化为相对/绝对时间文案
 *  <60s    → 「刚刚」
 *  <60min  → 「N分钟前」
 *  更久    → 固定的真实 HH:MM
 *  非法值  → 「刚刚」
 */
export function fmtAgo(ts) {
  const t = Number(ts);
  if (!Number.isFinite(t)) return '刚刚';
  const diff = Date.now() - t;
  if (diff < 0) return nowHM();           // 未来时间直接回退真实点
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  return nowHM();
}

/** 幂等全局时间刷新器：每 interval ms 遍历所有带 data-ts 的元素，
 *  将其 textContent 重算为 fmtAgo(epoch)。多次调用只启动一次定时器。 */
let _tickerStarted = false;
export function mountTimeTicker(interval = 15000) {
  if (_tickerStarted) return;
  _tickerStarted = true;
  const refresh = () => {
    document.querySelectorAll('[data-ts]').forEach(el => {
      const pre = el.dataset.tsPrefix || '';
      el.textContent = pre + fmtAgo(+el.dataset.ts);
    });
  };
  refresh();
  setInterval(refresh, interval);
}
