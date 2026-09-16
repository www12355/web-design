// ============================================================
// window2.html 控制器：横向卷轴（第 2/3/4 屏）
// 纯 ES 模块：AIC / World / Nebula 由 import 引入，
// Bloub / EmotionBall / gsap 为经典全局脚本注入。
// ============================================================
import { AIC } from '../modules/common.js';
import { World } from '../modules/world.js';
import { Nebula } from '../modules/nebula.js';
import { hmAgo } from '../modules/time.js';

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

  /* ================= 真实时间：把模板里静态的时间标签对齐到当前时钟 ================= */
  (function normalizeStaticTimes() {
    /* 群聊时间轴（今天 + 消息时间）：按 DOM 顺序从较早逼近「现在」 */
    const tEls = [...document.querySelectorAll('.chat-day, .bubble__time')];
    tEls.forEach((el, i) => {
      const ago = Math.max(0, 40 - i * 2);
      const t = hmAgo(ago);
      if (el.classList.contains('chat-day')) el.textContent = `今天 ${t}`;
      else el.textContent = t;
    });
    /* 思考标注「思考 · HH:MM」 */
    document.querySelectorAll('.bubble__think b').forEach((b, i) => {
      b.innerHTML = b.innerHTML.replace(/(思考 · )\d{2}:\d{2}/, `$1${hmAgo(Math.max(0, 36 - i * 2))}`);
    });
    /* 知识目录入库时间 */
    document.querySelectorAll('.shelf-row .meta .num').forEach((el, i) => {
      el.textContent = hmAgo(2 + i * 3);
    });
    /* 焦点卡「已验收 · 写入知识库 · HH:MM」 */
    document.querySelectorAll('p').forEach(p => {
      if (p.textContent.indexOf('写入知识库') >= 0) {
        p.innerHTML = p.innerHTML.replace(/(写入知识库 · )\d{2}:\d{2}/, `$1${hmAgo(1)}`);
      }
    });
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
      <span class="agn__sw"><i style="background:${m.color}"></i><i style="background:#1f6f5c"></i><i style="background:#c96f4a"></i><i style="background:#d8c98f"></i></span>
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
    const botEl = el.querySelector('.agn__core .bot');
    if (botEl && Bloub.mount) {
      badgeAvatars[m.key] = Bloub.mount(botEl, {
        size: 56, shape: m.shape, ink: m.color, expression: avatarExpression(m, st.status),
        state: avatarState(st.status), cycle: AVATAR_CYCLES[m.key], paper: '#f5f2ea', speed: 0.92 + i * 0.06
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

  /* 聊天头部主 AI（白色小球，暖底可读） */
  Bloub.mount(document.getElementById('chat-main'), {
    size: 40, shape: 'cercle', ink: '#ffffff', expression: 'attentif', state: 'idle', paper: '#d8d0bf'
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
  function queueChat(who, text, isMain, think) { chatQ.push({ who, text, isMain, think }); drainChat(); }
  function drainChat() {
    if (draining || !chatQ.length) return;
    draining = true;
    const m = chatQ.shift();
    showTyping(m.who);
    setTimeout(() => {
      hideTyping();
      const row = addChatRow(m.who, m.text, m.isMain, m.think);
      draining = false;
      drainChat();
      return row;
    }, 1000 + Math.random() * 1500);
  }
  function addChatRow(who, text, isMain, think) {
    const row = document.createElement('div');
    row.className = 'chat-row' + (isMain ? ' chat-row--ai' : '');
    const av = document.createElement('span');
    av.className = 'avatar-slot' + (who === 'main' ? ' bot-white' : '');
    av.title = whoName(who);
    av.innerHTML = Bloub.static({ size: 34, expression: 'neutre', state: 'idle', ...AVATAR_MAP[who] });
    const b = document.createElement('div');
    b.className = 'bubble' + (isMain ? ' bubble--ai' : '');
    b.innerHTML = `${think ? `<div class="bubble__think"><b><svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.6.5 1 1.2 1 2h6c0-.8.4-1.5 1-2A6 6 0 0012 3z"/></svg>思考 · ${World.timeHM()}</b>${think}</div>` : ''}${text}<div class="bubble__time">${World.timeHM()}</div>`;
    row.append(av, b);
    thread.appendChild(row);
    const rows = thread.querySelectorAll('.chat-row');
    if (rows.length > 46) rows[0].remove();
    thread.scrollTop = thread.scrollHeight;
    if (chatCount) chatCount.textContent = rows.length;
    if (gsapOK()) gsap.from(row, { y: 12, autoAlpha: 0, duration: 0.4, ease: 'power2.out' });
    return row;
  }
  function addReact(row, txt) {
    if (!row || !row.after) return;
    setTimeout(() => {
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
      <span class="shelf-ic"><svg class="ic ic--sm" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></span>
      <span class="title">${title}</span>
      <div class="meta"><span class="tag">整合</span><span class="num">${World.timeHM()}</span><span class="pill">DOC</span></div>`;
    group.insertBefore(row, group.querySelector('.shelf-row'));
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (gsapOK()) gsap.from(row, { backgroundColor: 'rgba(31,111,92,0.16)', duration: 1.8, ease: 'power2.out' });
  }

  /* ================= 思考流（打字机，常驻 live 行吸底） ================= */
  const thinkPane = document.getElementById('think');
  function addThinkLine(text, kind) {
    if (!thinkPane || !text) return;
    const line = document.createElement('div');
    line.className = 'eb-think' + (kind === 'risk' ? ' eb-think--risk' : '');
    line.innerHTML = `<svg viewBox="0 0 24 24"><path d="${kind === 'risk' ? 'M12 8v4M12 16h.01M12 3a9 9 0 100 18 9 9 0 000-18z' : 'M20 6L9 17l-5-5'}"/></svg><span class="eb-think__tx"></span>`;
    const live = thinkPane.querySelector('.eb-think--live');
    if (live) thinkPane.insertBefore(line, live); else thinkPane.appendChild(line);
    const lines = thinkPane.querySelectorAll('.eb-think');
    if (lines.length > 30) lines[0].remove();
    thinkPane.scrollTop = thinkPane.scrollHeight;
    const tx = line.querySelector('.eb-think__tx');
    if (reduceMotion) { tx.textContent = text; return; }
    let i = 0;
    const ti = setInterval(() => {
      i += 2;
      tx.textContent = text.slice(0, i);
      thinkPane.scrollTop = thinkPane.scrollHeight;
      if (i >= text.length) clearInterval(ti);
    }, 24);
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
      setTimeout(() => { if (!sleeping && !taskBusy) ebBall.setEmotion('02'); }, 900);
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
    addThinkLine(`识别为对话：「${text.slice(0, 20)}」，主 AI 亲自回应（不派发分身）。`);
    ebBall.clearGaze();
    ebBall.setEmotion('10');
    if (ebBall.burst) ebBall.burst();
    queueChat('main', reply, true);
    setTimeout(() => { if (!taskBusy) ebBall.setEmotion('02'); }, 3400);
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
    ch.addEventListener('click', () => {
      wakeIdle();
      taskInput.value = ch.dataset.fill;
      if (!taskBusy) handleInput();
      else taskInput.focus();
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
    ebBall.setEmotion('01');
    addThinkLine(`接收到监管指令：${text}`);
    setTimeout(() => { ebBall.setEmotion('30'); addThinkLine(`识别执行分身：${emp.name} · 拆解执行参数…`); }, 900);
    setTimeout(() => {
      ebBall.setGaze(-1.1, 0.05);
      World.dispatch({ id, title, owner, value: 6000 + Math.floor(Math.random() * 9000) });
      addThinkLine(`「${title}」已派发至 ${emp.name}，其原任务暂存回任务池。`);
    }, 2200);
    queueChat(owner, `收到监管指令，即刻执行：「${title}」。预计 ${18 + Math.floor(Math.random() * 25)} 分钟内出初稿。`, false,
      `切换上下文至「${title}」；先盘点依赖输入与验收口径，再并行推进产出。`);
    const stuck = Math.random() < 0.45;
    if (stuck) {
      setTimeout(() => {
        ebBall.setEmotion('21');
        World.blockTask(id, '依赖方接口时序响应超时');
      }, 5400);
      setTimeout(() => { World.unblockTask(id); }, 8300);
    }
    const doneAt = stuck ? 10800 : 7200;
    setTimeout(() => {
      ebBall.clearGaze();
      ebBall.setEmotion('33');
      if (ebBall.burst) ebBall.burst();
      World.completeTask(id);
      addShelfRow(`${title} · 已入知识库`);
      AIC.toast({ title: '监管指令完成', body: `「${title}」已交付并写入知识库`, color: emp.color, tag: World.timeHM() });
      setTimeout(() => {
        const nxt = World.pickNextQueued();
        if (nxt) World.applyClaim(nxt, owner);
      }, 1600);
    }, doneAt);
    setTimeout(() => {
      taskBusy = false;
      taskSend.classList.remove('loading'); taskSend.disabled = false;
      ebBall.setEmotion('02'); ebBall.clearGaze();
    }, doneAt + 3600);
  }

  /* ================= 世界引擎订阅：一切数字与消息的源头 ================= */
  const eventLogEls = [document.getElementById('event-log'), document.getElementById('event-log2')].filter(Boolean);
  const EV_TAG = { order: '签约', settle: '结算', done: '交付', risk: '风险', dispatch: '派发', mode: '模板', info: '巡检' };
  function renderEventLog() {
    const html = World.state.events.slice(0, 16).map(e => {
      const tag = EV_TAG[e.kind];
      return `<div class="eb-evt eb-evt--${e.kind}"><span class="num">${e.t}</span>${tag ? `<span class="ev-tag ev-tag--${e.kind}">${tag}</span>` : ''}<span class="eb-evt__tx">${e.text}</span></div>`;
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
    setTxt('#ctx-clients', st.ledger.clients + ' 家');
    const po = document.getElementById('prod-orders');
    if (po) {
      const list = Object.values(st.orders).filter(o => o.status === 'producing').slice(0, 5);
      po.innerHTML = list.length
        ? list.map(o => `<div class="eb-evt"><span class="num" style="width:auto;flex:none;">${o.status === 'settling' ? '验收中' : '生产中'}</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${o.client} · ${o.demand}</span></div>`).join('')
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

  /* 知识图谱联动：任务完成点亮对应角色节点（DOM 脉冲，不触碰画布内核） */
  function pulseAgent(key) {
    if (!key) return;
    const el = document.querySelector(`.gnode--agent[data-node="agent-${key}"]`);
    if (!el) return;
    el.classList.remove('gnode--pulse'); void el.offsetWidth; el.classList.add('gnode--pulse');
    setTimeout(() => el.classList.remove('gnode--pulse'), 1300);
  }

  /* 主 AI 合稿版本号：同步目录行 / 星图文档卡 / 焦点卡数据（随引擎滚动 bump） */
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
      if (d && d.title !== title) {
        d.title = title;
        const g = document.querySelector('.gnode--doc[data-node="doc-integrate"] .gnode__title');
        if (g) { g.textContent = title; g.title = title; }
      }
    }
  }

  World.on((evts) => {
    updateBadges(); updatePanels(); renderEventLog(); updateKbStats(); syncHeroDocVer(); syncTplCards();
    evts.forEach(e => {
      const st = World.state;
      switch (e.type) {
        case 'order': {
          const o = st.orders[e.id]; if (!o) break;
          const n = (e.tasks || []).length;
          queueChat('planner', `新订单已自动签约：${o.client} · ${o.demand}，已进入生产队列。`, false,
            `评估「${o.client}」需求复杂度与交付窗口；依赖已解析，自动签约并排入生产队列。`);
          queueChat('main', `已拆解为 ${n} 项任务并排入并行队列，关键路径优先调度。`, true);
          addThinkLine(`新订单：${o.client} · ${o.demand}，已自动签约并拆解 ${n} 项任务，进入并行生产。`);
          AIC.toast({ title: '新订单自动签约', body: `${o.client} · ${o.demand} · 已进入生产队列`, color: 'var(--pine)', tag: World.timeHM() });
          if (!taskBusy && !sleeping) { ebBall.setEmotion('30'); setTimeout(() => { if (!taskBusy) ebBall.setEmotion('02'); }, 3200); }
          break;
        }
        case 'taskDone': {
          const t = st.tasks[e.id]; if (!t) break;
          pulseAgent(t.owner);
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
            addThinkLine(`合稿 v0.${t.regen} 已归档，下一版本已自动开启。`);
          }
          break;
        }
        case 'claim': {
          const t = st.tasks[e.id]; if (!t || !t.owner) break;
          addThinkLine(`「${t.title}」已由 ${whoName(t.owner)} 认领，进入并行生产。`);
          break;
        }
        case 'settle': {
          const o = st.orders[e.id]; if (!o) break;
          queueChat('main', `订单交付：${o.client} · ${o.demand} 已完成验收，成果已归档。`, true,
            `验收完成：${o.client} 交付记录已写入知识库，生产链路继续运行。`);
          addThinkLine(`交付完成：${o.client} · ${o.demand} 已归档，知识资产持续增长。`);
          AIC.toast({ title: '交付验收完成', body: `${o.client} · ${o.demand} · 已归档`, color: 'var(--pine)', tag: World.timeHM() });
          if (!taskBusy && !sleeping) { ebBall.setEmotion('33'); if (ebBall.burst) ebBall.burst(); setTimeout(() => { if (!taskBusy) ebBall.setEmotion('02'); }, 3600); }
          break;
        }
        case 'block': {
          const t = st.tasks[e.id]; if (!t) break;
          if (t.owner) queueChat(t.owner, `「${t.title}」阻塞：${t.reason}，自动重试中。`, false);
          addThinkLine(`警告：${t.title} 阻塞（${t.reason}），自动重试中…`, 'risk');
          AIC.toast({ title: '任务阻塞 · 自动重试', body: t.title, color: 'var(--clay)', tone: 'clay', tag: World.timeHM() });
          if (!taskBusy && !sleeping) { ebBall.setEmotion('21'); setTimeout(() => { if (!taskBusy) ebBall.setEmotion('02'); }, 4200); }
          break;
        }
        case 'unblock': {
          const t = st.tasks[e.id]; if (!t) break;
          addThinkLine(`重试成功：「${t.title}」恢复执行。`);
          break;
        }
        case 'rework': {
          const t = st.tasks[e.id]; if (!t) break;
          if (t.owner) queueChat(t.owner, `「${t.title}」质检未过，回退重做中，恢复后继续推进。`, false,
            `校验规则命中：${t.title} 约有 ${e.dip || 10}% 产出不达标，先修正再重跑校验，不影响交付窗口。`);
          addThinkLine(`返工：${t.title} 校验未过，回退重做中…`, 'risk');
          AIC.toast({ title: '质检返工 · 自动修正', body: t.title, color: 'var(--clay)', tone: 'clay', tag: World.timeHM() });
          break;
        }
        case 'note': if (patrolOn) addThinkLine(e.text); break;
        case 'dispatch': addThinkLine(`监管指令已入池：${(e.task || {}).title || ''}`); break;
        case 'speed': {
          addThinkLine(e.v > 1 ? `演示加速 ×${e.v}：时钟与生产节律同步加快。` : '恢复 ×1 正常流速。');
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
    setTxt('#speed-note', World.speed > 1 ? `当前 ×${World.speed}：时钟与生产节律同步加快，订单与结算更密集。` : '当前 ×1：实时节律，订单与结算按正常节奏到达。');
  }
  const patrolChk = document.getElementById('patrol-chk');
  if (patrolChk) patrolChk.addEventListener('change', () => {
    patrolOn = patrolChk.checked;
    addThinkLine(patrolOn ? '自动巡检播报已开启。' : '自动巡检播报已暂停。');
  });

  /* ================= 模拟模板：设置面板卡片 + 双窗口同步播报 ================= */
  const tplCards = document.getElementById('tpl-cards');
  let renderedTpl = null;
  function templateLabel(t) { return window.L10n ? window.L10n.t('templates.' + t.id) : t.name; }
  function renderTplCards() {
    if (!tplCards) return;
    const cur = World.template;
    tplCards.innerHTML = Object.values(World.templates).map(t => `
      <button type="button" class="tpl-item${t.id === cur ? ' on' : ''}" data-tpl="${t.id}">
        <span class="tpl-item__row"><b>${templateLabel(t)}</b><span class="pill${t.id === cur ? ' pill--pine' : ''}">${t.tag}</span></span>
        <span class="tpl-item__desc">${t.desc}</span>
        <span class="tpl-item__meta">${t.meta.map(m => `<span>${m}</span>`).join('')}</span>
      </button>`).join('');
  }
  function syncTplCards() {
    if (!tplCards || World.template === renderedTpl) return;
    const first = renderedTpl === null;
    renderedTpl = World.template;
    renderTplCards();
    if (first) return;
    const tpl = World.templates[renderedTpl] || World.templates.daily;
    addThinkLine(`模拟模板切换 → 「${tpl.name}」：${tpl.desc}`);
    queueChat('main', `已切换模拟模板：「${tpl.name}」。${tpl.desc}`, true,
      `重载模板参数：${tpl.meta.join(' · ')}；已有订单保持原节律推进，新订单按新模板签约拆解，两窗口同步生效。`);
    AIC.toast({ title: '模拟模板已切换', body: `${tpl.name} — ${tpl.desc}`, color: 'var(--pine)', tag: tpl.tag });
  }
  if (tplCards) tplCards.addEventListener('click', e => {
    const btn = e.target.closest('[data-tpl]');
    if (btn && btn.dataset.tpl !== World.template) World.setTemplate(btn.dataset.tpl);
  });
  const bootAt = Date.now();
  setInterval(() => setTxt('#runtime-val', Math.max(1, Math.round((Date.now() - bootAt) / 60000)) + ' 分钟'), 15000);

  /* 资源占用：由世界引擎真实负载推导（在产任务数 / 进度 / 阻塞），随生产波动 */
  const cpuTrack = $('#cpu-track'), cpuVal = $('#cpu-val'), memTrack = $('#mem-track'), memVal = $('#mem-val');
  function updateLoad() {
    if (!cpuTrack) return;
    const L = World.load();
    cpuTrack.style.width = L.cpu + '%'; cpuVal.textContent = L.cpu + '%';
    memTrack.style.width = L.mem + '%'; memVal.textContent = L.mem + '%';
  }
  setInterval(updateLoad, 3000);

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
      setTimeout(() => {
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
  updateBadges(); updatePanels(); renderEventLog(); updateKbStats(); syncHeroDocVer(); syncSpeedUI(); syncTplCards(); updateLoad();
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  requestAnimationFrame(() => go(1, false));
  window.addEventListener('load', () => go(1, false));
  window.addEventListener('resize', () => go(idx, false));
