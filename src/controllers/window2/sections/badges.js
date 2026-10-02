/* ============================================================
   第 2 屏 section · 数字员工工牌（原 window2.js 工牌块逐行等价迁移，P3-1）
   挂载条件：页面存在 #badges。缺容器时不挂载，bus.badges 保持 no-op。
   头像句柄生命周期：stopBadgeOrbs 注册到 pagehide（聊天主 AI 球不在此列，P0-1）。
   ============================================================ */
import {
  AIC, World, statusText, bus, onPageHide
} from '../shared.js';
import { buildRoster, orderByRuntime } from '../../../data/staffRoster.js';

/* 每套模板的本地随机名单缓存（会话内稳定，各屏独立随机）：
   槽位制只取真实角色（virtual:false）—— 颜色/形状天然不重复。 */
const rosterCache = {};
function rosterUidsFor(tplId) {
  if (!rosterCache[tplId]) {
    rosterCache[tplId] = new Set(
      buildRoster(tplId, { virtual: false }).members.filter(m => !m.main).map(m => m.uid)
    );
  }
  return rosterCache[tplId];
}

const RING_C = 245.04; // 2π×39

const VIZ = {
  planner: m => `
      <svg width="76" height="14" viewBox="0 0 76 14" aria-hidden="true">
        <line x1="7" y1="7" x2="31" y2="7" stroke="var(--color-accent)" stroke-width="1.2" stroke-dasharray="3 3" opacity=".65"/>
        <line x1="45" y1="7" x2="69" y2="7" stroke="var(--color-accent)" stroke-width="1.2" stroke-dasharray="3 3" opacity=".65"/>
        <circle cx="7" cy="7" r="3" fill="var(--color-accent)"/><circle cx="38" cy="7" r="3.8" fill="var(--color-accent)"/><circle cx="69" cy="7" r="3" fill="var(--color-accent)"/>
      </svg><span class="agn__viznote">依赖链已重排</span>`,
  writer: m => `<span class="agn__pen" style="--p:${World.state.employees[m.key].pct}%"></span><span class="agn__viznote">主稿推进线</span>`,
  analyst: m => `
      <svg width="112" height="18" viewBox="0 0 112 18" aria-hidden="true">
        <polyline points="0,14 18,10 36,13 54,5 72,9 90,3 110,6" fill="none" stroke="var(--color-accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="54" cy="5" r="2.4" fill="var(--paper-2)" stroke="var(--color-accent)" stroke-width="1.4"/>
      </svg><span class="agn__viznote">漏斗趋势 · 异常定位</span>`,
  designer: m => `
      <span class="agn__sw"><i style="background:var(--color-accent)"></i><i style="background:var(--color-success)"></i><i style="background:var(--color-warning)"></i><i style="background:var(--color-blocked)"></i></span>
      <span class="agn__viznote">色板 · 对比度提级</span>`,
  engineer: m => `
      <span class="agn__seg">${Array.from({ length: 14 }, (_, i) => `<i class="${i < Math.round(World.state.employees[m.key].pct / 100 * 14) ? 'on' : ''}"></i>`).join('')}</span>
      <span class="agn__viznote">构建进度</span>`,
  qc: m => `
      <svg width="92" height="18" viewBox="0 0 92 18" aria-hidden="true">
        <circle cx="8" cy="9" r="6" fill="none" stroke="var(--color-accent)" stroke-width="1.6"/>
        <path d="M4.5 9 7 11.5 11.5 6.5" fill="none" stroke="var(--color-accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="40" cy="9" r="6" fill="none" stroke="var(--color-accent)" stroke-width="1.6" opacity=".5"/>
        <circle cx="72" cy="9" r="6" fill="none" stroke="var(--color-accent)" stroke-width="1.6"/>
        <path d="M68.5 9 71 11.5 75.5 6.5" fill="none" stroke="var(--color-accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg><span class="agn__viznote">验收核查 · 阻断回退</span>`
};

const badgeRefs = {};
const badgeAvatars = {};
const AVATAR_CYCLES = {
  planner: [{ state: 'idle', duration: 2.8, expression: 'attentif' }, { state: 'thinking', duration: 2.6, expression: 'curieux' }],
  writer: [{ state: 'idle', duration: 2.4, expression: 'heureux' }, { state: 'thinking', duration: 2.8, expression: 'attentif' }],
  analyst: [{ state: 'thinking', duration: 2.7, expression: 'attentif' }, { state: 'idle', duration: 2.5, expression: 'curieux' }],
  designer: [{ state: 'idle', duration: 2.6, expression: 'curieux' }, { state: 'thinking', duration: 2.4, expression: 'heureux' }],
  engineer: [{ state: 'thinking', duration: 2.9, expression: 'attentif' }, { state: 'idle', duration: 2.2, expression: 'neutre' }],
  qc: [{ state: 'thinking', duration: 2.7, expression: 'attentif' }, { state: 'idle', duration: 2.5, expression: 'curieux' }]
};
const avatarState = status => status === 'wait' ? 'alert' : (status === 'busy' ? 'thinking' : 'idle');
const avatarExpression = (m, status) => status === 'wait' ? 'mefiant' : (status === 'busy' ? 'attentif' : m.expr);

export function thoughtFor(m, st) {
  if (!st || !st.task) return m.think0;
  if (st.status === 'wait') return `等待上游输入与依赖确认；「${st.task}」已保留在队列，条件满足后自动恢复执行。`;
  if (st.status === 'idle') return `「${st.task}」已完成阶段处理，正在复核交付记录与知识库归档，等待下一项调度。`;
  if (st.pct >= 90) return `「${st.task}」进入收尾校验；正在核对验收口径、产物完整性与回传路径，准备提交交付。`;
  if (st.pct >= 60) return `「${st.task}」已进入关键路径；正在合并阶段产出并检查依赖，优先消除交付前风险。`;
  if (st.pct >= 30) return `「${st.task}」正在并行推进；已完成基础拆解，继续处理${m.role}侧的核心产出与验证。`;
  return `已认领「${st.task}」；正在盘点输入、依赖与验收标准，先建立可回滚的执行路径。`;
}

function stopBadgeOrbs() {
  Object.values(badgeAvatars).forEach(h => h && h.stop && h.stop());
  Object.keys(badgeAvatars).forEach(k => delete badgeAvatars[k]);
}
onPageHide(stopBadgeOrbs);

function wireBadgeInteractions(el) {
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
  });
}

export function renderBadges(templateId = World.staffTemplate) {
  const badges = document.getElementById('badges');
  if (!badges) return;   /* 本页无工牌区（screen3/4）：不挂载 */
  const tpl = ['badge', 'dossier', 'signal'].includes(templateId) ? templateId : 'badge';
  stopBadgeOrbs();
  badges.innerHTML = '';
  Object.keys(badgeRefs).forEach(k => delete badgeRefs[k]);
  Object.keys(badgeAvatars).forEach(k => delete badgeAvatars[k]);
  badges.className = `p2__badges badges--${tpl}`;
  badges.dataset.template = tpl;
  const tplLabel = document.getElementById('badge-template');
  if (tplLabel) tplLabel.textContent = `模板 · ${tpl === 'badge' ? '工牌' : tpl === 'dossier' ? '档案' : '信号'}`;
  const onDuty = rosterUidsFor(tpl);   /* 本轮值班名单：未编入的槽位翻面 */
  /* 展示顺序（位置不固定）：在册成员运行中靠前（同级抖动），缺席者随机散布在后 */
  const liveMap = {};
  Object.keys(World.state.employees).forEach(k => { if (onDuty.has(k)) liveMap[k] = World.state.employees[k]; });
  const ordered = orderByRuntime(
    AIC.CAST.map(m => ({ uid: m.key, name: m.name, role: m.role })),
    liveMap
  );
  ordered.forEach((entry, i) => {
    const m = AIC.CAST.find(c => c.key === entry.uid);
    const st = World.state.employees[m.key];
    if (!st) return;   /* 快照缺键兜底：跳过该项而非中断整张工牌网格 */
    const el = document.createElement('article');
    if (!onDuty.has(m.key)) {
      /* 未编入本轮名单：翻面卡（背面「本轮 · 未值班」），无头像、无实时绑定、关闭交互 */
      el.className = 'agn agn--absent is-back';
      el.style.setProperty('--agc', m.color);
      el.dataset.emp = m.key;
      el.innerHTML = `
      <div class="agn__inner">
        <div class="agn__face agn__face--front" aria-hidden="true"></div>
        <div class="agn__face agn__face--back">
          <span class="agn__back-mark">AIC</span>
          <span class="agn__back-strip"></span>
          <span class="agn__back-number">0${i + 1} · ${m.role}</span>
          <span class="agn__back-seal">本轮<br>未值班</span>
          <span class="agn__back-barcode"></span>
        </div>
      </div>`;
      badges.appendChild(el);
      return;
    }
    el.className = 'agn reveal';
    el.style.setProperty('--agc', m.color);
    el.dataset.emp = m.key;
    el.innerHTML = `
      <div class="agn__inner">
        <div class="agn__face agn__face--front">
          <span class="agn__slot"></span>
          <span class="agn__foil"></span>
          <span class="agn__idx">0${i + 1}</span>
          <div class="agn__core">
            <svg class="agn__ring" viewBox="0 0 84 84" aria-hidden="true">
              <circle class="bg" cx="42" cy="42" r="39"></circle>
              <circle class="fg" cx="42" cy="42" r="39" style="stroke-dashoffset:${(RING_C * (1 - st.pct / 100)).toFixed(1)}"></circle>
            </svg>
            <div class="bot"></div>
          </div>
          <div class="agn__body">
            <div class="agn__head"><i class="agn__roledot" style="background:${m.color}"></i><b>${AIC.castLabel(m.key, m.name)}</b><i class="dot dot--${st.status}"></i><em>${m.role} · ${statusText(st.status)}</em></div>
            <p class="agn__think">${thoughtFor(m, st)}</p>
            <div class="agn__viz">${VIZ[m.key](m)}</div>
            <div class="agn__skills">${m.skills.slice(0, 2).map(([name, pct]) => `<span class="agn__skill"><b>${name}</b><i><em style="width:${pct}%"></em></i><small>${pct}</small></span>`).join('')}</div>
            <div class="agn__foot"><b>${st.task}</b><span class="pill">${statusText(st.status)}</span><div class="track track--${m.bar}"><i style="width:${st.pct}%"></i></div><span class="agn__pct num">${Math.round(st.pct)}%</span></div>
          </div>
          <span class="agn__code"></span>
        </div>
        <div class="agn__face agn__face--back" aria-hidden="true">
          <span class="agn__back-mark">AIC</span>
          <span class="agn__back-strip"></span>
          <span class="agn__back-number">0${i + 1} · ${m.role}</span>
          <span class="agn__back-seal">自主经营<br>实时思考</span>
          <span class="agn__back-barcode"></span>
        </div>
      </div>`;
    wireBadgeInteractions(el);
    badges.appendChild(el);
    /* 拟态工牌：点击翻牌（角标显式触发；整卡轻点也翻） */
    const frontFaceEl = el.querySelector('.agn__face--front');
    if (frontFaceEl && !frontFaceEl.querySelector('.agn__flip')) {
      const flipBtn = document.createElement('button');
      flipBtn.type = 'button'; flipBtn.className = 'agn__flip'; flipBtn.setAttribute('aria-label', '翻转工牌');
      flipBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h13V5l6 5-6 5v-4H5v11H3V9z"/></svg>';
      frontFaceEl.appendChild(flipBtn);
      flipBtn.addEventListener('click', (e) => { e.stopPropagation(); el.classList.toggle('is-back'); });
    }
    let ptDown = false, ptX = 0, ptY = 0;
    el.addEventListener('pointerdown', (e) => { ptDown = true; ptX = e.clientX; ptY = e.clientY; });
    el.addEventListener('pointerup', (e) => {
      if (ptDown && Math.hypot(e.clientX - ptX, e.clientY - ptY) < 6) el.classList.toggle('is-back');
      ptDown = false;
    });
    const botEl = el.querySelector('.agn__core .bot');
    if (botEl && Bloub.mount) {
      badgeAvatars[m.key] = Bloub.mount(botEl, {
        size: 56, shape: m.shape, ink: m.color, expression: avatarExpression(m, st.status),
        state: avatarState(st.status), cycle: AVATAR_CYCLES[m.key], paper: '#2C2C2E', speed: 0.92 + i * 0.06
      });
    }
    badgeRefs[m.key] = {
      fg: el.querySelector('.agn__ring .fg'),
      dot: el.querySelector('.agn__head .dot'),
      think: el.querySelector('.agn__think'),
      em: el.querySelector('.agn__head em'),
      task: el.querySelector('.agn__foot b'),
      pill: el.querySelector('.agn__foot .pill'),
      track: el.querySelector('.agn__foot .track i'),
      pct: el.querySelector('.agn__pct'),
      pen: el.querySelector('.agn__pen'),
      seg: el.querySelector('.agn__seg')
    };
  });
  updateBadges();
}

export function updateBadges() {
  AIC.CAST.forEach(m => {
    const st = World.state.employees[m.key], r = badgeRefs[m.key];
    if (!st || !r) return;   /* 快照缺键兜底 */
    const avatar = badgeAvatars[m.key];
    if (avatar && avatar.engine) {
      const clock = performance.now() / 1000;
      avatar.engine.setState(avatarState(st.status), clock);
      avatar.engine.setExpression(avatarExpression(m, st.status), clock);
    }
    r.fg.style.strokeDashoffset = (RING_C * (1 - st.pct / 100)).toFixed(1);
    r.track.style.width = st.pct + '%';
    r.pct.textContent = Math.round(st.pct) + '%';
    r.task.textContent = st.task;
    const thought = thoughtFor(m, st);
    if (r.think && r.think.textContent !== thought) r.think.textContent = thought;
    r.dot.className = 'dot dot--' + st.status;
    r.em.textContent = `${m.role} · ${statusText(st.status)}`;
    r.pill.textContent = statusText(st.status);
    if (r.pen) r.pen.style.setProperty('--p', st.pct + '%');
    if (r.seg) {
      const on = Math.round(st.pct / 100 * 14);
      [...r.seg.children].forEach((sg, i) => sg.classList.toggle('on', i < on));
    }
  });
}

export function initBadges() {
  if (!document.getElementById('badges')) return;
  renderBadges(World.staffTemplate);
  bus.badges.renderBadges = renderBadges;
}
