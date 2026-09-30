// ============================================================
// employee.html 控制器：员工展示卡（P3-2 双模式）
// 模式一 · 独立页（?emp=<uid>）：注册表成员的稳定唯一 URL ——
//          固定展示该员工，上一张/下一张真实跳转相邻员工 URL；
// 模式二 · 轮播（无参数）：3 套模板 × 3-6 名随机名单（本地缓存，各屏独立随机），
//          1 拍 3s：每 2 拍小轮步进一位；4 次小轮大轮 World.setStaffTemplate
//          切换模板 —— 第一/二/四屏同拍变换（staffTemplate 事件驱动）。
// 展示：思考过程（thoughtFor 实时推演 + 员工日志时间线）
//       + 技能八角雷达（4 技能 + 4 实时轴，World 真实数据派生）。
// ============================================================
import { AIC } from '../modules/common.js';
import { World } from '../modules/world.js';
import { initNav, empParam } from '../modules/nav.js';
import {
  getRegistry, getMember, buildRoster, staffIdFor, liveAxesFor, orderByRuntime, STAFF_TEMPLATES
} from '../data/staffRoster.js';
import { thoughtFor } from './window2/sections/badges.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const statusText = AIC.statusText || (s => s);
const kindOf = s => (s === 'run' || s === 'busy') ? 'running' : (s === 'wait' ? 'warning' : 'neutral');
const avatarState = s => s === 'wait' ? 'alert' : (s === 'busy' ? 'thinking' : 'idle');
const avatarExpr = (m, s) => s === 'wait' ? 'mefiant' : (s === 'busy' ? 'attentif' : m.expr);
const RING_C = 2 * Math.PI * 74;

const FIXED_UID = empParam() && getMember(empParam()) ? empParam() : null;   /* 独立页模式：?emp=<uid> 命中注册表 */
const REGISTRY = getRegistry();               /* 12 名注册表（开机一次算齐，同日各窗一致） */

/* ---- 定时器登记 + 头像句柄清理（pagehide 契约） ---- */
const intervals = new Set();
const every = (fn, ms) => { const id = setInterval(fn, ms); intervals.add(id); return id; };
let orbHandle = null;
window.addEventListener('pagehide', () => {
  intervals.forEach(id => clearInterval(id)); intervals.clear();
  if (orbHandle) { try { orbHandle.stop(); } catch (e) { /* 引擎已停 */ } }
});

/* ---- 轮播模式状态 ---- */
const tplInit = Math.max(0, STAFF_TEMPLATES.findIndex(t => t.id === World.staffTemplate));
let tplIdx = tplInit;
const rosterCache = {};
function rosterFor(i) {
  const id = STAFF_TEMPLATES[i].id;
  if (!rosterCache[id]) rosterCache[id] = buildRoster(id);
  return rosterCache[id];
}
let roster = null;
let idx = 0;
let beat = 0;
let smallSteps = 0;
/* 遍历顺序：运行中靠前（run→busy→idle→wait→档案垫底），同级随机抖动 ——
   每次大轮 / World 刷新都重算，员工位置不固定 */
let walkOrder = [];

const el = {
  card: document.getElementById('emp-card'),
  ring: document.getElementById('emp-ring-fg'),
  orb: document.getElementById('emp-orb'),
  id: document.getElementById('emp-id'),
  sig: document.getElementById('emp-sig'),
  name: document.getElementById('emp-name'),
  role: document.getElementById('emp-role'),
  dot: document.getElementById('emp-dot'),
  ic: document.getElementById('emp-ic'),
  statusTxt: document.getElementById('emp-status-txt'),
  kb: document.getElementById('emp-kb'),
  task: document.getElementById('emp-task'),
  track: document.getElementById('emp-track'),
  pct: document.getElementById('emp-pct'),
  skills: document.getElementById('emp-skills'),
  radar: document.getElementById('emp-radar'),
  think: document.getElementById('emp-think'),
  log: document.getElementById('emp-log'),
  count: document.getElementById('emp-count'),
  dots: document.getElementById('emp-dots'),
  prev: document.getElementById('emp-prev'),
  next: document.getElementById('emp-next'),
  link: document.getElementById('emp-link'),
  hint: document.getElementById('emp-hint')
};

/* 当前展示的成员对象 */
function currentMember() {
  if (FIXED_UID) return getMember(FIXED_UID);
  return walkOrder.length ? walkOrder[idx] : (roster && roster.members[idx]) || null;
}

/* 近 12 小时入库数：与第一屏轮播同口径（doneAt 按小时分箱），只用 World 真实任务 */
function done12h(uid) {
  const nowH = Math.floor(World.nowMin() / 60);
  let n = 0;
  Object.values(World.state.tasks).forEach(t => {
    if (t.owner !== uid || t.status !== 'done' || !t.doneAt) return;
    const h = Number(String(t.doneAt).split(':')[0]);
    if (!Number.isFinite(h)) return;
    if ((nowH - h + 24) % 24 <= 11) n++;
  });
  return n;
}

/* ---------------- 八角雷达：网格一次绘制，数据多边形随刷 ---------------- */
let radarPoly = null;
function radarPoints(values) {
  const cx = 120, cy = 96, r = 74;
  return values.map((v, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 4;
    const rr = r * Math.max(0, Math.min(100, v)) / 100;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}
function buildRadar(labels) {
  const cx = 120, cy = 96, r = 74;
  const pt = (i, rr) => {
    const a = -Math.PI / 2 + i * Math.PI / 4;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  };
  const ring = lv => `<polygon points="${labels.map((_, i) => pt(i, r * lv)).join(' ')}" class="radar-grid"/>`;
  const axes = labels.map((_, i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, r).split(',')[0]}" y2="${pt(i, r).split(',')[1]}" class="radar-axis"/>`).join('');
  const texts = labels.map((l, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 4;
    const x = cx + (r + 16) * Math.cos(a);
    const y = cy + (r + 16) * Math.sin(a) + 3;
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" class="radar-label">${l}</text>`;
  }).join('');
  el.radar.innerHTML = ring(1) + ring(0.66) + ring(0.33) + axes +
    `<polygon points="" class="radar-poly"/>` + texts;
  radarPoly = el.radar.querySelector('.radar-poly');
}
function updateRadar(values) {
  if (radarPoly) radarPoly.setAttribute('points', radarPoints(values));
}

/* ---------------- 成员渲染（两模式共用） ---------------- */
let renderedUid = null;
function render() {
  const m = currentMember();
  if (!m) return;
  const live = !m.virtual && !!(World.state.employees[m.uid]);
  const emp = live ? World.state.employees[m.uid] : {};
  const status = live ? (emp.status || 'idle') : 'idle';
  const pct = live ? Math.round(emp.pct || 0) : 0;

  el.card.dataset.emp = m.uid;
  el.card.style.setProperty('--agc', m.ink);
  el.id.textContent = staffIdFor(m.uid);
  el.sig.style.background = m.ink;
  el.name.textContent = m.name;
  el.role.textContent = m.role;
  el.dot.className = 'dot dot--' + status;
  el.ic.innerHTML = AIC.stateIcon(kindOf(status));
  el.statusTxt.textContent = live ? statusText(status) : '档案 · 待接入';
  el.kb.textContent = live ? `知识库 +${done12h(m.uid)}` : '知识库 —';
  el.task.textContent = live ? (emp.task || `${m.name} · 待接入`) : '档案 · 待接入';
  el.track.style.width = pct + '%';
  el.pct.textContent = pct + '%';
  el.ring.style.strokeDashoffset = (RING_C * (1 - pct / 100)).toFixed(1);

  /* 技能 4 条（八角雷达的技能轴同源） */
  const skills = (m.skills || []).slice(0, 4);
  while (skills.length < 4) skills.push(['—', 0]);
  el.skills.innerHTML = skills.map(([name, v]) =>
    `<span class="emp-skill"><b>${name}</b><span class="track"><i style="width:${v}%"></i></span><small>${v}</small></span>`).join('');

  /* 思考过程：实时推演 + 日志时间线（真实员工取 World 日志，档案员工给既定思考） */
  el.think.textContent = live ? thoughtFor(m, emp) : m.think0;
  const log = live ? ((emp.log || []).slice(0, 3)) : [];
  el.log.innerHTML = log.length
    ? log.map(l => `<li><i class="dot dot--${l.s}"></i><b class="num">${l.t}</b><span>${l.txt}</span></li>`).join('')
    : '<li class="is-empty">档案 · 暂无运行日志</li>';

  /* 八角雷达：4 技能 + 4 实时轴 */
  const labels = [...skills.map(([n]) => n), ...liveAxesFor(m.uid, World.state.employees, World.state.counters, done12h(m.uid)).map(a => a.name)];
  const values = [...skills.map(([, v]) => v), ...liveAxesFor(m.uid, World.state.employees, World.state.counters, done12h(m.uid)).map(a => a.value)];
  if (!radarPoly || renderedUid !== m.uid) buildRadar(labels);
  updateRadar(values);

  el.card.setAttribute('aria-label', `${staffIdFor(m.uid)} ${m.name} · ${el.statusTxt.textContent} · ${el.task.textContent}`);
  renderedUid = m.uid;
}

/* ---------------- 头像球（成员切换才重挂，World 刷新只改状态） ---------------- */
function mountOrb() {
  const m = currentMember();
  if (!m || !window.Bloub || !Bloub.mount) return;
  if (orbHandle) { try { orbHandle.stop(); } catch (e) { /* 引擎已停 */ } orbHandle = null; }
  const live = !m.virtual && !!(World.state.employees[m.uid]);
  const status = live ? (World.state.employees[m.uid].status || 'idle') : 'idle';
  orbHandle = Bloub.mount(el.orb, {
    size: 160, shape: m.shape, ink: m.ink, expression: m.expr,
    state: avatarState(status), paper: '#101012',
    cycle: [
      { state: 'idle', duration: 2.6, expression: m.expr },
      { state: 'thinking', duration: 2.9, expression: avatarExpr(m, 'busy') }
    ],
    speed: 0.92
  });
}

/* ---------------- 卡片模板变体（跟随 World.staffTemplate，三屏同拍） ---------------- */
function applyTemplate(tplId) {
  const tpl = STAFF_TEMPLATES.find(t => t.id === tplId) || STAFF_TEMPLATES[0];
  el.card.className = `emp-card emp-card--${tpl.layout}`;
  el.card.style.setProperty('--agc', (currentMember() || {}).ink || '');
}
function currentTplId() { return STAFF_TEMPLATES[tplIdx].id; }

/* ---------------- 模式二 · 轮播调度（2 拍小轮 / 4 小轮大轮） ---------------- */
function tick() {
  if (document.hidden || !roster) return;
  beat++;
  if (beat % 2 === 0) {
    idx = (idx + 1) % roster.members.length;
    render(); mountOrb(); syncFooter();
    smallSteps++;
    if (smallSteps >= 4) { smallSteps = 0; rotateTemplate(); }
  }
}
function rotateTemplate() {
  tplIdx = (tplIdx + 1) % STAFF_TEMPLATES.length;
  World.setStaffTemplate(currentTplId());
  roster = rosterFor(tplIdx);
  idx = 0;
  render(); mountOrb(); syncFooter();
}
function syncFooter() {
  const m = currentMember();
  const pool = walkOrder;
  const pos = Math.max(0, pool.indexOf(m));
  el.count.textContent = `${pos + 1} / ${pool.length}`;
  [...el.dots.children].forEach((d, i) => {
    d.classList.toggle('is-on', i === pos);
    d.setAttribute('aria-selected', i === pos ? 'true' : 'false');
  });
  if (m) el.link.href = `employee.html?emp=${m.uid}`;
  if (FIXED_UID) el.link.hidden = true;   /* 独立页模式：本页即独立页 */
}

/* ---------------- 初始化 ---------------- */
initNav('employee');

if (FIXED_UID) {
  /* 独立页模式：注册表全员可遍历（运行中靠前），prev/next 真实跳转相邻员工 URL */
  const rebuildOrder = () => { walkOrder = orderByRuntime(REGISTRY, World.state.employees); };
  rebuildOrder();
  el.dots.innerHTML = walkOrder.map(m =>
    `<button type="button" class="emp-dot" role="tab" aria-label="${m.name}" title="${staffIdFor(m.uid)} ${m.name}"></button>`).join('');
  [...el.dots.children].forEach((d, i) => d.addEventListener('click', () => {
    location.href = `employee.html?emp=${walkOrder[i].uid}`;
  }));
  const jump = delta => {
    rebuildOrder();   /* 状态已变 → 运行中靠前重排 */
    const m = getMember(FIXED_UID);
    const pos = Math.max(0, walkOrder.indexOf(m));
    const t = walkOrder[((pos + delta) % walkOrder.length + walkOrder.length) % walkOrder.length];
    location.href = `employee.html?emp=${t.uid}`;
  };
  el.prev.addEventListener('click', () => jump(-1));
  el.next.addEventListener('click', () => jump(1));
  el.card.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); jump(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); jump(1); }
  });
  el.hint.textContent = '← → 跳转相邻员工独立页（运行中靠前） · 本页为该员工的稳定唯一 URL · 可直接分享';
} else {
  /* 轮播模式：名单内步进（页内切换，不跳转），顺序运行中靠前且随刷新重排 */
  roster = rosterFor(tplIdx);
  const rebuildOrder = () => { walkOrder = orderByRuntime(roster.members, World.state.employees); };
  rebuildOrder();
  el.dots.innerHTML = walkOrder.map(m =>
    `<button type="button" class="emp-dot" role="tab" aria-label="${m.name}" title="${staffIdFor(m.uid)} ${m.name}"></button>`).join('');
  [...el.dots.children].forEach((d, i) => d.addEventListener('click', () => {
    idx = i; render(); mountOrb(); syncFooter();
  }));
  const step = d => {
    idx = ((idx + d) % walkOrder.length + walkOrder.length) % walkOrder.length;
    render(); mountOrb(); syncFooter();
  };
  el.prev.addEventListener('click', () => step(-1));
  el.next.addEventListener('click', () => step(1));
  el.card.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  el.hint.textContent = `轮播中 · 每 ${2 * 3}s 步进一位（运行中靠前）· 每 4 位换模板（第一/二/四屏同拍变换）· 点「独立页 →」查看该员工唯一 URL`;
  every(tick, 3000);
}

applyTemplate(World.staffTemplate);
render();
mountOrb();
syncFooter();

World.on(evts => {
  const tplEvt = evts.find(e => e.type === 'staffTemplate');
  if (tplEvt) {
    applyTemplate(tplEvt.id);
    if (!FIXED_UID) {
      const next = STAFF_TEMPLATES.findIndex(t => t.id === tplEvt.id);
      if (next >= 0 && next !== tplIdx) { tplIdx = next; roster = rosterFor(tplIdx); idx = 0; }
    }
  }
  render();
  if (orbHandle && orbHandle.engine) {
    const m = currentMember();
    const emp = (m && World.state.employees[m.uid]) || {};
    const status = emp.status || 'idle';
    const clock = performance.now() / 1000;
    orbHandle.engine.setState(avatarState(status), clock);
    orbHandle.engine.setExpression(avatarExpr(m, status), clock);
  }
});
void reduceMotion;   /* 动效降级由 CSS prefers-reduced-motion 块承担 */
