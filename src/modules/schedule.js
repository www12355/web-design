// ============================================================
// schedule.js · 全任务排期引擎（自包含）
// ------------------------------------------------------------
// 为 screen1「全任务排期」提供贴近真实项目管理的排期数据：
//   · 工作日 / 节假日算术（跳过周末与法定假日，条带按真实日历拉伸）
//   · 任务依赖拓扑（finish-to-start）与 CPM 关键路径
//   · 风险缓冲（float）计算与消耗、资源冲突（同泳道时间重叠）检测
//   · 里程碑节点、跨团队等待段、优先级（P0/P1/P2）
//   · 周期扰动（延期涟漪 / 冲突注入 / 优先级调整 / 消解）并写入变更历史与影响分析
// 引擎仅被 screen1.js 消费渲染，绝不反向写 World；确定性播种保证刷新稳定。
// ============================================================

/* ---------- 确定性 RNG（与 world.js 同思路，但独立实现避免耦合） ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dateKey() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const DAY = 86400000;

/* ---------- 项目窗口（当月 1 号为基准，6 周 = 42 天轴） ---------- */
const BASE = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); })();
const AXIS = 56;                                  // 日历天数（含周末/假日），为扰动预留余量

/* 真实「今日」在轴上的位置（0..AXIS），演示中由虚拟时钟缓慢推进 */
const REAL_TODAY = Math.max(0, Math.min(AXIS - 0.2, (Date.now() - BASE.getTime()) / DAY));

/* 节假日集合（MM-DD）：中秋 + 国庆长假（落在 9 月末~10 月初窗口内，确保可见） */
const HOLIDAYS = new Set([
  '09-25', '09-26', '09-27',          // 中秋调休
  '10-01', '10-02', '10-03', '10-04', '10-05', '10-06', '10-07', '10-08' // 国庆长假
]);
function mdKey(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}
function isNonWorking(date) {
  const wd = date.getDay();                       // 0=周日 6=周六
  if (wd === 0 || wd === 6) return true;
  return HOLIDAYS.has(mdKey(date));
}
/* 从某日起，推进 n 个工作日，返回目标 Date（n=0 同日；跨过周末/假日） */
function addWorkingDays(fromDate, n) {
  const d = new Date(fromDate.getTime());
  let step = n >= 0 ? 1 : -1;
  let remain = Math.abs(n);
  while (remain > 0) {
    d.setDate(d.getDate() + step);
    if (!isNonWorking(d)) remain--;
  }
  return d;
}
function dayOffset(date) { return (date.getTime() - BASE.getTime()) / DAY; }
function offsetToDate(off) { return new Date(BASE.getTime() + off * DAY); }
function fmtMD(off) {
  const dt = offsetToDate(off);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
}

/* ---------- 团队 / 泳道 ---------- */
const TEAMS = ['planner', 'writer', 'analyst', 'designer', 'engineer'];
const LANE_NAME = { planner: '官网', writer: '社媒', analyst: 'EDM', designer: '设计', engineer: '媒介' };

/* ---------- 任务定义（真实「双11 全域营销作战」项目） ----------
   dur: 工作日工期；deps: 前置任务；priority: P0/P1/P2
   lead: 与前置重叠的工作日数（制造并行/资源冲突）；wait: 跨团队交接等待(工作日)
   forceBlocked: 初始即阻塞（外部依赖未就绪）                                    */
const TASK_DEFS = [
  // 官网 / 规划
  { id: 'p1', lane: 'planner',  name: '需求与资源评审',     dur: 3, deps: [],            priority: 'P0' },
  { id: 'p2', lane: 'planner',  name: '全渠道排期与预算',   dur: 2, deps: ['p1'],        priority: 'P1' },
  { id: 'p3', lane: 'planner',  name: '落地页承接方案',     dur: 4, deps: ['p1', 'p2'],  priority: 'P0' },
  { id: 'p4', lane: 'planner',  name: '大促复盘报告',       dur: 3, deps: ['e4'],        priority: 'P1' },

  // 社媒 / 内容
  { id: 'w1', lane: 'writer',   name: '内容选题与日历',     dur: 3, deps: ['p1'],        priority: 'P1' },
  { id: 'w2', lane: 'writer',   name: '主文案与种草稿',     dur: 3, deps: ['w1', 'p3'],  priority: 'P0', wait: 1 },
  { id: 'w3', lane: 'writer',   name: '短视频脚本分镜',     dur: 3, deps: ['w2'],        priority: 'P1' },
  { id: 'w4', lane: 'writer',   name: '发布排期与节奏',     dur: 2, deps: ['w3', 'e3'],  priority: 'P2' },

  // 设计
  { id: 'd1', lane: 'designer', name: '视觉KV与规范',       dur: 4, deps: ['p1'],        priority: 'P0' },
  { id: 'd2', lane: 'designer', name: '主视觉物料延展',     dur: 4, deps: ['d1'],        priority: 'P0', lead: 2 },
  { id: 'd3', lane: 'designer', name: '动效与 H5 互动',     dur: 3, deps: ['d2', 'p3'],  priority: 'P1' },

  // EDM / 数据
  { id: 'a1', lane: 'analyst',  name: '人群分层与洞察',     dur: 3, deps: ['p1'],        priority: 'P1' },
  { id: 'a2', lane: 'analyst',  name: '数据看板搭建',       dur: 4, deps: ['a1', 'p3'],  priority: 'P1', wait: 2, forceBlocked: true },
  { id: 'a3', lane: 'analyst',  name: '邮件/私域模板',      dur: 3, deps: ['w2', 'a2'],  priority: 'P1' },
  { id: 'a4', lane: 'analyst',  name: 'AB测试与优化',       dur: 3, deps: ['a3'],        priority: 'P2' },

  // 媒介 / 工程
  { id: 'e1', lane: 'engineer', name: '投放计划与采买',     dur: 3, deps: ['p2'],        priority: 'P0' },
  { id: 'e2', lane: 'engineer', name: '监测与归因搭建',     dur: 4, deps: ['a2'],        priority: 'P1', wait: 1 },
  { id: 'e3', lane: 'engineer', name: '落地页前端工程',     dur: 4, deps: ['p3'],        priority: 'P0' },
  { id: 'e4', lane: 'engineer', name: '大促复盘与归因',     dur: 3, deps: ['e2', 'w4', 'a4', 'd3'], priority: 'P1' }
];

/* 里程碑：零工期，挂在驱动任务的末端 */
const MILESTONE_DEFS = [
  { id: 'm1', name: '方案定稿',   deps: ['p1'] },
  { id: 'm2', name: '物料齐备',   deps: ['d2'] },
  { id: 'm3', name: '官网发布',   deps: ['p3', 'e3'] },
  { id: 'm4', name: '大促复盘',   deps: ['e4'] }
];

/* ---------- 拓扑排序（Kahn） ---------- */
function topoOrder(ids, depsOf) {
  const indeg = new Map(ids.map(id => [id, depsOf(id).length]));
  const q = ids.filter(id => indeg.get(id) === 0);
  const out = [];
  while (q.length) {
    const id = q.shift();
    out.push(id);
    ids.forEach(s => { if (depsOf(s).includes(id)) { indeg.set(s, indeg.get(s) - 1); if (indeg.get(s) === 0) q.push(s); } });
  }
  return out;
}

/* ---------- 排期计算（CPM，工作日坐标 → 日历坐标） ---------- */
function computeSchedule(slipMap, rushTasks, priMap) {
  const allDefs = TASK_DEFS.concat(rushTasks || []);
  const defById = new Map(allDefs.map(t => [t.id, t]));
  const milestoneById = new Map(MILESTONE_DEFS.map(m => [m.id, m]));
  const allIds = allDefs.map(t => t.id).concat(MILESTONE_DEFS.map(m => m.id));

  const wdStart = {}, wdEnd = {}, durEff = {};
  const depsOf = id => {
    if (defById.has(id)) return defById.get(id).deps || [];
    return milestoneById.get(id).deps || [];
  };
  const order = topoOrder(allIds, depsOf);

  // 正向：最早开始/结束（工作日）
  for (const id of order) {
    const def = defById.get(id), ms = milestoneById.get(id);
    if (def) {
      const extra = slipMap[id] || 0;
      durEff[id] = def.dur + extra;
      let s = 0;
      (def.deps || []).forEach(d => {
        const depEnd = wdEnd[d];
        let cand = depEnd;
        if (def.lead) cand = depEnd - def.lead;        // 与前置重叠（并行）
        if (def.wait) cand = addWdFromWd(depEnd, def.wait); // 跨团队交接等待
        if (cand > s) s = cand;
      });
      wdStart[id] = Math.max(0, s);
      wdEnd[id] = wdStart[id] + durEff[id];
    } else {
      // 里程碑：0 工期，挂在最晚前置末端
      durEff[id] = 0;
      let s = 0;
      (ms.deps || []).forEach(d => { if (wdEnd[d] > s) s = wdEnd[d]; });
      wdStart[id] = s; wdEnd[id] = s;
    }
  }
  const projectEnd = Math.max(...allIds.map(id => wdEnd[id]));

  // 反向：最晚开始/结束 → float
  const wdLS = {}, wdLF = {}, floatWd = {};
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const succs = allIds.filter(s => depsOf(s).includes(id));
    let lf = projectEnd;
    if (succs.length) {
      lf = Math.min(...succs.map(s => {
        const sd = defById.get(s);
        let lag = 0;
        if (sd && sd.lead) lag = -sd.lead;
        if (sd && sd.wait) lag = sd.wait;
        return wdLS[s] - lag;
      }));
    }
    wdLF[id] = lf;
    wdLS[id] = lf - durEff[id];
    floatWd[id] = wdLS[id] - wdStart[id];
  }

  // 映射为日历坐标 + 派生状态
  const nodes = {};
  allIds.forEach(id => {
    const sDate = addWorkingDays(BASE, Math.round(wdStart[id]));
    const eDate = addWorkingDays(BASE, Math.round(wdEnd[id]));
    const def = defById.get(id), ms = milestoneById.get(id);
    nodes[id] = {
      id,
      isMilestone: !!ms,
      lane: def ? def.lane : null,
      name: (def && def.name) || (ms && ms.name),
      deps: depsOf(id),
      priority: def ? ((priMap && priMap[id]) || def.priority) : null,
      startD: dayOffset(sDate),
      endD: def ? dayOffset(eDate) : dayOffset(eDate), // 里程碑 start=end
      wdStart: wdStart[id], wdEnd: wdEnd[id],
      floatWd: floatWd[id],
      durWd: def ? def.dur : 0,
      slipWd: slipMap[id] || 0,
      lead: def ? def.lead || 0 : 0,
      wait: def ? def.wait || 0 : 0,
      forceBlocked: def ? !!def.forceBlocked : false,
      rush: def ? !!def.rush : false
    };
  });

  // 关键路径节点 / 边
  allIds.forEach(id => { nodes[id].crit = nodes[id].floatWd <= 0.5; });
  allIds.forEach(id => {
    nodes[id].critEdgeFrom = nodes[id].deps.filter(d => nodes[d].crit && nodes[id].crit &&
      Math.abs((nodes[id].wdStart - nodes[d].wdEnd) - (nodes[id].lead ? -nodes[id].lead : (nodes[id].wait || 0))) < 0.5);
  });

  return { nodes, projectEnd, order, defById };
}

/* 工作日在序号空间的推进（用于 lag 计算，避免 Date 往返误差） */
function addWdFromWd(fromWd, n) {
  // 近似：每个工作日 ≈ 1 序号单位；lead 为负、wait 为正
  return fromWd + n;
}

/* ---------- 引擎主体 ---------- */
class ScheduleEngine {
  constructor() {
    this.today = REAL_TODAY;
    this.slipMap = {};
    this.priMap = {};        // 优先级动态调整的持久覆盖（recompute 会重建节点，必须外置保存）
    this.rushSeq = 0;
    this.rushTasks = [];
    this.history = [];
    this.histVersion = 0;    // 历史版本号：面板据此增量刷新（长度会因 30 条上限而不变）
    this._listeners = new Set();
    this._timer = null;
    /* 单一持久随机流：若每次 tick 重新播种，相邻种子（dateKey ^ 递增常量）会产生
       高度相关的序列，导致某类扰动长期不被抽中。此处在构造时按日期播种一次即可，
       既保证「同一天刷新结果稳定」，又保证序列分布均匀。 */
    this._rnd = mulberry32((dateKey() * 2654435761) >>> 0);
    this.recompute();
  }

  onChange(cb) { this._listeners.add(cb); return () => this._listeners.delete(cb); }
  _emit() { this._listeners.forEach(cb => { try { cb(this); } catch (e) { /* 渲染容错 */ } }); }

  recompute() {
    const r = computeSchedule(this.slipMap, this.rushTasks, this.priMap);
    this.nodes = r.nodes;
    this.projectEnd = r.projectEnd;
    if (!this._baseline) {
      this._baseline = Object.fromEntries(Object.entries(this.nodes).map(([k, v]) => [k, { wdEnd: v.wdEnd, endD: v.endD }]));
    }
    this._detectConflicts();
    this._deriveStatus();
  }

  _detectConflicts() {
    // 同泳道时间重叠 → 资源冲突
    TEAMS.forEach(lane => {
      const ts = Object.values(this.nodes).filter(n => n.lane === lane && !n.isMilestone);
      ts.forEach(n => { n.conflict = false; });
      for (let i = 0; i < ts.length; i++) {
        for (let j = i + 1; j < ts.length; j++) {
          const a = ts[i], b = ts[j];
          if (a.startD < b.endD - 0.01 && b.startD < a.endD - 0.01) {
            a.conflict = true; b.conflict = true;
          }
        }
      }
    });
  }

  _deriveStatus() {
    Object.values(this.nodes).forEach(n => {
      if (n.isMilestone) {
        n.status = n.endD <= this.today ? 'done' : 'queued';
        n.pct = n.status === 'done' ? 100 : 0;
        n.bufferWd = 0; n.bufferLeft = 0; n.bufferUsed = 0;   // 里程碑零工期，无浮动可耗
        return;
      }
      /* 授权标记：范围/口径类的高优先级条目被卡住时读作「等待授权」，
         其余读作技术性阻塞。两者在条带上有不同的边与填充（见 screen1.css .is-auth）。 */
      n.needsAuth = false;
      if (n.forceBlocked && n.startD <= this.today && n.endD > this.today) {
        n.status = 'blocked';
        n.needsAuth = n.pri === 'P0';
        n.pct = Math.max(8, Math.min(92, (this.today - n.startD) / Math.max(0.5, (n.endD - n.startD)) * 100));
      } else if (n.endD <= this.today) {
        n.status = 'done'; n.pct = 100;
      } else if (n.startD >= this.today) {
        n.status = 'queued'; n.pct = 0;
      } else {
        n.status = 'doing';
        n.pct = Math.max(2, Math.min(98, (this.today - n.startD) / Math.max(0.5, (n.endD - n.startD)) * 100));
      }
      // 风险缓冲：基线末端 - 当前末端
      const baseEnd = this._baseline[n.id] ? this._baseline[n.id].endD : n.endD;
      n.bufferWd = Math.max(0, Math.round(n.floatWd));
      n.bufferLeft = Math.round(n.floatWd);                 // 剩余浮动（可负 = 已超缓冲）
      n.bufferUsed = Math.max(0, Math.round((n.endD - baseEnd) * 0.6)); // 被下游/自身 slip 吃掉的天数
    });
  }

  summary() {
    const tasks = Object.values(this.nodes).filter(n => !n.isMilestone);
    const deps = tasks.reduce((s, t) => s + t.deps.length, 0);
    const milestones = Object.values(this.nodes).filter(n => n.isMilestone).length;
    const conflicts = tasks.filter(t => t.conflict).length;
    return {
      tasks: tasks.length,
      deps, milestones, conflicts,
      critLen: Math.round(this.projectEnd),
      today: this.today
    };
  }

  /* 受某次扰动影响的下游闭包 */
  _downstream(id) {
    const out = new Set();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      Object.values(this.nodes).forEach(n => {
        if (n.deps.includes(cur) && !out.has(n.id)) { out.add(n.id); stack.push(n.id); }
      });
    }
    return out;
  }

  /* ---------- 扰动注入（每次返回变更记录，并写入历史） ---------- */
  _log(entry) {
    entry.t = this._clock();
    this.history.unshift(entry);
    if (this.history.length > 30) this.history.length = 30;
    this.histVersion++;
  }
  _clock() {
    const dt = offsetToDate(this.today);
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /* 最晚日历末端（用于「窗口余量」判断） */
  _maxEnd() {
    let m = 0;
    Object.values(this.nodes).forEach(n => { if (n.endD > m) m = n.endD; });
    return m;
  }
  /* 窗口余量不足时不再注入新的延期，否则项目会冲出时间轴、条带被裁到边界失真 */
  _roomLeft() { return AXIS - this._maxEnd(); }

  /* 1) 任务延期 → 涟漪下游；记录关键路径与里程碑触险 */
  perturbSlip() {
    if (this._roomLeft() < 5) return null;          // 余量不足，转为等恢复/赶工
    const before = this.projectEnd;
    const cands = Object.values(this.nodes).filter(n => !n.isMilestone && (n.status === 'doing' || n.status === 'queued') && !n.rush);
    if (!cands.length) return null;
    const t = cands[Math.floor(this._rnd() * cands.length)];
    const slip = 1 + Math.floor(this._rnd() * 2);   // 延期 1–2 工作日
    this.slipMap[t.id] = (this.slipMap[t.id] || 0) + slip;
    const affectedSet = this._downstream(t.id);
    this.recompute();
    const milestoneAtRisk = Object.values(this.nodes).some(n => n.isMilestone && affectedSet.has(n.id) && n.endD > this.today);
    this._log({
      kind: 'slip', text: `「${t.name}」延期 ${slip} 个工作日`,
      taskId: t.id, affects: [t.id, ...affectedSet], milestoneAtRisk,
      critBefore: Math.round(before), critAfter: Math.round(this.projectEnd), slip
    });
    return this.history[0];
  }

  /* 2) 资源冲突：注入一条高优临时任务，与某泳道在途任务重叠 */
  perturbConflict() {
    if (this.rushTasks.length >= 2) return null;   // 最多并存 2 条加塞任务，避免泳道被塞爆
    if (this._roomLeft() < 3) return null;
    const lanes = TEAMS.slice();
    const lane = lanes[Math.floor(this._rnd() * lanes.length)];
    const host = Object.values(this.nodes).find(n => n.lane === lane && !n.isMilestone && n.status === 'doing' && !n.rush);
    if (!host) return null;
    const id = 'rush-' + (++this.rushSeq);
    const name = host.lane === 'designer' ? '临时主视觉替换' : host.lane === 'engineer' ? '加急投放追投' : '临时加更内容';
    this.rushTasks.push({ id, lane, name, dur: 2, deps: [host.id], priority: 'P0', rush: true, lead: 1 });
    const before = Math.round(this.projectEnd);
    this.recompute();
    this._log({
      kind: 'conflict', text: `「${LANE_NAME[lane]}」资源冲突：${name}`,
      taskId: id, affects: [host.id, id], milestoneAtRisk: false,
      critBefore: before, critAfter: Math.round(this.projectEnd), slip: 0
    });
    return this.history[0];
  }

  /* 3) 优先级动态调整：P2 先升 P1、再升 P0，逐级上报而非一步到位。
   *    P0 过多（>=7）时改为回调 —— 现实中不可能所有事都是最高优先级。 */
  perturbPriority() {
    const live = Object.values(this.nodes).filter(n => !n.isMilestone && n.rush !== true && (n.status === 'queued' || n.status === 'doing'));
    const before = Math.round(this.projectEnd);

    if (live.filter(n => n.priority === 'P0').length >= 5) {
      const demote = live.filter(n => this.priMap[n.id] === 'P0');
      if (demote.length) {
        const d = demote[Math.floor(this._rnd() * demote.length)];
        delete this.priMap[d.id];                   // 回到任务定义里的原始优先级
        this.recompute();
        const back = this.nodes[d.id].priority;
        this._log({
          kind: 'priority', text: `「${d.name}」优先级回调 P0 → ${back}（资源释放）`,
          taskId: d.id, affects: [d.id], milestoneAtRisk: false,
          critBefore: before, critAfter: Math.round(this.projectEnd), slip: 0
        });
        return this.history[0];
      }
    }

    const pool = live.filter(n => n.priority === 'P2');
    const fallback = live.filter(n => n.priority === 'P1');
    const use = pool.length ? pool : fallback;
    if (!use.length) return null;
    const t = use[Math.floor(this._rnd() * use.length)];
    const next = t.priority === 'P2' ? 'P1' : 'P0';
    this.priMap[t.id] = next;                       // 持久覆盖，recompute 后依然生效
    this.recompute();
    this._log({
      kind: 'priority', text: `「${t.name}」优先级上调 ${t.priority} → ${next}（资源倾斜）`,
      taskId: t.id, affects: [t.id], milestoneAtRisk: false,
      critBefore: before, critAfter: Math.round(this.projectEnd), slip: 0
    });
    return this.history[0];
  }

  /* 4) 消解：优先归并加塞任务；无加塞时改走「赶工追回」，把吃掉的进度抢回来 */
  perturbResolve() {
    const before = Math.round(this.projectEnd);
    if (this.rushTasks.length) {
      const rt = this.rushTasks.shift();
      this.recompute();
      this._log({
        kind: 'resolve', text: `资源冲突消解：「${rt.name}」已归并回主计划`,
        taskId: rt.id, affects: [rt.id], milestoneAtRisk: false,
        critBefore: before, critAfter: Math.round(this.projectEnd), slip: 0
      });
      return this.history[0];
    }
    const delayed = Object.keys(this.slipMap).filter(id => this.slipMap[id] > 0 && this.nodes[id]);
    if (!delayed.length) return null;
    const id = delayed[Math.floor(this._rnd() * delayed.length)];
    const name = this.nodes[id].name;
    const back = Math.min(this.slipMap[id], 1 + Math.floor(this._rnd() * 2));
    this.slipMap[id] -= back;
    if (this.slipMap[id] <= 0) delete this.slipMap[id];
    this.recompute();
    this._log({
      kind: 'resolve', text: `「${name}」赶工追回 ${back} 个工作日`,
      taskId: id, affects: [id, ...this._downstream(id)], milestoneAtRisk: false,
      critBefore: before, critAfter: Math.round(this.projectEnd), slip: 0
    });
    return this.history[0];
  }

  /* 周期 tick：推进虚拟今日（让在途条带随时间填充），并按序列注入扰动。
   * 尾部 40% 概率不注入任何扰动 —— 真实排期也有「什么都没发生」的平静期，
   * 同时留给条带平滑填充与依赖箭头重绘的时间。 */
  tick() {
    this.today = Math.min(AXIS - 0.2, this.today + 0.16);
    const roll = this._rnd();
    let entry = null;
    if (roll < 0.28) entry = this.perturbSlip();
    else if (roll < 0.42) entry = this.perturbConflict();
    else if (roll < 0.58) entry = this.perturbPriority();
    else entry = this.perturbResolve();
    this.recompute();
    this._emit();
    return entry;
  }

  start(intervalMs) {
    if (this._timer) return;
    this._timer = setInterval(() => this.tick(), intervalMs || 14000);
  }
  stop() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }

  /* 影响分析：某次变更波及的任务 + 里程碑触险 + 关键路径变化。
   * 里程碑「触险」只在工期被推迟（slip）时才成立 —— 优先级调整 / 冲突归并
   * 不会改变任务末端，把它们也算成触险是语义失真。 */
  getImpact(entry) {
    if (!entry) return null;
    const affected = (entry.affects || []).map(id => this.nodes[id]).filter(Boolean);
    const downstream = entry.affects.map(id => [...this._downstream(id)]).flat();
    const milestoneAtRisk = entry.kind === 'slip'
      ? Object.values(this.nodes).filter(n => n.isMilestone && downstream.includes(n.id) && n.endD > this.today)
      : [];
    return {
      entry,
      affectedTasks: affected,
      downstream: [...new Set(downstream)],
      milestonesAtRisk: milestoneAtRisk,
      critBefore: entry.critBefore, critAfter: entry.critAfter
    };
  }
}

export const Schedule = new ScheduleEngine();
export { fmtMD, LANE_NAME, TEAMS, AXIS, addWorkingDays, isNonWorking, BASE, DAY, HOLIDAYS };
