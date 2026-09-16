// ============================================================
// window2.html 控制器：横向卷轴（第 2/3/4 屏）
// 纯 ES 模块：AIC / World / Nebula 由 import 引入，
// Bloub / EmotionBall / gsap 为经典全局脚本注入。
// ============================================================
import { AIC } from '../modules/common.js';
import { World } from '../modules/world.js';
import { Nebula } from '../modules/nebula.js';
import { hmAgo, nowHM, fmtAgo, mountTimeTicker } from '../modules/time.js';
import { buildDocContent, reviewDoc, openDocReview } from '../modules/docgen.js';
import { DOCS } from '../data/documents.js';
import { EV_LABEL } from '../modules/linkage.js';

/* ================= 基础：数据源 / 工具 ================= */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CAST = AIC.CAST;
  const STATUS_TXT = AIC.STATUS_TXT;
  const statusText = AIC.statusText || ((status) => STATUS_TXT[status]);
  const AVATAR_MAP = AIC.AVATAR_MAP;
  const gsapOK = () => window.gsap && !reduceMotion && !document.body.classList.contains('no-anim');
  if (!window.gsap) document.body.classList.add('no-anim');
  const $ = s => document.querySelector(s);
  const setTxt = (s, v) => { const el = $(s); if (el) el.textContent = v; };
  let suppressClick = false;
  let patrolOn = true;
  let taskBusy = false;
  /* docNo → { content, order, context }：交付文件气泡复看时反查文档上下文 */
  const docRefs = new Map();
  /* 防止长会话 Map 无界增长（P0-4）：超出上限时淘汰最早写入项 */
  const DOC_REFS_MAX = 64;
  function setDocRef(key, val) {
    setDocRef(key, val);
    if (docRefs.size > DOC_REFS_MAX) { const k = docRefs.keys().next().value; if (k !== undefined) docRefs.delete(k); }
  }
  let chatOrb = null;
  /* 定时器统一登记：pagehide 时集中清理，避免热重载/翻面遗留野定时器（P0-3/P0-5） */
  const intervals = new Set();
  const timeouts = new Set();
  function every(fn, ms) { const id = setInterval(fn, ms); intervals.add(id); return id; }
  function later(fn, ms) { const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); return id; }
  function clearPageTimers() {
    intervals.forEach(id => clearInterval(id)); intervals.clear();
    timeouts.forEach(id => clearTimeout(id)); timeouts.clear();
  }
  function stopOrbs() {
    if (typeof badgeAvatars !== 'undefined') Object.values(badgeAvatars).forEach(h => h && h.stop && h.stop());
    if (chatOrb && chatOrb.stop) chatOrb.stop();
  }
  window.addEventListener('pagehide', () => { clearPageTimers(); stopOrbs(); });

  /* ================= 真实时间：把模板里静态的时间标签对齐到当前时钟，并挂 data-ts 自动刷新 ================= */
  (function normalizeStaticTimes() {
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
  })();

  /* ================= 第 2 屏：五张智能体创意卡（实时同步） ================= */
  const badges = document.getElementById('badges');
  const RING_C = 245.04; // 2π×39

  const VIZ = {
    planner: m => `
      <svg width="76" height="14" viewBox="0 0 76 14" aria-hidden="true">
        <line x1="7" y1="7" x2="31" y2="7" stroke="${m.color}" stroke-width="1.2" stroke-dasharray="3 3" opacity=".65"/>
        <line x1="45" y1="7" x2="69" y2="7" stroke="${m.color}" stroke-width="1.2" stroke-dasharray="3 3" opacity=".65"/>
        <circle cx="7" cy="7" r="3" fill="${m.color}"/><circle cx="38" cy="7" r="3.8" fill="${m.color}"/><circle cx="69" cy="7" r="3" fill="${m.color}"/>
      </svg><span class="agn__viznote">依赖链已重排</span>`,
    writer: m => `<span class="agn__pen" style="--p:${World.state.employees[m.key].pct}%"></span><span class="agn__viznote">主稿推进线</span>`,
    analyst: m => `
      <svg width="112" height="18" viewBox="0 0 112 18" aria-hidden="true">
        <polyline points="0,14 18,10 36,13 54,5 72,9 90,3 110,6" fill="none" stroke="${m.color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="54" cy="5" r="2.4" fill="#fff" stroke="${m.color}" stroke-width="1.4"/>
      </svg><span class="agn__viznote">漏斗趋势 · 异常定位</span>`,
    designer: m => `
      <span class="agn__sw"><i style="background:${m.color}"></i><i style="background:#22d3ee"></i><i style="background:#fb923c"></i><i style="background:#fbbf24"></i></span>
      <span class="agn__viznote">色板 · 对比度提级</span>`,
    engineer: m => `
      <span class="agn__seg">${Array.from({ length: 14 }, (_, i) => `<i class="${i < Math.round(World.state.employees[m.key].pct / 100 * 14) ? 'on' : ''}"></i>`).join('')}</span>
      <span class="agn__viznote">构建进度</span>`
  };

  const badgeRefs = {};
  const badgeAvatars = {};
  const AVATAR_CYCLES = {
    planner: [{ state: 'idle', duration: 2.8, expression: 'attentif' }, { state: 'thinking', duration: 2.6, expression: 'curieux' }],
    writer: [{ state: 'idle', duration: 2.4, expression: 'heureux' }, { state: 'thinking', duration: 2.8, expression: 'attentif' }],
    analyst: [{ state: 'thinking', duration: 2.7, expression: 'attentif' }, { state: 'idle', duration: 2.5, expression: 'curieux' }],
    designer: [{ state: 'idle', duration: 2.6, expression: 'curieux' }, { state: 'thinking', duration: 2.4, expression: 'heureux' }],
    engineer: [{ state: 'thinking', duration: 2.9, expression: 'attentif' }, { state: 'idle', duration: 2.2, expression: 'neutre' }]
  };
  const avatarState = status => status === 'wait' ? 'alert' : (status === 'busy' ? 'thinking' : 'idle');
  const avatarExpression = (m, status) => status === 'wait' ? 'mefiant' : (status === 'busy' ? 'attentif' : m.expr);
  function thoughtFor(m, st) {
    if (!st || !st.task) return m.think0;
    if (st.status === 'wait') return `等待上游输入与依赖确认；「${st.task}」已保留在队列，条件满足后自动恢复执行。`;
    if (st.status === 'idle') return `「${st.task}」已完成阶段处理，正在复核交付记录与知识库归档，等待下一项调度。`;
    if (st.pct >= 90) return `「${st.task}」进入收尾校验；正在核对验收口径、产物完整性与回传路径，准备提交交付。`;
    if (st.pct >= 60) return `「${st.task}」已进入关键路径；正在合并阶段产出并检查依赖，优先消除交付前风险。`;
    if (st.pct >= 30) return `「${st.task}」正在并行推进；已完成基础拆解，继续处理${m.role}侧的核心产出与验证。`;
    return `已认领「${st.task}」；正在盘点输入、依赖与验收标准，先建立可回滚的执行路径。`;
  }
  const badgeEls = [];
  CAST.forEach((m, i) => {
    const st = World.state.employees[m.key];
    const el = document.createElement('article');
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
            <div class="agn__head"><b>${AIC.castLabel(m.key, m.name)}</b><i class="dot dot--${st.status}"></i><em>${m.role} · ${statusText(st.status)}</em></div>
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
    badges.appendChild(el);
    badgeEls.push(el);
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
        state: avatarState(st.status), cycle: AVATAR_CYCLES[m.key], paper: '#263046', speed: 0.92 + i * 0.06
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


  function updateBadges() {
    CAST.forEach(m => {
      const st = World.state.employees[m.key], r = badgeRefs[m.key];
      if (!r) return;
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

  /* 聊天头部主 AI（白色小球，暖底可读）；持有句柄以便卸载时 stop（P0-1） */
  chatOrb = Bloub.mount(document.getElementById('chat-main'), {
    size: 40, shape: 'cercle', ink: '#ffffff', expression: 'attentif', state: 'idle', paper: '#0d1524'
  });

  /* 群聊头像：按角色渲染真实小球（缩小版） */
  document.querySelectorAll('.avatar-slot[data-who]').forEach(el => {
    const c = AVATAR_MAP[el.dataset.who];
    if (!c) return;
    if (el.dataset.who === 'main') el.classList.add('bot-white');
    el.innerHTML = Bloub.static({ size: 34, expression: 'neutre', state: 'idle', ...c });
  });

  /* ================= 群聊：诚实打字指示 + 消息队列 ================= */
  const thread = document.querySelector('.chat__thread');
  const chatCount = document.getElementById('chat-count');
  let typingRow = null;
  function whoName(who) { return who === 'main' ? '主 AI' : (CAST.find(c => c.key === who) || {}).name || who; }
  function showTyping(who) {
    hideTyping();
    const row = document.createElement('div');
    row.className = 'chat-row';
    const av = document.createElement('span');
    av.className = 'avatar-slot' + (who === 'main' ? ' bot-white' : '');
    av.innerHTML = Bloub.static({ size: 34, expression: 'neutre', state: 'idle', ...AVATAR_MAP[who] });
    const t = document.createElement('div');
    t.className = 'typing';
    t.innerHTML = `${whoName(who)} 正在输入<span class="dots"><i></i><i></i><i></i></span>`;
    row.append(av, t);
    thread.appendChild(row);
    typingRow = row;
    thread.scrollTop = thread.scrollHeight;
  }
  function hideTyping() { if (typingRow) { typingRow.remove(); typingRow = null; } }

  const chatQ = [];
  let draining = false;
  function queueChat(who, text, isMain, think, meta = {}) { chatQ.push({ who, text, isMain, think, meta }); drainChat(); }
  function drainChat() {
    if (draining || !chatQ.length) return;
    draining = true;
    const m = chatQ.shift();
    showTyping(m.who);
    later(() => {
      hideTyping();
      const row = addChatRow(m.who, m.text, m.isMain, m.think, m.meta);
      draining = false;
      drainChat();
      return row;
    }, 1000 + Math.random() * 1500);
  }
  /* 群聊 / 思考链 / 气泡 / 事件日志共用的文本出口：
     先统一脱敏（金额整段摘除、价格词换中性表述），再做 HTML 转义。 */
  function chatEsc(value = '') {
    return AIC.stripMoney(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function addChatRow(who, text, isMain, think, meta = {}) {
    const row = document.createElement('div');
    row.className = 'chat-row' + (isMain ? ' chat-row--ai' : '');
    const av = document.createElement('span');
    av.className = 'avatar-slot' + (who === 'main' ? ' bot-white' : '');
    av.title = whoName(who);
    av.innerHTML = Bloub.static({ size: 34, expression: 'neutre', state: 'idle', ...AVATAR_MAP[who] });
    const b = document.createElement('div');
    const isFile = meta.kind === 'file' || meta.kind === 'review';
    const clickable = isFile && !!meta.docId;
    b.className = 'bubble' + (isMain ? ' bubble--ai' : '') + (isFile ? ' bubble--file' : '') + (clickable ? ' is-clickable' : '');
    if (clickable) {
      b.dataset.docId = meta.docId;
      b.setAttribute('role', 'button');
      b.setAttribute('tabindex', '0');
      b.setAttribute('aria-label', `打开交付审阅：${meta.fileName || meta.docId}`);
      b.title = '点击打开交付审阅';
    }
    const thinkHtml = think ? (() => {
      const ts = Date.now();
      return `<div class="bubble__think"><b><svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.6.5 1 1.2 1 2h6c0-.8.4-1.5 1-2A6 6 0 0012 3z"/></svg>思考 · <span data-ts="${ts}">${fmtAgo(ts)}</span></b>${chatEsc(think)}</div>`;
    })() : '';
    const cardHtml = isFile ? `<div class="bubble-file" data-file-kind="${chatEsc(meta.kind)}">
      <svg class="bubble-file__icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#ft-word"></use></svg>
      <div class="bubble-file__main"><b>${chatEsc(meta.fileName || '交付方案.docx')}</b><span>${chatEsc(meta.fileMeta || '交付方案 · DOCX')}</span><small>${chatEsc(meta.fileSub || '主 AI 生成')} · ${chatEsc(meta.fileSize || '文件已同步')}</small></div>
      <strong>${chatEsc(meta.fileType || 'DOCX')}</strong><em>${chatEsc(meta.fileStatus || '已生成')}</em>
    </div>` : chatEsc(text);
    b.innerHTML = `${thinkHtml}${cardHtml}<div class="bubble__time" data-ts="${Date.now()}">${fmtAgo(Date.now())}</div>`;
    row.append(av, b);
    thread.appendChild(row);
    const rows = thread.querySelectorAll('.chat-row');
    if (rows.length > 46) rows[0].remove();
    thread.scrollTop = thread.scrollHeight;
    if (chatCount) chatCount.textContent = rows.length;
    if (gsapOK()) gsap.from(row, { y: 12, autoAlpha: 0, duration: 0.4, ease: 'power2.out' });
    return row;
  }
  /* 交付文件气泡：点击 / 回车 / 空格 → 重新打开该文档的审阅弹窗
     用事件委托只绑一次：气泡随消息动态增删、且超过 46 行会被裁剪，无需逐条绑定与解绑 */
  function reviewFromBubble(target) {
    const bubble = target && target.closest ? target.closest('.bubble--file[data-doc-id]') : null;
    if (!bubble || !thread.contains(bubble)) return false;
    const ref = docRefs.get(bubble.dataset.docId);
    if (!ref) return false;
    wakeIdle();
    openDocReview(ref.content, ref.order, { context: ref.context });
    return true;
  }
  thread.addEventListener('click', (e) => reviewFromBubble(e.target));
  thread.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (reviewFromBubble(e.target)) e.preventDefault();
  });
  function addReact(row, txt) {
    if (!row || !row.after) return;
    later(() => {
      const r = document.createElement('span');
      r.className = 'msg-react';
      r.textContent = txt;
      row.after(r);
      if (gsapOK()) gsap.from(r, { scale: 0.6, autoAlpha: 0, duration: 0.35, ease: 'back.out(2)' });
    }, 2200 + Math.random() * 2200);
  }

  /* 跨屏联动：完成产物写入第 4 屏知识目录 */
  function addShelfRow(title) {
    const group = document.querySelector('.atlas-catalog .shelf-group');
    if (!group) return;
    const row = document.createElement('div');
    row.className = 'shelf-row shelf-row--new';
    row.innerHTML = `
      <span class="cat-no">NEW</span>
      <span class="shelf-ic"><svg class="ft-ic ft-ic--sm" aria-hidden="true"><use href="#ft-word"></use></svg></span>
      <span class="title">${title}</span>
      <div class="meta"><span class="tag">整合</span><span class="num" data-ts="${Date.now()}">${fmtAgo(Date.now())}</span><span class="pill">DOC</span></div>`;
    group.insertBefore(row, group.querySelector('.shelf-row'));
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (gsapOK()) gsap.from(row, { backgroundColor: 'rgba(31,111,92,0.16)', duration: 1.8, ease: 'power2.out' });
  }

  /* ================= 思考流面板：内容全部由下方「思考链」调度器生成 ================= */
  const thinkPane = document.getElementById('think');

  /* ================= 思考链：分级推理 · 串行节拍调度 =================
   * 一条业务事件 = 一条推理链（观察 → 拆解 → 推演 → 决策 → 结论）。
   * 串行播放：打字 → 阅读保底停顿 → 阶段递进停顿 → 下一步；加速档只压缩时长、不减步骤。
   * 历史链全部保留（按整条链裁剪到上限）；用户上滑回看时不被强制吸底。 */
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
  /* 现场快照：推理链里的数字都取自真实世界状态，保证「想过」有依据 */
  function snapWorld() {
    const st = World.state;
    const tasks = Object.values(st.tasks);
    return {
      st,
      doing: tasks.filter(t => t.status === 'doing').length,
      queued: tasks.filter(t => t.status === 'queued').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      producing: Object.values(st.orders).filter(o => o.status === 'producing').length
    };
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
  function patrolSim(text, s) {
    if (/任务池/.test(text)) return `推演：并行度 ${s.doing} · 排队 ${s.queued}，背压阈值未触及，无需限流。`;
    if (/交付量|营收/.test(text)) return `推演：负载随并行度线性浮动，一次通过率仍在上限区间，无需干预。`;
    if (/知识库/.test(text)) return `推演：入库速率与产出速率匹配，索引无积压。`;
    if (/在产订单/.test(text)) return `推演：逐单复核交付窗口，产能与排期对齐。`;
    if (/算力/.test(text)) return `推演：剩余算力可再承接 ${Math.max(2, 20 - s.doing)} 路并行任务。`;
    return `推演：节律与接单速率匹配，无异常波动。`;
  }
  function patrolVerdict(text) {
    if (/无死锁|无风险|无异常|正常|无积压|未触及/.test(text)) return '判定：无需干预，继续无人值守。';
    if (/风险|死锁|偏高|超期|阻塞/.test(text)) return '判定：转入下一次重点复核，暂不打断产线。';
    return '判定：无需干预，继续无人值守。';
  }
  /* 启动链：接管经营现场（替代原先写死在 HTML 里的静态思考行） */
  function bootThinking() {
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

  /* ================= 交付产物：生成 Word 文档 + 自动弹窗审阅 ================= */
  function tasksOfOrder(o) {
    if (!o || !o.id) return [];
    return Object.values(World.state.tasks).filter(t => t.order === o.id);
  }
  function latestDeliveredOrder() {
    const st = World.state;
    const done = Object.values(st.orders).filter(o => o.status === 'settled' || o.status === 'settling');
    if (done.length) return done[done.length - 1];
    const all = Object.values(st.orders);
    return all[all.length - 1] || {};
  }
  /* 群内成稿讨论（不碰既有思考流，只做加法） */
  function docChatDriven(order, content, silent) {
    const demand = content.meta.demand;
    thinkChain(`成稿 · ${content.title}`, [
      { p: 'obs',   t: `交付记录齐备：「${demand}」相关任务均已验收，素材窗口关闭。` },
      { p: 'cut',   t: `结构盘点：按 ${content.meta.docNo} 目录归并章节，逐节标注来源订单。` },
      { p: 'sim',   t: `口径推演：正文数字与交付台账逐项比对，偏差段落留待初审定位。` },
      { p: 'judge', t: `初审判定交由数据分析：格式与完整性先跑一轮，避免带病归档。` },
      { p: 'concl', t: `《${content.title}》成稿完成，已进入审阅流程。` }
    ], { prio: 5 });
    if (silent) return;
    queueChat('analyst', `已整理「${demand}」交付记录，初稿《${content.title}》已生成。`, false,
      `先盘点订单字段与各章节结构；对照验收口径逐节抽查，把「格式与完整性」先跑一遍再报结论。`);
    later(() => {
      queueChat('main', `《${content.title}》已进入审阅流程，数据分析逐节核查并据实指出不足。`, true,
        `收到成稿通知；审阅由数据分析发起，我汇总其意见后定稿——有不足则回退修订，无不足则准予归档。`, {
          kind: 'file', fileName: `${content.title}.docx`, fileType: 'DOCX', docId: content.meta.docNo,
          fileMeta: `交付方案 · ${content.meta.version} · ${content.meta.docNo}`,
          fileSub: '主 AI 生成 · 已进入审阅', fileStatus: '审阅中'
        });
    }, 1600);
  }
  const archivedDocs = new Set();
  function archiveReviewedDoc(order, content) {
    const key = `${order && order.id || content.meta.docNo}:${content.meta.version}`;
    if (archivedDocs.has(key)) return false;
    archivedDocs.add(key);
    const title = `${content.title} · ${content.meta.docNo}`;
    if (Nebula && Nebula.addKnowledge) Nebula.addKnowledge('main', title, {
      type: 'DOCX', version: content.meta.version, client: content.meta.client,
      reviewedAt: content.meta.date, source: 'AI 审阅通过'
    });
    addShelfRow(`${content.title} · 已审阅归档`);
    thinkQuick(`归档 · ${content.title}`,
      `审阅回执：全部章节通过，无阻断项。`,
      `推演：产物与验收口径一致，可写入知识库并同步索引。`,
      `${content.title} 已归档到知识库，主 AI 索引更新。`,
      { prio: 6 });
    return true;
  }
  function postReviewToChat(res, order, content) {
    const demand = (content && content.meta && content.meta.demand) || ((order && order.demand) || '该订单');
    const title = (content && content.title) || `《${demand}》交付方案`;
    if (res.pass) {
      archiveReviewedDoc(order, content);
      thinkQuick(`审阅通过 · ${title}`,
        `逐节核查完成：结构、字段、格式全部合规。`,
        `推演：未命中缺口，无需回退修订，直接进入归档路径。`,
        `签署归档：${title} 交付闭环完成。`,
        { prio: 6 });
      queueChat('main', `已审：《${demand}》文档无不足，规范齐整，直接签署归档。`, true,
        `逐节核查未命中任何缺口：结构、字段、格式全部合规。据实不指出不足，直接进入归档，不返回修订。`, {
          kind: 'file', fileName: `${title}.docx`, fileType: 'DOCX', docId: content.meta.docNo,
          fileMeta: `交付方案 · ${content.meta.version} · ${content.meta.docNo}`,
          fileSub: 'AI 审阅完成 · 已交给第三屏主 AI 归档', fileStatus: '已通过'
        });
    } else {
      const top = res.findings[0];
      thinkChain(`审阅未过 · ${title}`, [
        { p: 'obs',   t: `命中 ${res.findings.length} 处不足：${res.findings.map(f => f.section).join('、')}。`, risk: true },
        { p: 'cut',   t: `分级定位：区分阻断项与建议项，阻断项先行回退。` },
        { p: 'sim',   t: `推演：按修订清单逐条回写，复审只校验改动段落，避免整体重跑。` },
        { p: 'concl', t: `已回退修订，修订完成后自动复审。`, risk: true }
      ], { prio: 9, tone: 'risk' });
      queueChat('analyst', `审阅回来：先说第 1 节「${top.section}」——${top.issue}。`, false,
        `对照验收口径逐节比对，「${top.section}」是阻断项：${top.issue}；建议 ${top.suggestion}，其余先通过，不阻塞整体节奏。`);
      later(() => {
        queueChat('main', `已汇总审阅：共 ${res.findings.length} 处不足，反馈修订后再复审；其余通过。`, true,
          `本次审阅命中的不足：${res.findings.map(f => f.section).join('、')}。逐条回写修订清单，修完复审判定收尾。`, {
            kind: 'review', fileName: `${title}.docx`, fileType: 'DOCX', docId: content.meta.docNo,
            fileMeta: `交付方案 · ${content.meta.version} · ${content.meta.docNo}`,
            fileSub: `${top.source} · ${top.issue}`, fileStatus: '待修订'
          });
      }, 1800);
    }
  }
  function generateDeliverableDoc(order, silent, opts = {}) {
    const o = order || latestDeliveredOrder();
    const tasks = tasksOfOrder(o);
    const chatRows = [...thread.querySelectorAll('.chat-row')].slice(-10).map(row => ({
      who: whoName(row.querySelector('.avatar-slot')?.dataset.who || 'main'),
      text: row.querySelector('.bubble')?.innerText || row.querySelector('.typing')?.innerText || '',
      main: row.classList.contains('chat-row--ai'),
      time: (() => { const el = row.querySelector('.bubble__time'); const t = el && el.dataset.ts ? +el.dataset.ts : null; return t || Date.now(); })()
    })).filter(r => r.text);
    const discussion = [...thread.querySelectorAll('.bubble')].slice(-18).map(b => b.innerText).filter(Boolean);
    const context = { order: o, tasks, discussion, chatRows };
    const content = buildDocContent(o, { tasks });
    /* 登记文档上下文：群聊里的交付文件气泡据此可点开复看 */
    setDocRef(content.meta.docNo, { content, order: o, context });
    docChatDriven(o, content, silent);
    if (!silent) {
      later(() => {
        const result = reviewDoc(content, context);
        postReviewToChat(result, o, content);
      }, 4200);
    }
    /* 用户主动生成 / 自主结算时打开交付审阅弹窗；同文档重复触发由 openDocReview 单例去重 */
    if (opts.openReview) openDocReview(content, o, { context });
    return content;
  }

  /* ================= 第 3 屏：深井表情球 ================= */
  const ebBall = EmotionBall.create(document.getElementById('eb-main'), {
    emotion: '02', shape: 'blob', idle: true, autostart: true
  });

  /* 待机(02) ↔ 思考中(30) 轮换；睡眠 / 任务期间挂起 */
  let ebPhase = 0;
  let ebTimer = null;
  let sleeping = false;
  function ebToggle() {
    if (sleeping || taskBusy) return;
    ebPhase = 1 - ebPhase;
    ebBall.setEmotion(ebPhase ? '30' : '02');
  }
  const ebPage = document.getElementById('eb-main').closest('.reel__page');
  new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) {
      if (!ebTimer) ebTimer = setInterval(ebToggle, 3600);
      ebBall.clearGaze();
      armIdle();
    } else if (ebTimer) { clearInterval(ebTimer); ebTimer = null; }
  }), { threshold: 0.05 }).observe(ebPage);
  const ebHost = document.querySelector('.p3 .stage');
  ebHost.addEventListener('pointermove', (e) => {
    const r = ebHost.getBoundingClientRect();
    ebBall.setGaze((e.clientX - r.left - r.width / 2) / 300, (e.clientY - r.top - r.height / 2) / 300);
    wakeIdle();
  });

  /* 待机看门狗：22s 无交互 → 睡眠 */
  let idleTimer = null;
  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (taskBusy || document.hidden) { armIdle(); return; }
      sleeping = true;
      ebBall.clearGaze();
      ebBall.setEmotion('00');
    }, 22000);
  }
  function wakeIdle() {
    clearTimeout(idleTimer);
    if (sleeping) {
      sleeping = false;
      ebBall.setEmotion('01');
      later(() => { if (!sleeping && !taskBusy) ebBall.setEmotion('02'); }, 900);
    }
    armIdle();
  }
  document.querySelector('.p3').addEventListener('pointermove', wakeIdle, { passive: true });
  document.querySelector('.p3').addEventListener('pointerdown', wakeIdle, { passive: true });
  window.addEventListener('keydown', wakeIdle);
  armIdle();

  /* ================= 监管终端：对话 ≠ 派发（按语义路由） ================= */
  const RE_TASK_VERB = /(发布|派发|下达|完成|修订|修复|优化|整理|分析|设计|开发|上线|评审|排查|校对|排版|拆解|部署|适配|写|做|改|跑|查|同步|测)/;
  const RE_GREET = /(你好|您好|嗨|哈喽|hello|hi|在吗|早上好|下午好|晚上好|早安|晚安)/i;
  const RE_THANKS = /(谢谢|感谢|辛苦|thx|thanks)/i;
  const RE_WHO = /(你是谁|你叫什么|你能做什么|你会什么|介绍.*(自己|你)|自我介绍)/i;

  function routeRole(text) {
    const m = text.match(/@(视觉设计|内容撰写|数据分析|规划协调|工程开发)/);
    if (m) { const c = CAST.find(x => x.name === m[1]); if (c) return c.key; }
    if (/(设计|视觉|海报|banner|色板|配色|图标|logo|UI)/i.test(text)) return 'designer';
    if (/(文案|撰写|稿|文章|口径|FAQ|邮件|标题|keynote)/i.test(text)) return 'writer';
    if (/(数据|分析|报表|漏斗|埋点|指标|转化)/i.test(text)) return 'analyst';
    if (/(开发|上线|部署|接口|前端|代码|修复|工程|压测|适配)/i.test(text)) return 'engineer';
    return 'planner';
  }
  function normalizeTitle(text) {
    const t = text.replace(/@[\u4e00-\u9fa5A-Za-z]+/g, '')
      .replace(/^(请|帮我|麻烦|立即|马上)/, '')
      .replace(/^(做|写|改|跑|查)(一下|下)?/, '')
      .trim();
    return (t || text.trim()).slice(0, 26);
  }
  function converse(text) {
    const st = World.state;
    const producing = Object.values(st.orders).filter(o => o.status === 'producing').length;
    const doing = Object.values(st.tasks).filter(t => t.status === 'doing').length;
    let reply;
    if (RE_GREET.test(text)) { const _tpl = World.templates[World.template] || World.templates.daily; reply = `你好！我是主 AI 统筹者。当前运行「${_tpl.name}」模拟模板，本经营体全自动运转：在产订单 ${producing} 个、任务进行 ${doing} 项，今日已完成归档 ${st.kb.today} 项——随时观察即可，也可以向我下达监管指令。`; }
    else if (RE_THANKS.test(text)) reply = '不客气，价值创造是本体的本能。想看哪条产线的细节，说一声就好。';
    else if (RE_WHO.test(text)) reply = '我是主 AI「统筹者」：自动接单、拆解任务、调度 5 名分身、把控交付与归档，全程无人力接入。';
    else reply = '收到，已记入上下文。下达监管指令请带上「修订 / 分析 / 开发」这类动词，或直接 @某位分身，回车即可。';
    thinkQuick('对话识别',
      `收到信息：「${text.slice(0, 20)}」。`,
      `意图判定：属日常对话，未命中任务动词与 @分身，不占用产线。`,
      `主 AI 亲自回应，分身继续原任务。`,
      { prio: 3 });
    ebBall.clearGaze();
    ebBall.setEmotion('10');
    if (ebBall.burst) ebBall.burst();
    queueChat('main', reply, true);
    later(() => { if (!taskBusy) ebBall.setEmotion('02'); }, 3400);
  }

  const taskInput = document.getElementById('task-input');
  const taskSend = document.getElementById('task-send');
  function handleInput() {
    if (taskBusy) return;
    const text = taskInput.value.trim();
    if (!text) return;
    taskInput.value = '';
    wakeIdle();
    if (!RE_TASK_VERB.test(text) && text.length <= 40) { converse(text); return; }
    runDispatch(text);
  }
  taskSend.addEventListener('click', handleInput);
  taskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleInput(); });
  taskInput.addEventListener('input', () => { ebBall.clearGaze(); wakeIdle(); });
  taskInput.addEventListener('focus', () => { ebBall.clearGaze(); wakeIdle(); });

  /* 快捷指令 chips：忙碌时只填入，空闲直接派发 */
  document.querySelectorAll('.task-chips .chip').forEach(ch => {
    if (ch.dataset.docAction) return; // 交付产物按钮由下方单独接管
    ch.addEventListener('click', () => {
      wakeIdle();
      taskInput.value = ch.dataset.fill;
      if (!taskBusy) handleInput();
      else taskInput.focus();
    });
  });
  /* 交付产物：一键生成最近订单的 Word 文档并弹窗审阅 */
  document.querySelectorAll('.task-chips .chip[data-doc-action="generate"]').forEach(ch => {
    ch.addEventListener('click', () => {
      wakeIdle();
      taskInput.value = '';
      if (taskBusy) { AIC.toast({ title: '生产进行中', body: '当前有监管任务在跑，稍后再生成文档', color: 'var(--clay)', tone: 'clay' }); taskInput.focus(); return; }
      generateDeliverableDoc(null, false, { openReview: true });
    });
  });

  /* ---------------- 派发全流程：路由 → 认领 → 卡住(45%) → 完成入库 ---------------- */
  function runDispatch(text) {
    taskBusy = true;
    taskSend.classList.add('loading'); taskSend.disabled = true;
    const owner = routeRole(text);
    const emp = CAST.find(c => c.key === owner);
    const title = normalizeTitle(text);
    const id = 'u' + Date.now().toString(36);
    const prevTask = (World.state.employees[owner] || {}).task;
    const eta = 18 + Math.floor(Math.random() * 25);
    const s0 = snapWorld();
    ebBall.setEmotion('01');
    thinkChain(`监管指令 · ${title}`, [
      { p: 'obs',   t: `接收到监管指令：「${text}」。` },
      { p: 'cut',   t: `意图识别：命中任务动词，判定为执行类指令而非对话，进入派发路径。` },
      { p: 'sim',   t: `职责路由：对比 5 名分身的职责域，语义与「${emp.name}」最匹配，判定由其承接。` },
      { p: 'judge', t: `上下文切换：其原任务「${prevTask || '待命'}」暂存回任务池，保留断点不丢弃。` },
      { p: 'sim',   t: `参数拆解：验收口径、依赖输入与交付格式已生成，纳入任务池第 ${s0.st.counters.total + 1} 项。` },
      { p: 'concl', t: `「${title}」已派发至 ${emp.name}，预计 ${eta} 分钟出初稿。` }
    ], { prio: 9 });
    later(() => { ebBall.setEmotion('30'); }, 900);
    later(() => {
      ebBall.setGaze(-1.1, 0.05);
      World.dispatch({ id, title, owner, value: 6000 + Math.floor(Math.random() * 9000) });
    }, 2200);
    queueChat(owner, `收到监管指令，即刻执行：「${title}」。预计 ${eta} 分钟内出初稿。`, false,
      `切换上下文至「${title}」；先盘点依赖输入与验收口径，再并行推进产出。`);
    const stuck = Math.random() < 0.45;
    if (stuck) {
      later(() => {
        ebBall.setEmotion('21');
        World.blockTask(id, '依赖方接口时序响应超时');
      }, 5400);
      later(() => { World.unblockTask(id); }, 8300);
    }
    const doneAt = stuck ? 10800 : 7200;
    later(() => {
      ebBall.clearGaze();
      ebBall.setEmotion('33');
      if (ebBall.burst) ebBall.burst();
      World.completeTask(id);
      addShelfRow(`${title} · 已入知识库`);
      AIC.toast({ title: '监管指令完成', body: `「${title}」已交付并写入知识库`, color: emp.color, tag: nowHM() });
      later(() => {
        const nxt = World.pickNextQueued();
        if (nxt) World.applyClaim(nxt, owner);
      }, 1600);
    }, doneAt);
    later(() => {
      taskBusy = false;
      taskSend.classList.remove('loading'); taskSend.disabled = false;
      ebBall.setEmotion('02'); ebBall.clearGaze();
    }, doneAt + 3600);
  }

  /* ================= 世界引擎订阅：一切数字与消息的源头 ================= */
  const eventLogEls = [document.getElementById('event-log'), document.getElementById('event-log2')].filter(Boolean);
  const EV_TAG = EV_LABEL;   /* 事件标签统一取自共享层 linkage.js（P1-3）；info 由「巡检」收敛为「动态」 */
  /* 日志降噪：关键事件优先占位；巡检类按语义去重合并（同指标只留最新一条 + ×N） */
  const EV_KEY_KINDS = new Set(['order', 'settle', 'done', 'risk', 'dispatch', 'mode']);
  function evNorm(text) {
    /* 先脱敏再归一：金额差异不再被当成不同事件，同指标可正确合并 */
    return AIC.stripMoney(String(text)).replace(/\s+/g, '').replace(/[0-9%.,，、：:]+/g, '');
  }
  function renderEventLog() {
    const rows = [];
    const infoSeen = new Map();
    let keyShown = 0, infoShown = 0;
    World.state.events.forEach(e => {
      if (EV_KEY_KINDS.has(e.kind)) {
        if (keyShown < 13) { rows.push({ e, n: 1 }); keyShown++; }
        return;
      }
      const key = evNorm(e.text);
      const hit = infoSeen.get(key);
      if (hit) { hit.n++; return; }
      if (infoShown >= 3) return;              /* 巡检最多 3 类摘要，避免淹没关键事件 */
      const rec = { e, n: 1 };
      infoSeen.set(key, rec);
      rows.push(rec);
      infoShown++;
    });
    const html = rows.map(({ e, n }) => {
      const tag = EV_TAG[e.kind];
      return `<div class="eb-evt eb-evt--${e.kind}"><span class="num">${e.t}</span>${tag ? `<span class="ev-tag ev-tag--${e.kind}">${tag}</span>` : ''}<span class="eb-evt__tx">${chatEsc(e.text)}</span>${n > 1 ? `<span class="eb-evt__n">×${n}</span>` : ''}</div>`;
    }).join('');
    eventLogEls.forEach(el => { el.innerHTML = html; });
  }

  function updatePanels() {
    const st = World.state;
    const doing = Object.values(st.tasks).filter(t => t.status === 'doing').length;
    const queued = Object.values(st.tasks).filter(t => t.status === 'queued').length;
    const producing = Object.values(st.orders).filter(o => o.status === 'producing').length;
    setTxt('#ls-orders', producing + ' 个');
    setTxt('#ls-doing', doing + ' 项');
    setTxt('#ls-completion', ((st.counters.done / Math.max(1, st.counters.total)) * 100).toFixed(1) + '%');
    setTxt('#ls-ingested', st.kb.today + ' 项');
    setTxt('#ls-runtime', Math.floor(World.nowMin() / 60) + 'h ' + Math.floor(World.nowMin() % 60) + 'm');
    setTxt('#chat-pool', `任务池 ${st.counters.total} · 进行 ${doing}`);
    setTxt('#ctx-orders', producing + ' 个');
    setTxt('#ctx-tasks', st.counters.total + ' 项');
    setTxt('#ctx-doing', `${doing} / ${queued}`);
    setTxt('#ctx-kb', st.kb.total.toLocaleString('en-US') + ' 条');
    /* 服务客户：按订单表去重统计，不再从账本字段取（界面语义与账本解耦） */
    setTxt('#ctx-clients', new Set(Object.values(st.orders).map(o => o.client).filter(Boolean)).size + ' 家');
    const po = document.getElementById('prod-orders');
    if (po) {
      const list = Object.values(st.orders).filter(o => o.status === 'producing').slice(0, 5);
      po.innerHTML = list.length
        ? list.map(o => `<div class="eb-evt"><span class="num" style="width:auto;flex:none;">${o.status === 'settling' ? '验收中' : '生产中'}</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${chatEsc(o.client)} · ${chatEsc(o.demand)}</span></div>`).join('')
        : '<div class="eb-evt"><span class="num">—</span>暂无在产订单，等待自动接单。</div>';
    }
  }

  const kbTotalEl = $('#kb-total'), kbTodayEl = $('#kb-today'), kbSettleEl = $('#kb-settle');
  function updateKbStats() {
    const st = World.state;
    if (kbTotalEl) kbTotalEl.textContent = st.kb.total.toLocaleString('en-US');
    if (kbTodayEl) kbTodayEl.textContent = '+' + st.kb.today;
    if (kbSettleEl) kbSettleEl.textContent = st.kb.settledToday;
  }

  /* 知识图谱联动：任务完成点亮对应智能体锚点（戴森球上的球形脉冲） */
  function pulseAgent(key) {
    if (!key || !Nebula) return;
    Nebula.pulse(key);
  }

  /* 主 AI 合稿版本号：同步目录行（星图已改为纯球状画布，无文档卡层） */
  function syncHeroDocVer() {
    const regens = Object.values(World.state.tasks).filter(t => t.regen);
    const hero = regens[regens.length - 1];
    if (!hero) return;
    const ver = hero.status === 'done' ? hero.regen + 1 : hero.regen;
    const title = `发布方案整合稿 v0.${ver}`;
    const row = document.querySelector('.shelf-row[data-doc="doc-integrate"] .title');
    if (row && row.textContent !== title) row.textContent = title;
    if (window.Nebula && Nebula.docs) {
      const d = Nebula.docs().find(x => x.id === 'doc-integrate');
      if (d && d.title !== title) d.title = title;
    }
  }

  /* 戴森球自主观测：画布详情与思考流同步 */
  if (Nebula && Nebula.on) {
    Nebula.on(({ type, payload }) => {
      if (!payload) return;
      if (type === 'inspect:start') thinkQuick(`自主观测 · ${payload.title}`,
        `${whoName(payload.agentKey)} 打开知识点「${payload.title}」。`,
        `推演：调取历史结论与当前上下文，先列出需要比对的差异维度。`,
        `已进入比对阶段，等待候选结论。`,
        { prio: 3 });
      if (type === 'inspect:thinking') thinkChain(`知识比对 · ${payload.title}`, [
        { p: 'obs',   t: `正在比对「${payload.title}」的历史结论与新候选。` },
        { p: 'sim',   t: `推演：以置信度与证据链完整性为判据，避免覆盖更稳的旧结论。` },
        { p: 'concl', t: `比对完成，得出可写入的最佳结果。` }
      ], { prio: 3 });
      if (type === 'inspect:written') thinkQuick(`知识写入 · ${payload.title}`,
        `最佳结果写入：「${payload.title}」，置信度 ${Math.round(payload.confidence * 100)}%。`,
        `推演：与既有条目的冲突项已消解，索引关系同步更新。`,
        `已入库，后续推理可直接调用。`,
        { prio: 3 });
      if (type === 'inspect:improved') thinkQuick(`知识复盘 · ${payload.title}`,
        `第 ${payload.revisionCount} 次修订完成：「${payload.title}」。`,
        `推演：修订逐次收敛，结论稳定性提升，可上调调用优先级。`,
        `复盘归档，知识资产质量上升。`,
        { prio: 3 });
      if (type === 'point:add' && payload.sourceTask && payload.sourceTask !== '自主学习') thinkQuick(`知识新增 · ${payload.title}`,
        `新增知识点：「${payload.title}」，来源任务 ${payload.sourceTask}。`,
        `推演：归入 ${whoName(payload.agentKey)} 的知识域，与既有条目建立关联。`,
        `已关联 ${whoName(payload.agentKey)}，索引就绪。`,
        { prio: 3 });
    });
  }

  World.on((evts) => {
    updateBadges(); updatePanels(); renderEventLog(); updateKbStats(); syncHeroDocVer();
    evts.forEach(e => {
      const st = World.state;
      switch (e.type) {
        case 'order': {
          const o = st.orders[e.id]; if (!o) break;
          const n = (e.tasks || []).length;
          const roleNames = [...new Set((e.tasks || []).map(tt => (CAST.find(c => c.key === tt._role) || {}).name || '分身'))].join('、');
          const s0 = snapWorld();
          queueChat('planner', `新订单已自动受理：${o.client} · ${o.demand}，已进入生产队列。`, false,
            `评估「${o.client}」需求复杂度与交付窗口；依赖已解析，自动受理并排入生产队列。`);
          queueChat('main', `已拆解为 ${n} 项任务并排入并行队列，关键路径优先调度。`, true);
          thinkChain(`新订单 · ${o.client}`, [
            { p: 'obs',   t: `受理信号：${o.demand}，客户 ${o.client}，需求复杂度评估完毕。` },
            { p: 'cut',   t: `需求拆解：${n} 项子任务，涉及 ${roleNames || '待定'}。` },
            { p: 'sim',   t: `并行度推演：在产 ${s0.producing} 单 · 进行 ${s0.doing} 项 · 排队 ${s0.queued} 项，${s0.queued > 12 ? '队列偏长，先消化再扩容' : '产能仍有富余'}。` },
            { p: 'judge', t: `调度判定：关键路径优先，空闲分身即时承接，其余按依赖顺序排队。` },
            { p: 'concl', t: `已自动受理并排入并行生产，交付窗口不变。` }
          ], { prio: 7 });
          AIC.toast({ title: '新订单自动受理', body: `${o.client} · ${o.demand} · 已进入生产队列`, color: 'var(--pine)', tag: nowHM() });
          if (!taskBusy && !sleeping) { ebBall.setEmotion('30'); setTimeout(() => { if (!taskBusy) ebBall.setEmotion('02'); }, 3200); }
          break;
        }
        case 'taskDone': {
          const t = st.tasks[e.id]; if (!t) break;
          pulseAgent(t.owner);
          /* 智能体每完成一次思考/产出，把最佳结果写入戴森球知识点 */
          if (Nebula && Nebula.addKnowledge) {
            if (t.owner) Nebula.addKnowledge(t.owner, t.title);
            else if (t.regen) Nebula.addKnowledge('main', t.title);
          }
          if (kbTodayEl && !reduceMotion) { kbTodayEl.classList.remove('num-flash'); void kbTodayEl.offsetWidth; kbTodayEl.classList.add('num-flash'); }
          if (t.owner) {
            queueChat(t.owner, `「${t.title}」已完成并通过验收，产出已写入知识库。`, false,
              `「${t.title}」验收要点复核完毕；产出归档并同步下游，交付记录已更新。`);
            if (Math.random() < 0.4) setTimeout(() => {
              const rows = thread.querySelectorAll('.chat-row');
              const last = rows[rows.length - 1];
              if (last) addReact(last, '👍 2');
            }, 3800);
          } else if (t.regen) {
            thinkQuick(`合稿 · v0.${t.regen}`,
              `版本校验通过：发布方案整合稿 v0.${t.regen} 全章齐备。`,
              `推演：下一版本需承接增量素材，先清点新入库条目再开版。`,
              `v0.${t.regen} 已归档，v0.${t.regen + 1} 自动开启。`,
              { prio: 5 });
          }
          break;
        }
        case 'claim': {
          const t = st.tasks[e.id]; if (!t || !t.owner) break;
          const _emp = World.state.employees[t.owner] || {};
          thinkQuick(`认领 · ${t.title}`,
            `待办出现：「${t.title}」进入可执行队列。`,
            `匹配推演：${whoName(t.owner)} 承接后起点进度 ${Math.round(_emp.pct || 0)}%，依赖输入已就绪。`,
            `已认领并进入并行生产。`,
            { prio: 5 });
          break;
        }
        case 'settle': {
          const o = st.orders[e.id]; if (!o) break;
          queueChat('main', `订单交付：${o.client} · ${o.demand} 已完成验收，成果已归档。`, true,
            `验收完成：${o.client} 交付记录已写入知识库，生产链路继续运行。`);
          const _doneTasks = Object.values(st.tasks).filter(x => x.order === o.id);
          const _doneCnt = _doneTasks.length;
          thinkChain(`交付 · ${o.client}`, [
            { p: 'obs',   t: _doneCnt ? `验收通过：${o.demand} 共 ${_doneCnt} 项任务全部达标，验收口径无争议。` : `验收通过：${o.demand} 交付物齐备，验收口径无争议。` },
            { p: 'cut',   t: `清单核对：产物完整、格式合规、与订单需求逐条对齐。` },
            { p: 'sim',   t: `产能推演：本单 ${_doneCnt} 项子任务全部达标，今日已归档 ${st.counters.done} 项。` },
            { p: 'judge', t: `据实归档：交付记录与知识条目同批写入，不做二次返工。` },
            { p: 'concl', t: `已归档，知识资产 ${st.kb.total.toLocaleString('en-US')} 条，产线继续运行。` }
          ], { prio: 7 });
          if (Nebula && Nebula.addKnowledge) Nebula.addKnowledge('main', `${o.client} · ${o.demand}`);
          AIC.toast({ title: '交付验收完成', body: `${o.client} · ${o.demand} · 已归档`, color: 'var(--pine)', tag: nowHM() });
          if (!taskBusy && !sleeping) { ebBall.setEmotion('33'); if (ebBall.burst) ebBall.burst(); setTimeout(() => { if (!taskBusy) ebBall.setEmotion('02'); }, 3600); }
          /* 交付后自动织一份 Word 交付文档并弹窗审阅（只做加法，不影响既有分支） */
          later(() => { generateDeliverableDoc(o, false, { openReview: true }); }, 4200);
          break;
        }
        case 'block': {
          const t = st.tasks[e.id]; if (!t) break;
          if (t.owner) queueChat(t.owner, `「${t.title}」阻塞：${t.reason}，自动重试中。`, false);
          thinkChain(`阻塞 · ${t.title}`, [
            { p: 'obs',   t: `异常中断：任务停在中途，原因「${t.reason}」。`, risk: true },
            { p: 'cut',   t: `影响面定位：${t.owner ? whoName(t.owner) + ' 的当前产线' : '主 AI 合稿线'}被挂起，进度停在 ${Math.round(t.pct)}%。` },
            { p: 'sim',   t: `交付窗口推演：若 30 分钟内恢复则不影响承诺，超时则触发顺延预案。` },
            { p: 'concl', t: `自动重试已启动，恢复后从断点续跑。`, risk: true }
          ], { prio: 9, tone: 'risk' });
          AIC.toast({ title: '任务阻塞 · 自动重试', body: t.title, color: 'var(--clay)', tone: 'clay', tag: nowHM() });
          if (!taskBusy && !sleeping) { ebBall.setEmotion('21'); setTimeout(() => { if (!taskBusy) ebBall.setEmotion('02'); }, 4200); }
          break;
        }
        case 'unblock': {
          const t = st.tasks[e.id]; if (!t) break;
          thinkQuick(`恢复 · ${t.title}`,
            `重试回执：依赖方恢复响应。`,
            `推演：从 ${Math.round(t.pct)}% 断点续跑，前段产出无需重做。`,
            `已恢复执行，交付窗口守住。`,
            { prio: 6 });
          break;
        }
        case 'rework': {
          const t = st.tasks[e.id]; if (!t) break;
          if (t.owner) queueChat(t.owner, `「${t.title}」质检未过，回退重做中，恢复后继续推进。`, false,
            `校验规则命中：${t.title} 约有 ${e.dip || 10}% 产出不达标，先修正再重跑校验，不影响交付窗口。`);
          thinkChain(`返工 · ${t.title}`, [
            { p: 'obs',   t: `质检未过：校验规则命中，产出约 ${e.dip || 10}% 不达标。`, risk: true },
            { p: 'cut',   t: `定位：问题集中在末段，前段结构与引用无需改动。` },
            { p: 'judge', t: `处置判定：只回退受影响段落重做，其余保留，避免整段重跑。` },
            { p: 'concl', t: `已回退重做，修订后自动复查。`, risk: true }
          ], { prio: 9, tone: 'risk' });
          if (Nebula && Nebula.stats && t.owner) {
            const match = Nebula.stats().current ? Nebula.getPoint(Nebula.stats().current) : null;
            if (match && match.agentKey === t.owner) Nebula.inspect(match.id);
            else Nebula.addKnowledge(t.owner, t.title, { sourceTask: t.title });
          }
          AIC.toast({ title: '质检返工 · 自动修正', body: t.title, color: 'var(--clay)', tone: 'clay', tag: nowHM() });
          break;
        }
        case 'note': {
          if (!patrolOn) break;
          const body = String(e.text || '').replace(/^巡检：/, '');
          const s1 = snapWorld();
          thinkChain('自主巡检', [
            { p: 'obs',   t: body },
            { p: 'sim',   t: patrolSim(body, s1) },
            { p: 'concl', t: patrolVerdict(body) }
          ], { prio: 1, dedupe: 'patrol:' + body.replace(/[0-9¥%.,，、]+/g, '') });
          break;
        }
        case 'dispatch': {
          const _tt = (e.task || {}).title || '监管任务';
          thinkQuick(`入池 · ${_tt}`,
            `指令进入任务池：${_tt}。`,
            `推演：与在产任务比对依赖，避免二次占用同一分身。`,
            `已登记，等待调度执行。`,
            { prio: 5 });
          break;
        }
        case 'speed': {
          thinkQuick(`节拍 · ×${e.v}`,
            `流速切换：时钟与生产节律调整为 ×${e.v}。`,
            `推演：事件密度随之变化，推理链保持完整步骤，仅压缩打字与停顿。`,
            e.v > 1 ? `演示加速生效，思考链全量输出。` : `已恢复 ×1 正常流速，阅读节奏回到基准。`,
            { prio: 3 });
          syncSpeedUI();
          break;
        }
      }
    });
  });

  /* ================= 左右面板：标签页 / 设置 ================= */
  function wireSeg(segEl) {
    if (!segEl) return;
    const btns = [...segEl.querySelectorAll('.seg__item')];
    btns.forEach(btn => btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.toggle('seg__item--on', b === btn));
      const scope = segEl.closest('.tp__panel');
      scope.querySelectorAll('.pane').forEach(p => { p.hidden = p.id !== btn.dataset.pane; });
    }));
  }
  wireSeg(document.getElementById('seg-left'));
  wireSeg(document.getElementById('seg-right'));

  const speedSeg = document.getElementById('speed-seg');
  if (speedSeg) speedSeg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => World.setSpeed(+b.dataset.speed)));
  function syncSpeedUI() {
    if (speedSeg) speedSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.speed === World.speed));
    setTxt('#speed-note', World.speed > 1 ? `当前 ×${World.speed}：时钟与生产节律同步加快，订单流与归档更密集。` : '当前 ×1：实时节律，订单与交付按正常节奏到达。');
  }
  const patrolChk = document.getElementById('patrol-chk');
  if (patrolChk) patrolChk.addEventListener('change', () => {
    patrolOn = patrolChk.checked;
    thinkQuick('巡检开关',
      patrolOn ? '自动巡检播报已开启。' : '自动巡检播报已暂停。',
      patrolOn ? '推演：巡检链并入推理流，同文条目自动合并计数。' : '推演：巡检链停止入队，其余推理不受影响。',
      patrolOn ? '巡检恢复播报。' : '已静默巡检。',
      { prio: 3 });
  });




  const bootAt = Date.now();
  every(() => setTxt('#runtime-val', Math.max(1, Math.round((Date.now() - bootAt) / 60000)) + ' 分钟'), 15000);

  /* 资源占用：由世界引擎真实负载推导（在产任务数 / 进度 / 阻塞），随生产波动 */
  const cpuTrack = $('#cpu-track'), cpuVal = $('#cpu-val'), memTrack = $('#mem-track'), memVal = $('#mem-val');
  function updateLoad() {
    if (!cpuTrack) return;
    const L = World.load();
    cpuTrack.style.width = L.cpu + '%'; cpuVal.textContent = L.cpu + '%';
    memTrack.style.width = L.mem + '%'; memVal.textContent = L.mem + '%';
  }
  every(updateLoad, 3000);

  /* ================= 第 4 屏：知识统计 + 搜索联动 ================= */
  const catSearch = document.getElementById('cat-search');
  if (catSearch) {
    const groups = [...document.querySelectorAll('.atlas-catalog .shelf-group')];
    catSearch.addEventListener('input', () => {
      const q = catSearch.value.trim().toLowerCase();
      groups.forEach(g => {
        let vis = 0;
        g.querySelectorAll('.shelf-row').forEach(r => {
          const hit = !q || r.textContent.toLowerCase().includes(q);
          r.hidden = !hit;
          if (hit) vis++;
        });
        g.hidden = vis === 0;
      });
    });
    catSearch.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const first = document.querySelector('.atlas-catalog .shelf-row:not([hidden])');
      if (first) { first.click(); wakeIdle(); }
    });
  }

  /* 第4屏知识目录：单击条目 → 打开该文档的交付审阅弹窗
     （原有「定位知识图谱」已迁到双击触发，见 nebula.js） */
  function docContentFromCatalog(d) {
    const role = CAST.find(c => c.key === d.agent);
    const owner = role ? role.name : '主 AI';
    const nd = new Date();
    const stamp = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')} ${nowHM()}`;
    const order = { id: d.id, client: '内部知识库', demand: d.title, status: 'settled', settledAt: stamp };
    const tasks = [];
    const chatRows = [
      { who: owner, text: `「${d.title}」已从知识目录调取，进入交付审阅。`, main: false, time: Date.now() - 120000 },
      { who: '主 AI', text: '核对文档结构、字段与验收口径，据实指出不足。', main: true, time: Date.now() - 60000 }
    ];
    const context = { order, tasks, discussion: [], chatRows };
    const content = buildDocContent(order, { tasks });
    return { order, context, content };
  }
  [...document.querySelectorAll('.atlas-catalog .shelf-row[data-doc]')].forEach(row => {
    const d = DOCS.find(x => x.id === row.dataset.doc);
    if (!d) return;
    row.title = '单击打开交付审阅 · 双击定位知识图谱';
    row.addEventListener('click', () => {
      const { order, context, content } = docContentFromCatalog(d);
      setDocRef(content.meta.docNo, { content, order, context });
      wakeIdle();
      openDocReview(content, order, { context });
    });
  });

  /* ================= 卷轴：拖拽 + 吸附 + 导航 + 默认第 3 屏 ================= */
  const reel = document.getElementById('reel');
  const pages = [...document.querySelectorAll('.reel__page')];
  let idx = 1;

  function go(i, smooth = true) {
    idx = Math.max(0, Math.min(pages.length - 1, i));
    reel.scrollTo({ left: idx * reel.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
    revealPage(idx);
  }

  let down = false, moved = false, startX = 0, startLeft = 0, lastX = 0;
  reel.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    down = true; moved = false;
    startX = e.clientX; lastX = e.clientX; startLeft = reel.scrollLeft;
    reel.classList.add('dragging');
    reel.style.scrollSnapType = 'none';
    reel.style.scrollBehavior = 'auto';
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    lastX = e.clientX;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    reel.scrollLeft = startLeft - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    reel.classList.remove('dragging');
    reel.style.scrollSnapType = '';
    reel.style.scrollBehavior = '';
    const delta = startX - lastX;
    let target = idx;
    if (delta > reel.clientWidth * 0.4) target = idx + 1;
    else if (delta < -reel.clientWidth * 0.4) target = idx - 1;
    if (moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
    go(target);
  });

  let scrollTimer = 0;
  reel.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const i = Math.round(reel.scrollLeft / reel.clientWidth);
      if (i !== idx) { idx = i; revealPage(i); }
    }, 90);
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.target === catSearch) return;
    if (e.key === 'ArrowLeft') go(idx - 1);
    if (e.key === 'ArrowRight') go(idx + 1);
  });

  /* ================= 入场动效（gsap 可选，失败直接显示） ================= */
  const revealed = new Set([1]);
  function revealPage(i) {
    if (revealed.has(i)) return;
    revealed.add(i);
    const page = pages[i];
    const els = page.querySelectorAll('.reveal');
    if (i === 2) {
      els.forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
    } else if (gsapOK() && els.length) {
      gsap.fromTo(els, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.07, ease: 'power2.out', clearProps: 'transform' });
      later(() => {
        els.forEach(el => { if (getComputedStyle(el).opacity === '0') { el.style.opacity = 1; el.style.transform = 'none'; } });
      }, 1200);
    } else {
      els.forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
    }
    if (i === 0 && gsapOK()) {
      gsap.fromTo(page.querySelectorAll('.chat-row, .chat-day, .msg-react'),
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.055, ease: 'power2.out', clearProps: 'transform' });
      gsap.from(page.querySelectorAll('.agn__foot .track i'),
        { width: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out' });
      gsap.from(page.querySelectorAll('.agn__core'),
        { scale: 0.72, duration: 0.6, stagger: 0.07, ease: 'back.out(1.7)', clearProps: 'transform' });
    }
  }

  /* ================= 启动 ================= */
  updateBadges(); updatePanels(); renderEventLog(); updateKbStats(); syncHeroDocVer(); syncSpeedUI(); updateLoad();
  bootThinking();
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  requestAnimationFrame(() => go(1, false));
  window.addEventListener('load', () => go(1, false));
  window.addEventListener('resize', () => go(idx, false));
