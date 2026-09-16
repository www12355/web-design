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

/** 当前真实时间 HH:MM:SS（供每秒刷新的实时读数） */
export function nowHMS() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

/** 今日 MM.DD */
export function todayMMDD() {
  const d = new Date();
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
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

/** 每月每 N 秒（或立即）调用一次的 tick */
export function tick(fn, interval = 1000) {
  fn();
  setInterval(fn, interval);
}
