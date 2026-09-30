/* ============================================================
   事件处理映射表（原 window2.js EV_HANDLERS 按屏分片重组，P3-1）
   事件在任何页面都会流过；跨 section 的调用一律经 bus ——
   页面缺某 section 时该钩子为 no-op，与拆分前「全 DOM 在一页」等价。
   ============================================================ */
import { AIC, World, nowHM, setTxt, $, chatEsc, reduceMotion, CAST, state as sharedState, bus, whoName, snapWorld, later } from './shared.js';
import { patrolSim, patrolVerdict } from './sections/think.js';
import {
  EV_LABEL, EV_KEY_KINDS, dedupeEventRows, eventNorm, renderEventRows
} from '../../modules/linkage.js';

/* ---- 面板刷新：三屏共享的只读数字（各自元素缺失时自动跳过） ---- */
const eventLogEls = [document.getElementById('event-log'), document.getElementById('event-log2')].filter(Boolean);
const EV_TAG = EV_LABEL;   /* 事件标签统一取自共享层 linkage.js（P1-3） */
export function renderEventLog() {
  const rows = dedupeEventRows(World.state.events, {
    keyKinds: EV_KEY_KINDS,
    keyLimit: 13,
    infoLimit: 3,
    /* 先脱敏再归一：金额差异不再被当成不同事件，同指标可正确合并 */
    norm: (text) => eventNorm(AIC.stripMoney(String(text)))
  });
  const html = renderEventRows(rows, {
    tag: 'div',
    esc: (v) => String(v == null ? '' : v),
    renderText: chatEsc,
    labelOf: (kind) => EV_TAG[kind] || '',
    /* 空态：renderEventRows 支持 emptyHTML —— 事件清空/未接入时给出可读空态 */
    emptyHTML: '<div class="ev-row is-empty">世界引擎已就绪，等待第一条经营事件…</div>'
  });
  eventLogEls.forEach((el) => { el.innerHTML = html; });
}

export function updatePanels() {
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
export function updateKbStats() {
  const st = World.state;
  if (kbTotalEl) kbTotalEl.textContent = st.kb.total.toLocaleString('en-US');
  if (kbTodayEl) kbTodayEl.textContent = '+' + st.kb.today;
  if (kbSettleEl) kbSettleEl.textContent = st.kb.settledToday;
}

/* ---- 事件分片 ---- */
const EV_HANDLERS = {
  order(e, st) {
    const o = st.orders[e.id]; if (!o) return;
    const n = (e.tasks || []).length;
    const roleNames = [...new Set((e.tasks || []).map(tt => (CAST.find(c => c.key === tt._role) || {}).name || '数字员工'))].join('、');
    const s0 = snapWorld();
    bus.chat.queueChat('planner', `新订单已自动受理：${o.client} · ${o.demand}，已进入生产队列。`, false,
      `评估「${o.client}」需求复杂度与交付窗口；依赖已解析，自动受理并排入生产队列。`);
    bus.chat.queueChat('main', `已拆解为 ${n} 项任务并排入并行队列，关键路径优先调度。`, true);
    bus.think.chain(`新订单 · ${o.client}`, [
      { p: 'obs',   t: `受理信号：${o.demand}，客户 ${o.client}，需求复杂度评估完毕。` },
      { p: 'cut',   t: `需求拆解：${n} 项子任务，涉及 ${roleNames || '待定'}。` },
      { p: 'sim',   t: `并行度推演：在产 ${s0.producing} 单 · 进行 ${s0.doing} 项 · 排队 ${s0.queued} 项，${s0.queued > 12 ? '队列偏长，先消化再扩容' : '产能仍有富余'}。` },
      { p: 'judge', t: `调度判定：关键路径优先，空闲数字员工即时承接，其余按依赖顺序排队。` },
      { p: 'concl', t: `已自动受理并排入并行生产，交付窗口不变。` }
    ], { prio: 7 });
    AIC.toast({ title: '新订单自动受理', body: `${o.client} · ${o.demand} · 已进入生产队列`, color: 'var(--pine)', tag: nowHM() });
    if (!bus.eb.isBusy()) { bus.eb.setEmotion('30'); later(() => { if (!bus.eb.isBusy()) bus.eb.setEmotion('02'); }, 3200); }
  },
  taskDone(e, st) {
    const t = st.tasks[e.id]; if (!t) return;
    bus.pulse(t.owner);
    /* 数字员工每完成一次思考/产出，把最佳结果写入戴森球知识点 */
    if (t.owner) bus.kbAdd(t.owner, t.title);
    else if (t.regen) bus.kbAdd('main', t.title);
    if (kbTodayEl && !reduceMotion) { kbTodayEl.classList.remove('num-flash'); void kbTodayEl.offsetWidth; kbTodayEl.classList.add('num-flash'); }
    if (t.owner) {
      bus.chat.queueChat(t.owner, `「${t.title}」已完成并通过验收，产出已写入知识库。`, false,
        `「${t.title}」验收要点复核完毕；产出归档并同步下游，交付记录已更新。`);
      if (Math.random() < 0.4) later(() => {
        bus.chat.addReact(lastChatRow(), '2 人认可');
      }, 3800);
    } else if (t.regen) {
      bus.think.quick(`合稿 · v0.${t.regen}`,
        `版本校验通过：发布方案整合稿 v0.${t.regen} 全章齐备。`,
        `推演：下一版本需承接增量素材，先清点新入库条目再开版。`,
        `v0.${t.regen} 已归档，v0.${t.regen + 1} 自动开启。`,
        { prio: 5 });
    }
  },
  claim(e, st) {
    const t = st.tasks[e.id]; if (!t || !t.owner) return;
    const _emp = World.state.employees[t.owner] || {};
    bus.think.quick(`认领 · ${t.title}`,
      `待办出现：「${t.title}」进入可执行队列。`,
      `匹配推演：${whoName(t.owner)} 承接后起点进度 ${Math.round(_emp.pct || 0)}%，依赖输入已就绪。`,
      `已认领并进入并行生产。`,
      { prio: 5 });
  },
  settle(e, st) {
    const o = st.orders[e.id]; if (!o) return;
    bus.chat.queueChat('main', `订单交付：${o.client} · ${o.demand} 已完成验收，成果已归档。`, true,
      `验收完成：${o.client} 交付记录已写入知识库，生产链路继续运行。`);
    const _doneTasks = Object.values(st.tasks).filter(x => x.order === o.id);
    const _doneCnt = _doneTasks.length;
    bus.think.chain(`交付 · ${o.client}`, [
      { p: 'obs',   t: _doneCnt ? `验收通过：${o.demand} 共 ${_doneCnt} 项任务全部达标，验收口径无争议。` : `验收通过：${o.demand} 交付物齐备，验收口径无争议。` },
      { p: 'cut',   t: `清单核对：产物完整、格式合规、与订单需求逐条对齐。` },
      { p: 'sim',   t: `产能推演：本单 ${_doneCnt} 项子任务全部达标，今日已归档 ${st.counters.done} 项。` },
      { p: 'judge', t: `据实归档：交付记录与知识条目同批写入，不做二次返工。` },
      { p: 'concl', t: `已归档，知识资产 ${st.kb.total.toLocaleString('en-US')} 条，产线继续运行。` }
    ], { prio: 7 });
    bus.kbAdd('main', `${o.client} · ${o.demand}`);
    AIC.toast({ title: '交付验收完成', body: `${o.client} · ${o.demand} · 已归档`, color: 'var(--pine)', tag: nowHM() });
    if (!bus.eb.isBusy()) { bus.eb.setEmotion('33'); bus.eb.burst(); later(() => { if (!bus.eb.isBusy()) bus.eb.setEmotion('02'); }, 3600); }
    /* 交付后自动织一份 Word 交付文档并弹窗审阅（只做加法，不影响既有分支） */
    later(() => { bus.doc.generate(o, false, { openReview: true, autoClose: true }); }, 4200);
  },
  block(e, st) {
    const t = st.tasks[e.id]; if (!t) return;
    if (t.owner) bus.chat.queueChat(t.owner, `「${t.title}」阻塞：${t.reason}，自动重试中。`, false);
    bus.think.chain(`阻塞 · ${t.title}`, [
      { p: 'obs',   t: `异常中断：任务停在中途，原因「${t.reason}」。`, risk: true },
      { p: 'cut',   t: `影响面定位：${t.owner ? whoName(t.owner) + ' 的当前产线' : '主 AI 合稿线'}被挂起，进度停在 ${Math.round(t.pct)}%。` },
      { p: 'sim',   t: `交付窗口推演：若 30 分钟内恢复则不影响承诺，超时则触发顺延预案。` },
      { p: 'concl', t: `自动重试已启动，恢复后从断点续跑。`, risk: true }
    ], { prio: 9, tone: 'risk' });
    AIC.toast({ title: '任务阻塞 · 自动重试', body: t.title, color: 'var(--clay)', tone: 'clay', tag: nowHM() });
    if (!bus.eb.isBusy()) { bus.eb.setEmotion('21'); later(() => { if (!bus.eb.isBusy()) bus.eb.setEmotion('02'); }, 4200); }
  },
  unblock(e, st) {
    const t = st.tasks[e.id]; if (!t) return;
    bus.think.quick(`恢复 · ${t.title}`,
      `重试回执：依赖方恢复响应。`,
      `推演：从 ${Math.round(t.pct)}% 断点续跑，前段产出无需重做。`,
      `已恢复执行，交付窗口守住。`,
      { prio: 6 });
  },
  rework(e, st) {
    const t = st.tasks[e.id]; if (!t) return;
    if (t.owner) bus.chat.queueChat(t.owner, `「${t.title}」质检未过，回退重做中，恢复后继续推进。`, false,
      `校验规则命中：${t.title} 约有 ${e.dip || 10}% 产出不达标，先修正再重跑校验，不影响交付窗口。`);
    bus.think.chain(`返工 · ${t.title}`, [
      { p: 'obs',   t: `质检未过：校验规则命中，产出约 ${e.dip || 10}% 不达标。`, risk: true },
      { p: 'cut',   t: `定位：问题集中在末段，前段结构与引用无需改动。` },
      { p: 'judge', t: `处置判定：只回退受影响段落重做，其余保留，避免整段重跑。` },
      { p: 'concl', t: `已回退重做，修订后自动复查。`, risk: true }
    ], { prio: 9, tone: 'risk' });
    bus.kbRework(t);
    AIC.toast({ title: '质检返工 · 自动修正', body: t.title, color: 'var(--clay)', tone: 'clay', tag: nowHM() });
  },
  note(e) {
    if (!sharedState.patrolOn) return;
    const body = String(e.text || '').replace(/^巡检：/, '');
    const s1 = snapWorld();
    bus.think.chain('自主巡检', [
      { p: 'obs',   t: body },
      { p: 'sim',   t: patrolSim(body, s1) },
      { p: 'concl', t: patrolVerdict(body) }
    ], { prio: 1, dedupe: 'patrol:' + body.replace(/[0-9¥%.,，、]+/g, '') });
  },
  dispatch(e) {
    const _tt = (e.task || {}).title || '监管任务';
    bus.think.quick(`入池 · ${_tt}`,
      `指令进入任务池：${_tt}。`,
      `推演：与在产任务比对依赖，避免二次占用同一数字员工。`,
      `已登记，等待调度执行。`,
      { prio: 5 });
  },
  staffTemplate(e, st) {
    const tpl = e.id || st.staffTemplate;
    bus.badges.renderBadges(tpl);
    bus.kb.template(tpl);
  },
  speed(e) {
    bus.think.quick(`节拍 · ×${e.v}`,
      `流速切换：时钟与生产节律调整为 ×${e.v}。`,
      `推演：事件密度随之变化，推理链保持完整步骤，仅压缩打字与停顿。`,
      e.v > 1 ? `演示加速生效，思考链全量输出。` : `已恢复 ×1 正常流速，阅读节奏回到基准。`,
      { prio: 3 });
    bus.hub.syncSpeedUI();
  }
};

/* taskDone 的「2 人认可」挂在最后一条消息行后：通过 bus 取（缺群聊时无行可挂） */
function lastChatRow() {
  return bus.chat.lastRow ? bus.chat.lastRow() : null;
}

/* ---- 订阅入口：updaters = 各页面自己的只读刷新函数集合 ---- */
export function subscribeWorld(updaters) {
  World.on((evts) => {
    updaters.forEach(fn => { try { fn(); } catch (err) { console.error('[panel]', err); } });
    evts.forEach(e => {
      const st = World.state;
      const h = EV_HANDLERS[e.type];
      if (h) h(e, st);
    });
  });
}
