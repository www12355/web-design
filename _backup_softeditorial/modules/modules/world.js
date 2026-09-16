/* ============================================================
   全自主 AI 经营体 · 世界引擎
   订单流（无人介入）→ 任务池 → 并行生产 → 交付验收 → 结算回款 → 经济账本
   4 套场景模板（日常/大促/全案/冲刺）实时可切；算力·成本随真实负载演化
   leader 选举 + localStorage 快照同步；存储不可用时各窗口独立演化

   所有经营参数 / 初始状态来自 src/data/world.js（纯数据模块）。
   时间戳取自真实系统时钟（src/modules/time.js）。
   ============================================================ */
import {
  DEMAND_POOL, ROLE_BY_NAME, BLOCK_REASONS,
  TEMPLATES, INIT
} from '../data/world.js';
import { hmAgo, dateKey, wallMin } from '../modules/time.js';

const STORE_KEY = 'aic-world-state-v2';
const LEADER_KEY = 'aic-world-leader-v1';
const CMD_KEY = 'aic-world-cmd-v1';
const PRIO = (document.body.dataset.worldPrio | 0) || 1;
const MY_ID = Math.random().toString(36).slice(2, 9);

/* ---------------- 工具 ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
/* 种子取自真实日期（yyyymmdd）：同一天两窗口确定性一致，且随真实日期推进 */
const seed = mulberry32(dateKey());
const rnd = Math.random;
const pick = arr => arr[Math.floor(rnd() * arr.length)];
function fmtMoney(n) {
  if (n >= 10000) { const w = n / 10000; return (w >= 100 ? Math.round(w) : Math.round(w * 10) / 10) + '万'; }
  return Math.round(n).toLocaleString('en-US');
}
const hm = m => { m = Math.floor(m) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const empName = k => (window.AIC && AIC.CAST.find(c => c.key === k) || {}).name || k;
/* 真实时钟：当前「当日分钟数」（0–1439） */
const realMin = () => (wallMin() % 1440);
const dateDay = () => new Date().getDate();

/* ---------------- 初始状态（由数据模块驱动，时间取真实时钟） ---------------- */
function buildState() {
  const tasks = {};
  const orders = {};
  const employees = {};
  const { EARN0, CAST0, EMP_LOG, HERO, ORDERS, DOING, QUEUED, DONE_COUNT, SPARK_END, EVENTS, LEDGER, KB, COUNTERS } = INIT;

  CAST0.forEach(([k, st, task, pct, tid]) => {
    employees[k] = {
      status: st, task, pct, earned: EARN0[k], current: tid,
      log: (EMP_LOG[k] || []).map(l => ({ t: hmAgo(l.ago), s: l.s, txt: l.txt }))
    };
  });

  ORDERS.forEach(o => { orders[o.id] = { id: o.id, client: o.client, demand: o.demand, amount: o.amount, status: o.status, at: hmAgo(o.ago) }; });

  /* 主 AI 合稿任务（无归属员工，驱动首屏主角瓦片） */
  tasks['t-hero'] = { id: 't-hero', title: `发布方案整合稿 v0.${HERO.regen} 合稿`, owner: null, status: 'doing', pct: HERO.pct, value: HERO.value, order: 'o1', regen: HERO.regen };

  DOING.forEach(([id, title, owner, pct, order]) => {
    tasks[id] = { id, title, owner, status: 'doing', pct, value: 3000 + Math.floor(seed() * 9000), order };
  });

  QUEUED.forEach(([id, title, order]) => {
    tasks[id] = { id, title, owner: null, status: 'queued', pct: 0, value: 3000 + Math.floor(seed() * 9000), order };
  });

  /* 已完成（历史产出，确定性生成；完成时刻为「今天稍早」的真实时间点） */
  for (let i = 0; i < DONE_COUNT; i++) {
    const tpl = DEMAND_POOL[Math.floor(seed() * DEMAND_POOL.length)];
    const tt = tpl.tasks[Math.floor(seed() * tpl.tasks.length)];
    const owner = ROLE_BY_NAME[tt[0]];
    const id = 'd' + String(i + 1).padStart(2, '0');
    tasks[id] = {
      id, title: tt[1] + (seed() < 0.35 ? ' · 复审' : ''), owner, status: 'done', pct: 100,
      value: 3000 + Math.floor(seed() * 11000), order: null,
      doneAt: hmAgo(8 + Math.floor(seed() * 170))
    };
  }

  /* 今日营收曲线（由过去采样到当前） */
  const spark = [];
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    spark.push(Math.round(9000 + 23000 * (1 - Math.pow(1 - t, 1.7)) + (seed() - 0.5) * 2400));
  }
  spark[19] = SPARK_END;

  const events = EVENTS.map(e => ({ t: hmAgo(e.ago), text: e.text, kind: e.kind }));

  return {
    v: 2,
    template: 'daily',
    time: { wall: Date.now(), min: realMin(), speed: 1 },
    ledger: { ...LEDGER },
    kb: { ...KB },
    counters: { ...COUNTERS },
    employees, tasks, orders, events, spark
  };
}

/* ---------------- 状态 / 时间 ---------------- */
let state = buildState();
let seq = 0;
let leader = false;
let syncOK = true;
const listeners = new Set();

function nowMin() { return state.time.min + (Date.now() - state.time.wall) / 60000 * state.time.speed; }
function timeHM() { return hm(nowMin()); }

function logEvent(text, kind) {
  state.events.unshift({ t: timeHM(), text, kind: kind || 'info' });
  if (state.events.length > 60) state.events.length = 60;
}
function empLog(k, s, txt) {
  const e = state.employees[k];
  if (!e) return;
  e.log.unshift({ t: timeHM(), s, txt });
  if (e.log.length > 6) e.log.length = 6;
}
const taskDoing = () => Object.values(state.tasks).filter(t => t.status === 'doing');
const taskQueued = () => Object.values(state.tasks).filter(t => t.status === 'queued');
const ordersProducing = () => Object.values(state.orders).filter(o => o.status === 'producing');
const tplOf = () => TEMPLATES[state.template] || TEMPLATES.daily;

/* ---------------- 事件溯源 reducer（两窗口一致演化） ---------------- */
function genTaskId() { return 'k' + Math.floor(rnd() * 1e9).toString(36) + Date.now().toString(36).slice(-4); }

const reducer = {
  progress(e) {
    const t = state.tasks[e.id];
    if (!t || t.status !== 'doing') return;
    t.pct = Math.min(100, Math.round((t.pct + e.d) * 10) / 10);
    const emp = t.owner && state.employees[t.owner];
    if (emp && emp.current === t.id) emp.pct = t.pct;
  },
  taskDone(e) {
    const t = state.tasks[e.id];
    if (!t || t.status === 'done') return;
    t.status = 'done'; t.pct = 100; t.doneAt = timeHM();
    state.counters.done++;
    const emp = t.owner && state.employees[t.owner];
    if (emp) {
      emp.earned += t.value;
      if (emp.current === t.id) { emp.status = 'idle'; emp.pct = 100; }
      empLog(t.owner, 'idle', `交付：${t.title}`);
    }
    const o = t.order && state.orders[t.order];
    logEvent(`交付验收：「${t.title}」${o ? ' · ' + o.client : ''}`, 'done');
    state.kb.total++; state.kb.today++;
    /* 主 AI 合稿：自动开启下一版本，持续滚动生产 */
    if (t.regen) {
      const nv = t.regen + 1;
      state.counters.total++;
      state.tasks['t-hero' + nv] = {
        id: 't-hero' + nv, title: `发布方案整合稿 v0.${nv} 合稿`, owner: null,
        status: 'doing', pct: 6, value: t.value, order: t.order, regen: nv
      };
      logEvent(`主 AI 开启下一版本合稿 v0.${nv}`, 'info');
    }
  },
  claim(e) {
    const t = state.tasks[e.id];
    const emp = state.employees[e.owner];
    if (!t || !emp || t.status === 'done') return;
    t.owner = e.owner; t.status = 'doing';
    emp.current = t.id; emp.task = t.title; emp.pct = t.pct;
    emp.status = 'run';
    empLog(e.owner, 'run', `认领：${t.title}`);
  },
  block(e) {
    const t = state.tasks[e.id];
    if (!t || t.status !== 'doing') return;
    t.status = 'blocked'; t.reason = e.reason || '依赖方响应超时';
    const emp = t.owner && state.employees[t.owner];
    if (emp) { emp.status = 'wait'; empLog(t.owner, 'wait', `阻塞：${t.title}`); }
    logEvent(`阻塞：${t.title} — ${t.reason}`, 'risk');
  },
  unblock(e) {
    const t = state.tasks[e.id];
    if (!t || t.status !== 'blocked') return;
    t.status = 'doing';
    const emp = t.owner && state.employees[t.owner];
    if (emp && emp.current === t.id) { emp.status = 'run'; empLog(t.owner, 'run', `重试成功：${t.title}`); }
    logEvent(`自动重试成功：「${t.title}」恢复执行`, 'done');
  },
  order(e) {
    const tpl = tplOf();
    const dep = Math.round(e.amount * (tpl.deposit || 0));
    state.orders[e.id] = { id: e.id, client: e.client, demand: e.demand, amount: e.amount, status: 'producing', at: timeHM(), deposit: dep };
    state.counters.todayOrders++;
    if (dep > 0) {
      state.ledger.total += dep; state.ledger.today += dep;   // 全案模板：签约即收预付
    }
    (e.tasks || []).forEach(tt => {
      state.tasks[tt.id] = { id: tt.id, title: tt.title, owner: null, status: 'queued', pct: 0, value: tt.value, order: e.id };
      state.counters.total++;
    });
    logEvent(dep > 0
      ? `新订单自动签约：${e.client} · ${e.demand} · ¥${fmtMoney(e.amount)}（预付 30% ¥${fmtMoney(dep)} 已到账）`
      : `新订单自动签约：${e.client} · ${e.demand} · ¥${fmtMoney(e.amount)}`, 'order');
  },
  settle(e) {
    const o = state.orders[e.id];
    if (!o || o.status === 'settled') return;
    o.status = 'settled'; o.settledAt = timeHM();
    const rest = Math.max(0, o.amount - (o.deposit || 0));   // 已收预付的订单只结算尾款
    state.ledger.total += rest; state.ledger.today += rest; state.ledger.settled++;
    state.kb.settledToday++;
    logEvent(o.deposit
      ? `结算尾款到账：${o.client} · ¥${fmtMoney(rest)}（全单 ¥${fmtMoney(o.amount)} 交付完成）`
      : `结算回款：${o.client} · ¥${fmtMoney(o.amount)}`, 'settle');
    state.spark.push(state.ledger.today);
    if (state.spark.length > 26) state.spark.shift();
  },
  dispatch(e) {
    const tt = e.task;
    if (!tt || state.tasks[tt.id]) return;
    const emp = state.employees[tt.owner];
    if (!emp) return;
    if (emp.current && state.tasks[emp.current] && state.tasks[emp.current].status === 'doing') {
      state.tasks[emp.current].status = 'queued';
      logEvent(`任务暂存回池：${state.tasks[emp.current].title}`, 'info');
    }
    state.tasks[tt.id] = { id: tt.id, title: tt.title, owner: tt.owner, status: 'doing', pct: 4, value: tt.value || 8000, order: null, user: true };
    state.counters.total++;
    emp.current = tt.id; emp.task = tt.title; emp.pct = 4; emp.status = 'busy';
    empLog(tt.owner, 'busy', `监管指令：${tt.title}`);
    logEvent(`监管终端派发：${tt.title} → ${empName(tt.owner)}`, 'dispatch');
  },
  rework(e) {
    const t = state.tasks[e.id];
    if (!t || t.status !== 'doing') return;
    t.pct = Math.max(15, Math.round(t.pct - (e.dip || 10)));
    const emp = t.owner && state.employees[t.owner];
    if (emp && emp.current === t.id) emp.pct = t.pct;
    logEvent(`质检返工：「${t.title}」校验未过，回退重做`, 'risk');
    if (emp) empLog(t.owner, 'run', `返工修正：${t.title}`);
  },
  template(e) {
    const tpl = TEMPLATES[e.id];
    if (!tpl || state.template === e.id) return;
    state.template = e.id;
    logEvent(`模拟模板切换 → 「${tpl.name}」：${tpl.desc}`, 'mode');
  },
  note() { /* 巡检台词：仅广播，不入账 */ },
  speed(e) {
    if (state.time.speed === e.v) return;
    state.time.min = nowMin(); state.time.wall = Date.now(); state.time.speed = e.v;
    logEvent(e.v > 1 ? `演示加速：×${e.v}` : '恢复正常流速', 'info');
  }
};

/* ---------------- 事件总线 ---------------- */
function notify(evts) {
  listeners.forEach(fn => { try { fn(evts, state); } catch (err) { console.error('[world] listener', err); } });
}
function applyBatch(evts) {
  if (!evts || !evts.length) return;
  let changed = false;
  evts.forEach(e => { const r = reducer[e.type]; if (r) { r(e); changed = true; } });
  if (changed && leader) { seq++; persist(); }
  notify(evts);
}

/* ---------------- 持久化 / 同步 ---------------- */
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { syncOK = false; return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { syncOK = false; } }

function persist() { if (syncOK) lsSet(STORE_KEY, { seq, time: state.time, state, ts: Date.now() }); }

/* ---------------- 引擎循环（仅 leader 驱动） ---------------- */
let tickTimer = 0, orderTimer = 0, patrolTimer = 0, beatTimer = 0, pollTimer = 0, costTimer = 0, flowTimer = 0;

function pickNextQueued() { const q = taskQueued(); return q.length ? q[0].id : null; }

function tick() {
  const sp = state.time.speed;
  const tpl = tplOf();
  const evts = [];
  taskDoing().forEach(t => {
    if (rnd() < 0.22) return;                       // 有的节拍不动，更像真实生产
    let d = (0.5 + rnd() * 1.9) * sp;
    if (t.user && t.pct < 40) d *= 1.7;             // 监管派发任务前期推进更快
    if (t.pct > 85) d *= 0.45; else if (t.pct > 60) d *= 0.8;  // 尾段减速：越接近交付越谨慎
    evts.push({ type: 'progress', id: t.id, d: +d.toFixed(2) });
    /* 临近完成时按模板返工率触发质检回退 */
    if (t.pct > 72 && tpl.reworkRate > 0 && rnd() < tpl.reworkRate * sp) {
      evts.push({ type: 'rework', id: t.id, dip: 8 + Math.floor(rnd() * 7) });
    }
  });
  if (evts.length) applyBatch(evts);

  /* 完成判定 + 立即认领（同一批次） */
  const doneBatch = [];
  taskDoing().forEach(t => {
    if (t.pct >= 100) {
      doneBatch.push({ type: 'taskDone', id: t.id });
      const nxt = pickNextQueued();
      if (nxt && t.owner) doneBatch.push({ type: 'claim', id: nxt, owner: t.owner });
    }
  });
  if (doneBatch.length) applyBatch(doneBatch);

  /* 偶发阻塞 → 自动恢复（阻塞率随模板变化：大促更高，日常更低） */
  if (rnd() < tpl.blockRate * sp) {
    const doing = taskDoing().filter(t => !t.user);
    if (doing.length) {
      const t = pick(doing);
      applyBatch([{ type: 'block', id: t.id, reason: pick(BLOCK_REASONS) }]);
      const bid = t.id;
      setTimeout(() => { if (leader) applyBatch([{ type: 'unblock', id: bid }]); }, (9000 + rnd() * 12000) / Math.max(1, sp));
    }
  }

  /* 就绪订单 → 标记 settling 并只排程一次自动验收结算（无任务订单视为直接交付） */
  ordersProducing().forEach(o => {
    const mine = Object.values(state.tasks).filter(t => t.order === o.id);
    const ready = mine.length ? mine.every(t => t.status === 'done') : true;
    if (ready) {
      o.status = 'settling';
      setTimeout(() => { if (leader) applyBatch([{ type: 'settle', id: o.id }]); }, 5000 + rnd() * 9000);
    }
  });

  tickTimer = setTimeout(tick, 2600 + rnd() * 2400);
}

let orderGen = 0;
function spawnOrder() {
  const tpl = tplOf();
  const producing = ordersProducing().map(o => o.demand);
  const tplPool = tpl.demands.filter(t => !producing.includes(t.demand));
  const d = pick(tplPool.length ? tplPool : tpl.demands);
  let client = pick(tpl.clients);
  if (Object.values(state.orders).some(o => o.status === 'producing' && o.client === client)) {
    const rest = tpl.clients.filter(c => c !== client);
    if (rest.length) client = pick(rest);
  }
  const id = 'n' + (++orderGen) + '_' + Date.now().toString(36).slice(-4);
  const amount = (tpl.amount[0] + Math.floor(rnd() * (tpl.amount[1] - tpl.amount[0]))) * 1000;
  const n = Math.min(d.tasks.length, tpl.taskCount[0] + Math.floor(rnd() * (tpl.taskCount[1] - tpl.taskCount[0] + 1)));
  const evts = [{
    type: 'order', id, client, demand: d.demand, amount,
    tasks: d.tasks.slice(0, n).map(([roleName, title]) => ({
      id: genTaskId(), title, owner: null, value: 3000 + Math.floor(rnd() * 9000), _role: ROLE_BY_NAME[roleName]
    }))
  }];
  /* 空闲员工自动认领前两项 */
  const idle = Object.keys(state.employees).filter(k => state.employees[k].status === 'idle');
  evts[0].tasks.slice(0, 2).forEach((tt, i) => {
    if (idle[i]) evts.push({ type: 'claim', id: tt.id, owner: idle[i] });
  });
  applyBatch(evts);
}
function scheduleOrder() {
  clearTimeout(orderTimer);
  const tpl = tplOf();
  /* 背压：排队积压超过模板阈值时暂停接单，先消化队列（产能守恒，更像真实经营） */
  const backlog = taskQueued().length;
  const delay = backlog > tpl.backlogLimit
    ? 15000
    : Math.max(9000, (tpl.cadence[0] + rnd() * (tpl.cadence[1] - tpl.cadence[0])) / state.time.speed);
  orderTimer = setTimeout(() => { spawnOrder(); scheduleOrder(); }, delay);
}

/* 算力/内存：由真实负载推导（在产任务数、进度、阻塞），供各页仪表与巡检共用 */
function systemLoad() {
  const doing = taskDoing();
  const blocked = Object.values(state.tasks).filter(t => t.status === 'blocked').length;
  const avgPct = doing.length ? doing.reduce((a, t) => a + t.pct, 0) / doing.length : 0;
  const cpu = Math.min(97, Math.round(24 + doing.length * 6 + blocked * 2.5 + avgPct * 0.05 + rnd() * 3));
  const mem = Math.min(92, Math.round(38 + doing.length * 2.2 + ordersProducing().length * 1.4 + state.kb.today * 0.15 + rnd() * 2));
  return { cpu, mem, doing: doing.length, blocked };
}

function schedulePatrol() {
  clearTimeout(patrolTimer);
  patrolTimer = setTimeout(() => {
    if (leader) {
      const doing = taskDoing().length, queued = taskQueued().length;
      const margin = state.ledger.today > 0 ? (1 - state.ledger.costToday / state.ledger.today) * 100 : 0;
      const L = systemLoad();
      const lines = [
        `巡检：任务池 ${state.counters.total} 项 · 进行 ${doing} · 排队 ${queued}，无死锁。`,
        `巡检：今日营收 ¥${fmtMoney(state.ledger.today)}，净利率 ${margin.toFixed(1)}%。`,
        `巡检：知识库 ${state.kb.total.toLocaleString('en-US')} 条已索引，今日入库 +${state.kb.today}。`,
        `巡检：在产订单 ${ordersProducing().length} 个，交付窗口无风险，现金流为正。`,
        `巡检：算力占用 ${L.cpu}%（进行 ${L.doing} 路 · 阻塞 ${L.blocked}），计费正常，无人值守运行中。`,
        `巡检：当前模板「${tplOf().name}」节律正常，产能匹配接单速率。`
      ];
      applyBatch([{ type: 'note', text: lines[Math.floor(rnd() * lines.length)] }]);
    }
    schedulePatrol();
  }, 11000);
}

/* 算力成本持续计费（每 5s 一跳；随并行负载浮动） */
function scheduleCost() {
  costTimer = setInterval(() => {
    if (!leader) return;
    const load = taskDoing().length;
    const add = (12.5 + load * 3.5) * 5 * state.time.speed;   // (基础 + 负载) ¥/min × 5s
    state.ledger.cost += add; state.ledger.costToday += add;
    notify([{ type: 'cost' }]);                               // 推送各页，账本数字持续流动
  }, 5000);
}

/* 今日营收曲线持续采样：结算跳升之间也保持呼吸 */
function scheduleFlow() {
  flowTimer = setInterval(() => {
    if (!leader) return;
    const v = Math.round(state.ledger.today);
    if (!state.spark.length || state.spark[state.spark.length - 1] !== v) {
      state.spark.push(v);
      if (state.spark.length > 26) state.spark.shift();
    }
    notify([{ type: 'spark' }]);
  }, 30000);
}

/* ---------------- leader 选举与快照 ---------------- */
function claimLeadership() {
  const cur = syncOK ? lsGet(LEADER_KEY) : null;
  const fresh = cur && (Date.now() - cur.ts < 6000);
  if (!fresh || cur.prio < PRIO) {
    leader = true;
    if (syncOK) lsSet(LEADER_KEY, { id: MY_ID, prio: PRIO, ts: Date.now() });
    startEngine();
  }
}
function startEngine() {
  clearTimeout(tickTimer); clearTimeout(orderTimer); clearTimeout(patrolTimer);
  clearInterval(costTimer); clearInterval(flowTimer);
  tick(); scheduleOrder(); schedulePatrol(); scheduleCost(); scheduleFlow();
}
function stopEngine() {
  clearTimeout(tickTimer); clearTimeout(orderTimer); clearTimeout(patrolTimer);
  clearInterval(costTimer); clearInterval(flowTimer);
}
function startSync() {
  beatTimer = setInterval(() => {
    if (!syncOK) return;
    const cur = lsGet(LEADER_KEY);
    if (leader) {
      /* 租约被别人占据（更高优先级接管或新页面）→ 退位，转为跟随者 */
      if (cur && cur.id !== MY_ID && (cur.prio >= PRIO || Date.now() - cur.ts < 6000)) {
        leader = false;
        stopEngine();
        seq = -1;   /* 强制在下一轮轮询采纳新 leader 的快照 */
      }
      if (leader) lsSet(LEADER_KEY, { id: MY_ID, prio: PRIO, ts: Date.now() });
    } else {
      if (!cur || Date.now() - cur.ts > 6000 || cur.prio < PRIO) claimLeadership();
    }
  }, 2000);

  pollTimer = setInterval(() => {
    if (!syncOK) return;
    if (!leader) {
      const snap = lsGet(STORE_KEY);
      if (snap && snap.state && snap.state.v === 2 && snap.seq >= seq) {
        seq = snap.seq;
        const prevSpeed = state.time.speed;
        state = snap.state;
        if (!snap.time) state.time = { wall: Date.now(), min: realMin(), speed: prevSpeed };
        notify([{ type: 'sync' }]);
      }
    }
    const cmd = lsGet(CMD_KEY);
    if (cmd && cmd.by !== MY_ID && Date.now() - (cmd.ts || 0) < 10000) {
      if (leader && cmd.type) {
        if (cmd.type === 'speed') applyBatch([{ type: 'speed', v: cmd.v }]);
        else applyBatch([cmd]);
      }
      try { localStorage.removeItem(CMD_KEY); } catch (e) { /* noop */ }
    }
  }, 1500);
}

/* ---------------- 对外 API ---------------- */
const World = {
  get state() { return state; },
  get speed() { return state.time.speed; },
  get template() { return state.template; },
  get templates() { return TEMPLATES; },
  get isLeader() { return leader; },
  get syncOK() { return syncOK; },
  load: () => systemLoad(),
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  timeHM,
  nowMin: () => nowMin(),
  dayFrac: () => (dateDay() - 1) + nowMin() / 1440,
  fmtMoney,
  setSpeed(v) {
    applyBatch([{ type: 'speed', v }]);
    if (!leader && syncOK) lsSet(CMD_KEY, { type: 'speed', v, by: MY_ID, ts: Date.now() });
  },
  setTemplate(id) {
    applyBatch([{ type: 'template', id }]);
    if (!leader && syncOK) lsSet(CMD_KEY, { type: 'template', id, by: MY_ID, ts: Date.now() });
  },
  dispatch(task) {
    applyBatch([{ type: 'dispatch', task }]);
    if (!leader && syncOK) lsSet(CMD_KEY, { type: 'dispatch', task, by: MY_ID, ts: Date.now() });
  },
  completeTask(id) {
    applyBatch([{ type: 'taskDone', id }]);
    if (!leader && syncOK) lsSet(CMD_KEY, { type: 'taskDone', id, by: MY_ID, ts: Date.now() });
  },
  blockTask(id, reason) {
    applyBatch([{ type: 'block', id, reason }]);
    if (!leader && syncOK) lsSet(CMD_KEY, { type: 'block', id, reason, by: MY_ID, ts: Date.now() });
  },
  unblockTask(id) {
    applyBatch([{ type: 'unblock', id }]);
    if (!leader && syncOK) lsSet(CMD_KEY, { type: 'unblock', id, by: MY_ID, ts: Date.now() });
  },
  applyClaim(id, owner) {
    applyBatch([{ type: 'claim', id, owner }]);
    if (!leader && syncOK) lsSet(CMD_KEY, { type: 'claim', id, owner, by: MY_ID, ts: Date.now() });
  },
  pickNextQueued
};
window.World = World;
export { World };

/* ---------------- 启动：吸收已有快照 → 竞选 leader ---------------- */
(function boot() {
  const snap = syncOK ? lsGet(STORE_KEY) : null;
  if (snap && snap.state && snap.state.v === 2 && snap.ts && Date.now() - snap.ts < 10 * 60 * 1000) {
    state = snap.state; seq = snap.seq || 0;
    if (!state.time || !state.time.wall) state.time = { wall: Date.now(), min: realMin(), speed: 1 };
  }
  claimLeadership();
  startSync();
})();