/* ============================================================
 * screen1 · AI 员工轮播（接力线 #team 改造）
 * ------------------------------------------------------------
 * 拍节口径（用户确认）：1 拍 = 3s；每 2 拍（6s）小轮步进到下一位员工；
 * 累计 4 次小轮（24s）触发大轮：整套模板（3 套循环）＋ 重新随机 3-6 名
 * 员工名单一起切换，刊头徽标 / 模板点 / 知识库读数同拍更新。
 *
 * 数据：src/data/staffRoster.js（模板、名单、去重、ID 注册表）；
 * 状态：World.state.employees / kb 实时驱动（World.on 订阅）；
 * 头像：Bloub.mount 动态球，句柄统一持有，重建 / pagehide 时 stop。
 * ============================================================ */
import { World } from '../../modules/world.js';
import { AIC } from '../../modules/common.js';
import { STAFF_TEMPLATES, buildRoster } from '../../data/staffRoster.js';

const BEAT_MS = 3000;      // 1 拍
const STEP_BEATS = 2;      // 每 2 拍小轮步进一位员工
const BIG_STEPS = 4;       // 累计 4 次小轮 → 大轮换模板

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
/* 状态 → 徽章图元 kind（颜色 + 图标 + 文案三重编码，DESIGN.md §5） */
const kindOf = s => (s === 'run' || s === 'busy') ? 'running' : (s === 'wait' ? 'warning' : 'neutral');
const avatarState = s => s === 'wait' ? 'alert' : (s === 'busy' ? 'thinking' : 'idle');
const avatarExpr = (m, s) => s === 'wait' ? 'mefiant' : (s === 'busy' ? 'attentif' : m.expr);

/* 定时器 / 头像引擎生命周期：pagehide 集中清理（P0-3 与资源生命周期约定） */
const intervals = new Set();
const every = (fn, ms) => { const id = setInterval(fn, ms); intervals.add(id); return id; };
const orbs = new Set();
function stopOrbs() { orbs.forEach(h => { try { h.stop(); } catch (_) { /* 引擎已停 */ } }); orbs.clear(); }
window.addEventListener('pagehide', () => { intervals.forEach(id => clearInterval(id)); intervals.clear(); stopOrbs(); });

let beatCount = 0;
let smallSteps = 0;
let activeIdx = 0;
let paused = false;
let tplIdx = 0;
let initialized = false;
let roster = null;
let cards = [];

let team = null, dotsEl = null, kbEl = null, noteEl = null, mastTpl = null, tplChip = null;
let prevBtn = null, nextBtn = null, pauseBtn = null;

const PAUSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5v13M15 5.5v13"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13l10-6.5z"/></svg>';

/* 焦点员工近 12 小时入库数：与交付节律同一时间窗（doneAt 按小时分箱），
   只用 World 真实任务，不造数。虚拟员工返回 null（读数显示「—」）。 */
function memberDone12h(uid) {
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

/* 单卡状态行：图标（形状）+ 状态点（颜色）+ 文案（语义），三重编码缺一不可 */
function statusHtml(status, label) {
  return `${AIC.stateIcon(kindOf(status))}<i class="dot dot--${status}"></i>${label}`;
}

function staticProfile(m) {
  if (m.main) return { status: 'busy', label: '统筹中', task: '统筹全局 · 自动接单与归档' };
  return { status: 'idle', label: '待接入', task: '档案 · 待接入' };
}

function liveProfile(m) {
  const emp = World.state.employees[m.uid] || {};
  const status = emp.status || 'idle';
  return { status, label: AIC.statusText(status), task: emp.task || `${m.name} · 待接入` };
}

function buildCard(m, layout) {
  const el = document.createElement('article');
  el.className = 'staff-card staff-card--' + layout + (m.main ? ' staff-card--main' : '');
  el.dataset.empId = m.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.style.setProperty('--sig', m.ink);          /* 角色墨色只作名单内信号点（DESIGN.md §2） */
  const live = !(m.virtual || m.main);
  const p = live ? liveProfile(m) : staticProfile(m);
  const pct = live ? Math.round((World.state.employees[m.uid] || {}).pct || 0) : null;
  const kbTxt = m.main ? '统筹 · 全线吞吐' : (m.virtual ? '档案 · 待接入' : `知识库 +${memberDone12h(m.uid)}`);
  el.innerHTML = `
    <div class="staff-card__orb"></div>
    <div class="staff-card__body">
      <div class="staff-card__head">
        <span class="staff-card__id num">${m.id}</span>
        <i class="staff-card__sig" aria-hidden="true"></i>
        <b class="staff-card__name">${m.name}</b>
        <span class="staff-card__st">${statusHtml(p.status, p.label)}</span>
      </div>
      <p class="staff-card__task">${p.task}</p>
      <div class="staff-card__foot">
        <span class="staff-card__kb">${kbTxt}</span>
        <span class="staff-card__prog"><span class="track"><i${live ? ` style="width:${pct}%"` : ''}></i></span><b class="staff-card__pct num">${live ? pct + '%' : '—'}</b></span>
      </div>
    </div>`;
  el.title = `${m.id} · ${m.name} · ${p.label} · ${p.task}`;
  el.setAttribute('aria-label', el.title);
  return {
    member: m,
    el,
    handle: null,
    st: el.querySelector('.staff-card__st'),
    task: el.querySelector('.staff-card__task'),
    kb: el.querySelector('.staff-card__kb'),
    prog: el.querySelector('.staff-card__prog i'),
    progNum: el.querySelector('.staff-card__pct')
  };
}

/* rAF 可用性门控：后台标签 / 遮挡窗口会挂起 rAF，mount 的动态球拿不到首帧。
   策略：先落一帧 Bloub.static 保证永不空球；首次 rAF 到来后把静态球升级为动态球。 */
let rafOn = false;
requestAnimationFrame(() => {
  rafOn = true;
  cards.forEach(c => { if (!c.handle) mountOrb(c); });   /* 恢复后升级为动态帧 */
});

/* 头像动态球：必须在卡片入 DOM 后挂载（mount 会接管容器 innerHTML） */
function mountOrb(c) {
  if (!window.Bloub) return;
  const layout = roster.tpl.layout;
  const m = c.member;
  const p = m.virtual || m.main ? staticProfile(m) : liveProfile(m);
  const opts = {
    size: layout === 'dossier' ? 44 : (layout === 'signal' ? 58 : 52),
    shape: m.shape,
    ink: m.ink,
    expression: m.expr,
    state: avatarState(p.status),
    paper: cssVar('--bg-base'),
    cycle: [
      { state: 'idle', duration: 2.6, expression: m.expr },
      { state: 'thinking', duration: 2.9, expression: avatarExpr(m, 'busy') }
    ],
    speed: 0.92
  };
  const orbEl = c.el.querySelector('.staff-card__orb');
  if (Bloub.static) orbEl.innerHTML = Bloub.static(opts);
  if (Bloub.mount && rafOn) {
    c.handle = Bloub.mount(orbEl, opts);
    if (c.handle && c.handle.stop) orbs.add(c.handle);
  }
}

/* 焦点平移：轨道溢出时把焦点卡移到可视带中点；无溢出只动高亮 */
function positionTrack() {
  if (!team) return;
  const cur = cards[activeIdx] && cards[activeIdx].el;
  if (!cur) { team.style.transform = ''; return; }
  const overflow = team.scrollWidth - team.clientWidth;
  if (overflow <= 2) { team.style.transform = ''; return; }
  const x = Math.max(0, Math.min(overflow, cur.offsetLeft - (team.clientWidth - cur.offsetWidth) / 2));
  team.style.transform = `translateX(${-x}px)`;
}

function focusCard(idx, countStep) {
  if (!cards.length) return;
  const prev = cards[activeIdx];
  if (prev) { prev.el.classList.remove('is-active'); prev.el.removeAttribute('aria-current'); }
  activeIdx = (idx + cards.length) % cards.length;
  const cur = cards[activeIdx];
  cur.el.classList.add('is-active');
  cur.el.setAttribute('aria-current', 'true');
  positionTrack();
  if (noteEl) noteEl.textContent = `下一班 ${cards[(activeIdx + 1) % cards.length].member.id}`;
  syncKB();
  if (countStep) {
    smallSteps++;
    if (smallSteps >= BIG_STEPS) { smallSteps = 0; rotateTemplate(); }
  }
}

/* 大轮：下一套模板 ＋ 重新随机名单（buildRoster 内含形状/墨色/ID 去重） */
function rotateTemplate() {
  tplIdx = (tplIdx + 1) % STAFF_TEMPLATES.length;
  render();
  World.setStaffTemplate(STAFF_TEMPLATES[tplIdx].id);
}

function render() {
  roster = buildRoster(STAFF_TEMPLATES[tplIdx].id);
  stopOrbs();
  team.innerHTML = '';
  cards = roster.members.map(m => buildCard(m, roster.tpl.layout));
  cards.forEach(c => {
    team.appendChild(c.el);
    mountOrb(c);
    c.el.addEventListener('click', () => focusCard(cards.indexOf(c), false));
    c.el.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      focusCard(cards.indexOf(c), false);
    });
  });
  activeIdx = 0;
  cards[0].el.classList.add('is-active');
  cards[0].el.setAttribute('aria-current', 'true');
  positionTrack();
  syncTemplate();
  syncKB();
}

/* 模板层文案同步：刊头徽标 / 轮播模板芯片 / 模板点 / 注释行（大轮同拍更新） */
function syncTemplate() {
  const tpl = roster.tpl;
  if (mastTpl) mastTpl.textContent = `模板 ${tplIdx + 1}/${STAFF_TEMPLATES.length} · ${tpl.name}`;
  if (tplChip) tplChip.textContent = `${tpl.name} · ${tpl.tag}`;
  if (noteEl) noteEl.textContent = `下一班 ${cards[(activeIdx + 1) % cards.length].member.id}`;
  if (dotsEl) [...dotsEl.children].forEach((d, i) => d.classList.toggle('is-on', i === tplIdx));
}

/* 知识库读数：World 真值（累计）+ 焦点员工近 12h 入库（虚拟/主 AI 显示 —） */
function syncKB() {
  if (!kbEl) return;
  const kb = World.state.kb;
  const cur = cards[activeIdx];
  const topic = roster ? roster.tpl.kbTopic : '知识库';
  const n = cur && !cur.member.virtual && !cur.member.main ? memberDone12h(cur.member.uid) : null;
  const focus = cur ? `${cur.member.id} 近12h入库 +${n == null ? '—' : n}` : '—';
  kbEl.innerHTML = `${topic} · <b>${focus}</b> · 累计 <b>${kb.total}</b>`;
}

/* World 订阅：员工状态 / 任务 / 进度实时刷卡（textContent 有变化才写） */
function refreshMembers() {
  cards.forEach(c => {
    const m = c.member;
    if (m.virtual || m.main) return;
    const emp = World.state.employees[m.uid];
    if (!emp) return;
    const status = emp.status || 'idle';
    const html = statusHtml(status, AIC.statusText(status));
    if (c.st.innerHTML !== html) c.st.innerHTML = html;
    const task = emp.task || `${m.name} · 待接入`;
    if (c.task.textContent !== task) {
      c.task.textContent = task;
      c.el.title = `${m.id} · ${m.name} · ${AIC.statusText(status)} · ${task}`;
      c.el.setAttribute('aria-label', c.el.title);
    }
    const pct = Math.round(emp.pct || 0);
    c.prog.style.width = pct + '%';
    c.progNum.textContent = pct + '%';
    const kbTxt = `知识库 +${memberDone12h(m.uid)}`;
    if (c.kb.textContent !== kbTxt) c.kb.textContent = kbTxt;
    if (c.handle && c.handle.engine) {
      const clock = performance.now() / 1000;
      c.handle.engine.setState(avatarState(status), clock);
      c.handle.engine.setExpression(avatarExpr(m, status), clock);
    }
  });
}

/* 拍节调度：暂停 / 后台标签时静默跳拍 */
function tick() {
  if (paused || document.hidden || !cards.length) return;
  beatCount++;
  if (beatCount % STEP_BEATS === 0) focusCard(activeIdx + 1, true);
}

export function initStaffCarousel() {
  team = document.getElementById('team');
  if (!team) return;
  dotsEl = document.getElementById('staff-dots');
  kbEl = document.getElementById('staff-kb');
  noteEl = document.getElementById('staff-note');
  tplChip = document.getElementById('staff-tpl');
  mastTpl = document.getElementById('mast-tpl');
  prevBtn = document.getElementById('staff-prev');
  nextBtn = document.getElementById('staff-next');
  pauseBtn = document.getElementById('staff-pause');

  const sharedTpl = World.staffTemplate;
  const sharedIdx = STAFF_TEMPLATES.findIndex(t => t.id === sharedTpl);
  if (sharedIdx >= 0) tplIdx = sharedIdx;
  initialized = true;
  render();

  if (prevBtn) prevBtn.addEventListener('click', () => focusCard(activeIdx - 1, false));
  if (nextBtn) nextBtn.addEventListener('click', () => focusCard(activeIdx + 1, false));
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.setAttribute('aria-pressed', String(paused));
      pauseBtn.setAttribute('aria-label', paused ? '恢复轮播' : '暂停轮播');
      pauseBtn.innerHTML = paused ? PLAY_SVG : PAUSE_SVG;
    });
  }

  every(tick, BEAT_MS);
  World.on((evts) => {
    const tplEvent = evts.find(e => e.type === 'staffTemplate');
    if (tplEvent && initialized && tplEvent.id !== STAFF_TEMPLATES[tplIdx].id) {
      const nextIdx = STAFF_TEMPLATES.findIndex(t => t.id === tplEvent.id);
      if (nextIdx >= 0) { tplIdx = nextIdx; smallSteps = 0; render(); }
    }
    refreshMembers(); syncKB();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    refreshMembers(); syncKB(); positionTrack();
  });
  window.addEventListener('resize', positionTrack);
  void reduceMotion;   /* 动效降级由 CSS prefers-reduced-motion 块承担，节奏本身属内容节拍 */
}
