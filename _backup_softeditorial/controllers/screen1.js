// ============================================================
// screen1.html 控制器：经营总览（营收 / 流水线 / 交付资产 / 团队）
// 纯 ES 模块：AIC / World 由 import 引入，Bloub / gsap 为经典全局。
// ============================================================
import { AIC } from '../modules/common.js';
import { World } from '../modules/world.js';
import { monthRange, monthDay, yearMonth } from '../modules/time.js';

// ============================================================
// 真实时间：把模板里的静态日期标签替换为当前日期口径
// ============================================================
(function applyRealTime() {
  // 甘特周期首尾：09.01 – 09.30 → 当前月
  const rangeEl = document.querySelector('.sched__range');
  if (rangeEl) rangeEl.textContent = monthRange();
  // 甘特 tooltip 内的「MM.DD – MM.DD」→ 当前月相同日
  document.querySelectorAll('.sched .tip, .lane .tip').forEach(tip => {
    if (!tip) return;
    tip.innerHTML = tip.innerHTML.replace(/(\d{2})\.(\d{2})\s*–\s*(\d{2})\.(\d{2})/,
      (m, a, b, c, d) => `${monthDay(Number(b))} – ${monthDay(Number(d))}`);
  });
  // 规格书封面「REV 2.3 · 2026-09」→ 当前年月
  const rev = document.getElementById('rev-date');
  if (rev) rev.textContent = `REV 2.3 · ${yearMonth()} · 规划协调组 编制`;
})();

// ---- 世界数据源（共享 common.js / world.js） ----
  const CAST = AIC.CAST;
  const STATUS_TXT = AIC.STATUS_TXT;
  const statusText = AIC.statusText || ((status) => STATUS_TXT[status]);
  const reduceMotion = AIC.reduceMotion;
  const $ = s => document.querySelector(s);
  const st0 = World.state;

  // ---- 接力线：主 AI 领跑 + 五名员工（状态实时同步） ----
  const RIDERS = [
    { key: 'main', name: '主 AI', shape: 'cercle', ink: '#ffffff', paper: '#d8d0bf', expr: 'attentif', status: 'busy', st: '统筹中', task: '统筹全局 · 自动接单与结算', main: true },
    ...CAST.map(m => ({
      key: m.key, name: m.name, shape: m.shape, ink: m.color, expr: m.expr, paper: '#f5f2ea',
      status: st0.employees[m.key].status, st: statusText(st0.employees[m.key].status), task: st0.employees[m.key].task
    }))
  ];
  const orbSize = window.innerWidth >= 1920 ? 64 : 56;
  const team = document.getElementById('team');
  const riderRefs = {};
  RIDERS.forEach(r => {
    const el = document.createElement('div');
    el.className = 'rider reveal' + (r.main ? ' rider--main' : '');
    el.title = r.task;
    el.innerHTML = `
      <div class="rider__orb">${Bloub.static({ size: orbSize, shape: r.shape, ink: r.ink, expression: r.expr, state: 'idle', paper: r.paper })}</div>
      <i class="rider__st dot dot--${r.status}"></i>
      <b>${r.name}</b>
      <span>${r.st}</span>
      <span class="tip"><b>${r.name}</b> · ${r.task}</span>`;
    team.appendChild(el);
    if (!r.main) riderRefs[r.key] = { el, dot: el.querySelector('.rider__st'), st: el.querySelector('span') };
  });

  // ---- 入场动效（gsap 可选；CDN 失败或减弱动效时直接显示） ----
  if (!window.gsap) document.body.classList.add('no-anim');
  if (window.gsap && !reduceMotion) {
    const tl = gsap.timeline({ defaults: { duration: 0.55, ease: 'power2.out' } });
    tl.fromTo('.mast__title > *', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.06 }, 0.05)
      .fromTo('.val',      { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, stagger: 0.08 }, 0.12)
      .fromTo('.spine__pct', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0 }, 0.25)
      .fromTo('.spine__step', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, stagger: 0.06 }, 0.3)
      .fromTo('.spine__stats span', { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, stagger: 0.04 }, 0.4)
      .fromTo('.tile',     { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, stagger: 0.09 }, 0.45)
      .fromTo('.folio',    { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7 }, 0.6)
      .fromTo('.sched .reveal', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.06 }, 0.65)
      .fromTo('.rider',    { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, stagger: 0.06, ease: 'back.out(1.6)' }, 0.75)
      .fromTo('.relay__note', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 1.0);
    gsap.fromTo('.spine__step .seg > i', { scaleX: 0 }, {
      scaleX: 1, duration: 0.8, ease: 'power2.out',
      transformOrigin: 'left center', stagger: 0.1, delay: 0.45
    });
    gsap.fromTo('.bar', { scaleX: 0 }, {
      scaleX: 1, duration: 0.8, ease: 'power2.out',
      transformOrigin: 'left center', stagger: 0.08, delay: 0.8
    });
    gsap.fromTo('.hero-progress .track > i', { scaleX: 0 }, {
      scaleX: 1, duration: 1, ease: 'power2.out', transformOrigin: 'left center', delay: 0.8
    });
    // 刊头数字滚动（data-count 已写入世界引擎当前值）
    document.querySelectorAll('[data-count]').forEach(el => {
      const end = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.decimals || '0', 10);
      const o = { v: 0 };
      gsap.to(o, {
        v: end, duration: 1.1, ease: 'power1.out', delay: 0.25,
        onUpdate() {
          el.textContent = dec ? o.v.toFixed(dec) : Math.round(o.v).toLocaleString('en-US');
        }
      });
    });
  } else {
    document.body.classList.add('no-anim');
  }

  // 环境兜底：动画时钟被冻结时（后台标签 rAF 节流等），2.2s 后直接跳到最终状态
  setTimeout(() => {
    const first = document.querySelector('.reveal');
    if (first && getComputedStyle(first).opacity === '0') {
      gsap.globalTimeline.getChildren(true, true, false).forEach(t => t.progress(1));
    }
  }, 2200);

  // ---- 世界订阅：经营账本 / 流水线 / 交付资产 / 接力线 ----
  const mastProgress = $('#mast-progress'), mastTotal = $('#mast-total'), mastDoing = $('#mast-doing'), mastOntime = $('#mast-ontime');
  const spinePct = $('#spine-pct'), spineProd = $('#spine-prod'), spineAccept = $('#spine-accept'), spineSettle = $('#spine-settle');
  const stTotal = $('#st-total'), stDone = $('#st-done'), stDoing = $('#st-doing');
  const heroTrack = $('#hero-track'), heroNum = $('#hero-num'), heroPill = $('#hero-pill'), heroVer = $('#hero-ver'), heroSub = $('#hero-sub');
  const relayN1 = $('#relay-n1'), relayN2 = $('#relay-n2'), folioVal = $('#folio-val'), todayLine = $('#today-line');

  function heroTask() {
    const regens = Object.values(World.state.tasks).filter(t => t.regen);
    return regens[regens.length - 1];
  }
  function updateLedger() {
    const st = World.state;
    const doing = Object.values(st.tasks).filter(t => t.status === 'doing');
    const overall = (st.counters.done + doing.reduce((a, t) => a + t.pct / 100, 0)) / Math.max(1, st.counters.total) * 100;
    AIC.tweenNum(mastProgress, Math.round(overall));
    AIC.tweenNum(mastTotal, st.counters.total);
    AIC.tweenNum(mastDoing, doing.length);
    AIC.tweenNum(mastOntime, st.counters.ontime, { decimals: 1 });
    if (folioVal) folioVal.textContent = '任务 ' + st.counters.total;
  }
  function updateSpine() {
    const st = World.state;
    const doing = Object.values(st.tasks).filter(t => t.status === 'doing');
    const avg = doing.length ? doing.reduce((a, t) => a + t.pct, 0) / doing.length : 0;
    const overall = (st.counters.done + doing.reduce((a, t) => a + t.pct / 100, 0)) / Math.max(1, st.counters.total) * 100;
    AIC.tweenNum(spinePct, Math.round(overall));
    spineProd.style.width = avg.toFixed(1) + '%';
    const producing = Object.values(st.orders).filter(o => o.status === 'producing').length;
    const settledNow = Object.values(st.orders).filter(o => o.status === 'settled').length;
    const totalO = producing + settledNow;
    spineAccept.style.width = (totalO ? settledNow / totalO * 100 : 0).toFixed(1) + '%';
    spineSettle.style.width = Math.min(100, st.kb.settledToday / Math.max(1, totalO) * 100).toFixed(1) + '%';
    stTotal.textContent = st.counters.total;
    stDone.textContent = st.counters.done;
    stDoing.textContent = doing.length;
  }
  function updateHero() {
    const t = heroTask(); if (!t) return;
    heroTrack.style.width = t.pct + '%';
    heroNum.textContent = Math.round(t.pct) + '% · 已合并 ' + Math.max(3, Math.round(t.pct / 100 * 5)) + ' / 5 份源文档';
    if (t.status === 'done') {
      heroPill.textContent = '已归档'; heroPill.className = 'pill pill--pine';
      heroVer.textContent = 'v0.' + (t.regen + 1);
    } else {
      heroPill.textContent = '生成中'; heroPill.className = 'pill pill--clay';
      heroVer.textContent = 'v0.' + t.regen;
    }
    heroSub.textContent = `v0.${t.status === 'done' ? t.regen + 1 : t.regen} · 主 AI 整合生成 · 自动滚动交付`;
  }
  function updateRelay() {
    const st = World.state;
    CAST.forEach(m => {
      const r = riderRefs[m.key]; const emp = st.employees[m.key];
      if (!r) return;
      r.dot.className = 'dot dot--' + emp.status;
      r.st.textContent = statusText(emp.status);
      r.el.title = `${emp.task} · 进度 ${Math.round(emp.pct)}%`;
    });
    relayN1.textContent = `今日 ${st.counters.todayOrders} 项推进 · 知识库 +${st.kb.today} · 全员在线`;
    const last = st.events[0];
    const lastText = last ? last.text.replace(/\s*[¥￥]\s*[\d,.]+(?:万|千)?/g, '').replace(/\s*（预付[^）]+）/g, '') : '运行正常';
    relayN2.textContent = `最新 ${last ? last.t : World.timeHM()} · ${lastText}`;
  }
  /* 角色任务完成时，给对应瓦片短暂提示 */
  const EMP_TILE = { designer: '.t-visual', engineer: '.t-web', planner: '.tile--hero', writer: '.tile--hero', analyst: '.t-data' };
  function pulseTile(sel) {
    const el = document.querySelector(sel);
    if (!el || !window.gsap || reduceMotion) return;
    gsap.fromTo(el, { backgroundColor: 'rgba(31,111,92,0.10)' }, { backgroundColor: 'rgba(31,111,92,0)', duration: 1.4, ease: 'power2.out', clearProps: 'backgroundColor' });
  }
  function updateAll() { updateLedger(); updateSpine(); updateHero(); updateRelay(); }

  World.on(evts => {
    updateAll();
    const st = World.state;
    evts.forEach(e => {
      if (e.type === 'order' && st.orders[e.id]) {
        const o = st.orders[e.id];
        AIC.toast({ title: '新任务自动进入', body: `${o.client} · ${o.demand}`, color: 'var(--pine)', tag: '任务池' });
      } else if (e.type === 'settle' && st.orders[e.id]) {
        const o = st.orders[e.id];
        AIC.toast({ title: '交付完成 · 已归档', body: `${o.client} · ${o.demand}`, color: 'var(--pine)', tag: o.settledAt || World.timeHM() });
      } else if (e.type === 'block' && st.tasks[e.id]) {
        AIC.toast({ title: '任务阻塞 · 自动重试', body: st.tasks[e.id].title, color: 'var(--clay)', tone: 'clay', tag: World.timeHM() });
      } else if (e.type === 'taskDone' && st.tasks[e.id] && st.tasks[e.id].owner && EMP_TILE[st.tasks[e.id].owner]) {
        pulseTile(EMP_TILE[st.tasks[e.id].owner]);
      }
    });
  });

  // 甘特「今日」线随世界时钟推进（09.01–09.30 周期）
  function moveToday() { if (todayLine) todayLine.style.left = (World.dayFrac() / 30 * 100).toFixed(2) + '%'; }
  setInterval(moveToday, 30000);

  // 初始：把世界当前值写进刊头的非金额运营指标
  {
    const doing0 = Object.values(st0.tasks).filter(t => t.status === 'doing');
    const overall0 = Math.round((st0.counters.done + doing0.reduce((a, t) => a + t.pct / 100, 0)) / Math.max(1, st0.counters.total) * 100);
    mastProgress.dataset.count = String(overall0);
    mastTotal.dataset.count = String(st0.counters.total);
    mastDoing.dataset.count = String(doing0.length);
    mastOntime.dataset.count = Number(st0.counters.ontime || 0).toFixed(1);
    spinePct.dataset.count = String(overall0);
  }
  updateHero(); updateRelay(); moveToday();
  setTimeout(() => { updateLedger(); updateSpine(); }, 1600);

  /* ============================================================
     实时模拟扩展：模板切换浮层 / 交付瓦片 / 数字闪动
     ============================================================ */
  (function () {
    const TPL = World.templates;
    const chip = $('#tpl-chip'), pop = $('#tpl-pop'), chipName = $('#tpl-chip-name');
    const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    function templateLabel(t) {
      return window.L10n ? window.L10n.t('templates.' + t.id) : t.name;
    }
    function renderPop() {
      const cur = World.template;
      pop.innerHTML = '<div class="tpl-pop__head">实时模拟模板 · 双窗口同步生效</div><div class="tpl-list">' +
        Object.values(TPL).map(t => `
          <button type="button" class="tpl-item${t.id === cur ? ' on' : ''}" data-tpl="${t.id}" role="menuitem">
            <span class="tpl-item__row"><b>${templateLabel(t)}</b><span class="pill${t.id === cur ? ' pill--pine' : ''}">${t.tag}</span></span>
            <span class="tpl-item__desc">${t.desc}</span>
            <span class="tpl-item__meta">${t.meta.map(m => `<span>${m}</span>`).join('')}</span>
          </button>`).join('') + '</div>';
    }
    function setChip() { chipName.textContent = templateLabel(TPL[World.template] || TPL.daily); }
    function closePop() { pop.classList.remove('open'); chip.setAttribute('aria-expanded', 'false'); }

    chip.addEventListener('click', () => {
      const open = pop.classList.toggle('open');
      chip.setAttribute('aria-expanded', String(open));
      if (open) renderPop();
    });
    pop.addEventListener('click', e => {
      const btn = e.target.closest('[data-tpl]');
      if (!btn) return;
      World.setTemplate(btn.dataset.tpl);
      closePop();
    });
    document.addEventListener('click', e => { if (pop.classList.contains('open') && !e.target.closest('#tpl-wrap')) closePop(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });

    /* ---- 交付瓦片：绑定各角色真实任务 ---- */
    const TILE_LIVE = [
      { role: 'writer',   bar: '#live-spec',   num: '#live-spec-num',   pill: '#pill-spec' },
      { role: 'analyst',  bar: '#live-data',   num: '#live-data-num',   pill: '#pill-data' },
      { role: 'designer', bar: '#live-visual', num: '#live-visual-num', pill: '#pill-visual' },
      { role: 'engineer', bar: '#live-web',    num: '#live-web-num',    pill: '#pill-web' }
    ];
    function roleTask(role) {
      const mine = Object.values(World.state.tasks).filter(t => t.owner === role);
      return mine.find(t => t.status === 'doing') || mine.find(t => t.status === 'blocked')
        || mine.filter(t => t.status === 'done').sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''))[0] || null;
    }
    function updateTiles() {
      TILE_LIVE.forEach(cfg => {
        const bar = document.querySelector(cfg.bar), num = document.querySelector(cfg.num), pill = document.querySelector(cfg.pill);
        if (!bar || !num || !pill) return;
        const t = roleTask(cfg.role);
        if (!t) { bar.style.width = '0%'; num.textContent = '等待派单'; pill.textContent = '待命中'; pill.className = 'pill pill--sage'; return; }
        if (t.status === 'blocked') {
          bar.style.width = t.pct + '%'; num.textContent = Math.round(t.pct) + '% · 自动重试中';
          pill.textContent = '阻塞'; pill.className = 'pill pill--clay';
        } else if (t.status === 'doing') {
          bar.style.width = t.pct + '%'; num.textContent = Math.round(t.pct) + '% · ' + t.title;
          pill.textContent = '生成中'; pill.className = 'pill pill--clay';
        } else {
          bar.style.width = '100%'; num.textContent = '已交付 · ' + t.title;
          pill.textContent = '已交付'; pill.className = 'pill pill--pine';
        }
      });
      /* 漏斗转化率随今日接单缓慢漂移（2.5–4.6% 合理带内） */
      const cvr = document.getElementById('data-cvr');
      if (cvr) {
        const base = 3.4 + Math.min(0.8, World.state.counters.todayOrders * 0.05);
        const v = Math.max(2.5, Math.min(4.6, base + Math.sin(Date.now() / 900000) * 0.25));
        cvr.textContent = `注册转化 ${v.toFixed(1)}% ${World.state.counters.todayOrders > 13 ? '↑' : '→'}`;
      }
    }

    function flashEl(sel) {
      const el = document.querySelector(sel);
      if (!el || reduceMotion) return;
      el.classList.remove('num-flash'); void el.offsetWidth; el.classList.add('num-flash');
    }

    /* 模板以幂等方式跟随世界状态（本页切换走 template 事件，他窗切换走 sync 快照） */
    let curTplId = null;
    function syncTplUI() {
      if (World.template === curTplId) return;
      const first = curTplId === null;
      curTplId = World.template;
      setChip();
      if (pop.classList.contains('open')) renderPop();
      if (!first) {
        const t = TPL[curTplId] || TPL.daily;
        AIC.toast({ title: '模拟模板已切换', body: `${t.name} — ${t.desc}`, color: 'var(--pine)', tag: t.tag });
      }
    }

    World.on(evts => {
      syncTplUI();
      updateTiles();
      evts.forEach(e => {
        if (e.type === 'settle') { flashEl('#mast-progress'); }
        else if (e.type === 'order') { flashEl('#mast-total'); }
        else if (e.type === 'rework') {
          const t = World.state.tasks[e.id];
          AIC.toast({ title: '质检返工 · 自动修正', body: t ? t.title : '', color: 'var(--clay)', tone: 'clay', tag: World.timeHM() });
        }
      });
    });

    syncTplUI(); renderPop(); updateTiles();
  })();
