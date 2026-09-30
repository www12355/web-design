/* ============================================================
   第 3 屏 section · 经营中枢（原 window2.js 深井表情球 / 监管终端 /
   面板标签页逐行等价迁移，P3-1）
   挂载条件：页面存在 .p3。跨 section 调用（思考链 / 群聊 / 知识架）
   一律走 bus —— 缺对应 section 的页面自动空转。
   ============================================================ */
import { AIC } from '../../../modules/common.js';
import { World } from '../../../modules/world.js';
import { nowHM } from '../../../modules/time.js';
import { RE_GREET, RE_THANKS, RE_WHO, routeRole, normalizeTitle, isDispatch } from '../../../modules/linkage.js';
import {
  CAST, later, every, setTxt, $,
  snapWorld, state as sharedState, bus
} from '../shared.js';

let ebBall = null;
let speedSeg = null;

/* 待机(02) ↔ 思考中(30) 轮换；睡眠 / 任务期间挂起 */
let ebPhase = 0;
let ebTimer = null;
function ebToggle() {
  if (sharedState.sleeping || sharedState.taskBusy) return;
  ebPhase = 1 - ebPhase;
  ebBall.setEmotion(ebPhase ? '30' : '02');
}

/* 待机看门狗：22s 无交互 → 睡眠 */
let idleTimer = null;
function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (sharedState.taskBusy || document.hidden) { armIdle(); return; }
    sharedState.sleeping = true;
    ebBall.clearGaze();
    ebBall.setEmotion('00');
  }, 22000);
}
function wakeIdle() {
  clearTimeout(idleTimer);
  if (sharedState.sleeping) {
    sharedState.sleeping = false;
    ebBall.setEmotion('01');
    later(() => { if (!sharedState.sleeping && !sharedState.taskBusy) ebBall.setEmotion('02'); }, 900);
  }
  armIdle();
}

/* ================= 监管终端：对话 ≠ 派发（语义路由取自共享层 linkage.js，P1-4） ================= */
function converse(text) {
  const st = World.state;
  const producing = Object.values(st.orders).filter(o => o.status === 'producing').length;
  const doing = Object.values(st.tasks).filter(t => t.status === 'doing').length;
  let reply;
  if (RE_GREET.test(text)) { const _tpl = World.templates[World.template] || World.templates.daily; reply = `你好！我是主 AI 统筹者。当前运行「${_tpl.name}」模拟模板，本经营体全自动运转：在产订单 ${producing} 个、任务进行 ${doing} 项，今日已完成归档 ${st.kb.today} 项——随时观察即可，也可以向我下达监管指令。`; }
  else if (RE_THANKS.test(text)) reply = '不客气，价值创造是本体的本能。想看哪条产线的细节，说一声就好。';
  else if (RE_WHO.test(text)) reply = '我是主 AI：自动接单、拆解任务、调度 6 名数字员工、把控交付与归档，全程无人力接入。';
  else reply = '收到，已记入上下文。下达监管指令请带上「修订 / 分析 / 开发」这类动词，或直接 @某位数字员工，回车即可。';
  bus.think.quick('对话识别',
    `收到信息：「${text.slice(0, 20)}」。`,
    `意图判定：属日常对话，未命中任务动词与 @数字员工，不占用产线。`,
    `主 AI 亲自回应，数字员工继续原任务。`,
    { prio: 3 });
  ebBall.clearGaze();
  ebBall.setEmotion('10');
  if (ebBall.burst) ebBall.burst();
  bus.chat.queueChat('main', reply, true);
  later(() => { if (!sharedState.taskBusy) ebBall.setEmotion('02'); }, 3400);
}

let taskInput = null;
let taskSend = null;
function handleInput() {
  if (sharedState.taskBusy) return;
  const text = taskInput.value.trim();
  if (!text) return;
  taskInput.value = '';
  wakeIdle();
  if (!isDispatch(text)) { converse(text); return; }
  runDispatch(text);
}

/* ---------------- 派发全流程：路由 → 认领 → 卡住(45%) → 完成入库 ---------------- */
function runDispatch(text) {
  sharedState.taskBusy = true;
  taskSend.classList.add('loading'); taskSend.disabled = true;
  const owner = routeRole(text, CAST);
  const emp = CAST.find(c => c.key === owner);
  const title = normalizeTitle(text);
  const id = 'u' + Date.now().toString(36);
  const prevTask = (World.state.employees[owner] || {}).task;
  const eta = 18 + Math.floor(Math.random() * 25);
  const s0 = snapWorld();
  ebBall.setEmotion('01');
  bus.think.chain(`监管指令 · ${title}`, [
    { p: 'obs',   t: `接收到监管指令：「${text}」。` },
    { p: 'cut',   t: `意图识别：命中任务动词，判定为执行类指令而非对话，进入派发路径。` },
    { p: 'sim',   t: `职责路由：对比 6 名数字员工的职责域，语义与「${emp.name}」最匹配，判定由其承接。` },
    { p: 'judge', t: `上下文切换：其原任务「${prevTask || '待命'}」暂存回任务池，保留断点不丢弃。` },
    { p: 'sim',   t: `参数拆解：验收口径、依赖输入与交付格式已生成，纳入任务池第 ${s0.st.counters.total + 1} 项。` },
    { p: 'concl', t: `「${title}」已派发至 ${emp.name}，预计 ${eta} 分钟出初稿。` }
  ], { prio: 9 });
  later(() => { ebBall.setEmotion('30'); }, 900);
  later(() => {
    ebBall.setGaze(-1.1, 0.05);
    World.dispatch({ id, title, owner, value: 6000 + Math.floor(Math.random() * 9000) });
  }, 2200);
  bus.chat.queueChat(owner, `收到监管指令，即刻执行：「${title}」。预计 ${eta} 分钟内出初稿。`, false,
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
    bus.shelf.addShelfRow(`${title} · 已入知识库`);
    AIC.toast({ title: '监管指令完成', body: `「${title}」已交付并写入知识库`, color: 'var(--color-accent)', tag: nowHM() });
    later(() => {
      const nxt = World.pickNextQueued();
      if (nxt) World.applyClaim(nxt, owner);
    }, 1600);
  }, doneAt);
  later(() => {
    sharedState.taskBusy = false;
    taskSend.classList.remove('loading'); taskSend.disabled = false;
    ebBall.setEmotion('02'); ebBall.clearGaze();
  }, doneAt + 3600);
}

/* ================= 面板：标签页 / 设置 / 负载 ================= */
function wireSeg(segEl) {
  if (!segEl) return;
  const btns = [...segEl.querySelectorAll('.seg__item')];
  btns.forEach(btn => btn.addEventListener('click', () => {
    btns.forEach(b => b.classList.toggle('seg__item--on', b === btn));
    const scope = segEl.closest('.tp__panel');
    scope.querySelectorAll('.pane').forEach(p => { p.hidden = p.id !== btn.dataset.pane; });
  }));
}
function syncSpeedUI() {
  if (speedSeg) speedSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.speed === World.speed));
  setTxt('#speed-note', World.speed > 1 ? `当前 ×${World.speed}：时钟与生产节律同步加快，订单流与归档更密集。` : '当前 ×1：实时节律，订单与交付按正常节奏到达。');
}

export function initHub() {
  const ebMain = document.getElementById('eb-main');
  if (!ebMain) return;   /* 本页无中枢（screen2/4）：不挂载，bus.eb/bus.hub 保持空转 */
  ebBall = window.EmotionBall.create(ebMain, {
    emotion: '02', shape: 'blob', idle: true, autostart: true
  });
  bus.eb = {
    setEmotion: e => ebBall.setEmotion(e),
    clearGaze: () => ebBall.clearGaze(),
    burst: () => { if (ebBall.burst) ebBall.burst(); },
    wakeIdle,
    isBusy: () => sharedState.taskBusy || sharedState.sleeping
  };
  bus.hub.syncSpeedUI = syncSpeedUI;

  const ebPage = ebMain.closest('.reel__page') || ebMain.closest('.screen') || document.body;
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

  document.querySelector('.p3').addEventListener('pointermove', wakeIdle, { passive: true });
  document.querySelector('.p3').addEventListener('pointerdown', wakeIdle, { passive: true });
  window.addEventListener('keydown', wakeIdle);
  armIdle();

  taskInput = document.getElementById('task-input');
  taskSend = document.getElementById('task-send');
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
      if (!sharedState.taskBusy) handleInput();
      else taskInput.focus();
    });
  });
  /* 交付产物：一键生成最近订单的 Word 文档并弹窗审阅 */
  document.querySelectorAll('.task-chips .chip[data-doc-action="generate"]').forEach(ch => {
    ch.addEventListener('click', () => {
      wakeIdle();
      taskInput.value = '';
      if (sharedState.taskBusy) { AIC.toast({ title: '生产进行中', body: '当前有监管任务在跑，稍后再生成文档', color: 'var(--clay)', tone: 'clay' }); taskInput.focus(); return; }
      bus.doc.generate(null, false, { openReview: true });
    });
  });

  wireSeg(document.getElementById('seg-left'));
  wireSeg(document.getElementById('seg-right'));

  speedSeg = document.getElementById('speed-seg');
  if (speedSeg) speedSeg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => World.setSpeed(+b.dataset.speed)));
  const patrolChk = document.getElementById('patrol-chk');
  if (patrolChk) patrolChk.addEventListener('change', () => {
    sharedState.patrolOn = patrolChk.checked;
    bus.think.quick('巡检开关',
      sharedState.patrolOn ? '自动巡检播报已开启。' : '自动巡检播报已暂停。',
      sharedState.patrolOn ? '推演：巡检链并入推理流，同文条目自动合并计数。' : '推演：巡检链停止入队，其余推理不受影响。',
      sharedState.patrolOn ? '巡检恢复播报。' : '已静默巡检。',
      { prio: 3 });
  });

  const bootAt = Date.now();
  every(() => setTxt('#runtime-val', Math.max(1, Math.round((Date.now() - bootAt) / 60000)) + ' 分钟'), 15000);

  /* 「看着能点、键盘够不着」的深井画布：补 tabindex + Enter/Space（原通用 a11y 块的 .well 部分） */
  document.querySelectorAll('.well').forEach(el => {
    if (el.tabIndex >= 0) return;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });
  });

  /* 资源占用：由世界引擎真实负载推导（在产任务数 / 进度 / 阻塞），随生产波动 */
  const cpuTrack = $('#cpu-track'), cpuVal = $('#cpu-val'), memTrack = $('#mem-track'), memVal = $('#mem-val');
  function updateLoad() {
    if (!cpuTrack) return;
    const L = World.load();
    cpuTrack.style.width = L.cpu + '%'; cpuVal.textContent = L.cpu + '%';
    memTrack.style.width = L.mem + '%'; memVal.textContent = L.mem + '%';
  }
  every(updateLoad, 3000);
  updateLoad();
  syncSpeedUI();
}
