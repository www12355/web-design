/* ============================================================
   docgen：交付产物 · Word 文档生成 + AI 审阅引擎
   纯前端模拟，与「主 AI 经营群 / 思考过程」解耦、只做加法：
   - buildDocContent：把真实订单数据织成结构化文档模型
   - renderDocPreview：在弹窗里渲染 Word 风格 A4 预览
   - reviewDoc：按文档实际内容做规则审阅，指出不足（无不足则返回 pass）
   - downloadDocx：用 docx 库生成真实 .docx，尽力而为；失败降级为 Word 兼容 .doc
   模态 DOM 骨架与样式由 window2.html 提供，本模块只负责填充与交互。
   ============================================================ */

import { fmtAgo, mountTimeTicker } from './time.js';
import { AIC } from './common.js';

/* ---------------- 工具 ---------------- */
function hash(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) >>> 0;
  return h;
}
function pad(n) { return String(n).padStart(2, '0'); }
function today() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
/* 文档文本统一出口：先脱敏（交付文档内不出现金额与价格字眼），再做 HTML 转义 */
function esc(s = '') {
  return AIC.stripMoney(String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function levelW(level) { return ({ high: 18, mid: 10, low: 5 })[level] || 8; }
function levelLabel(level) { return ({ high: '严重', mid: '中等', low: '轻微' })[level] || '提示'; }
/* 把聊天行的 time 规整为 epoch ms：支持 window2 传入的 epoch 数字、
   模板里的 HH:MM 字符串、或兜底为当前真实时间 */
function chatTs(r) {
  const t = r && r.time;
  if (typeof t === 'number' && Number.isFinite(t)) return t;
  if (typeof t === 'string') {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    if (m) { const d = new Date(); d.setHours(+m[1], +m[2], 0, 0); return d.getTime(); }
  }
  return Date.now();
}

/* 从订单提取关联交付物（兼容 World 任务的多种形态） */
function deliverablesOf(order, tasks) {
  const out = [];
  const push = (title, owner) => { if (title) out.push({ item: title, fmt: 'DOCX', owner: owner || '主 AI' }); };
  if (Array.isArray(tasks) && tasks.length) {
    tasks.forEach(t => {
      if (t && typeof t.title === 'string') push(t.title, t.owner);
      else if (Array.isArray(t) && t[1]) push(t[1], t[0]);
      else push(String(t));
    });
  }
  if (!out.length && order && order.demand) {
    push(order.demand + ' · 交付方案', '主 AI');
    push(order.client + ' · 验收确认单', '数据分析');
  }
  if (out.length < 2) push('交付方案正文', '主 AI');
  return out;
}

/* ---------------- 文档模型 ---------------- */
export function buildDocContent(order, opts = {}) {
  const o = order || {};
  const client = o.client || '（客户信息待补）';
  const demand = o.demand || '（需求待明确）';
  const version = opts.ver || 'v1.0';
  const docNo = 'AIC-' + String(hash((order && order.id) || client + demand) % 100000).padStart(5, '0');
  const delivery = o.status === 'settled'
    ? `已于 ${o.settledAt || '归档时间待同步'} 完成交付`
    : `当前状态：${o.status === 'settling' ? '验收中' : '生产中'}`;
  const tasks = Array.isArray(opts.tasks) ? opts.tasks : [];
  const deliverables = deliverablesOf(o, tasks);
  const incomplete = tasks.filter(t => t && ['doing', 'queued', 'blocked', 'rework', 'wait'].includes(t.status));
  const hasOpenTasks = incomplete.length > 0;
  const sections = [
    { id: 'abstract', h: '摘要', body: [`面向客户「${client}」的「${demand}」订单，由全自主 AI 经营体完成需求拆解、并行生产与交付验收。交付范围与验收口径详见下文，${delivery}。`] },
    { id: 'background', h: '背景与目标', body: defaultLines(client, demand) },
    { id: 'scope', h: '交付范围', body: defaultScope() },
    { id: 'plan', h: '执行与排期', body: defaultPlan() },
    { id: 'deliverables', h: '交付清单', body: ['详见下表交付物、格式与归属。'], table: deliverables },
    { id: 'acceptance', h: '验收标准', body: [
      '以交付清单逐项核对，确保产物格式正确、内容完整、口径与需求一致；',
      '关键节点通过率 ≥ 95%，接入方确认无阻断性缺陷后签署验收确认单，方可归档入库。'
    ] },
    { id: 'conclusion', h: '结论', body: [
      hasOpenTasks
        ? `当前仍有 ${incomplete.length} 项任务未闭环，本文档作为阶段性交付记录，待任务完成并复核后再进入最终归档。`
        : `「${demand}」各项交付物已完成并归档，满足验收口径。交付记录与知识资产已同步沉淀。`
    ] }
  ];
  return { title: `《${demand}》交付方案`, meta: { client, demand, delivery, docNo, version, date: today(), orderStatus: o.status }, sections, footer: { author: '全自主 AI 经营体 · 主 AI 统筹者', date: today() } };
}

function defaultLines(client, demand) {
  return [
    `客户「${client}」提出「${demand}」需求。目标是在既定交付窗口内，以足够质量交付可验收的产物，并沉淀为可复用的知识资产。`,
    '经营体按「接单 → 报拆解 → 并行生产 → 交叉质检 → 交付归档」的链路推进，全程由主 AI 统筹、5 名 AI 分身并行协作。'
  ];
}
function defaultScope() {
  return [
    '本方案覆盖需求解析、任务拆解、并行生产、质量校验与交付归档的全部环节；',
    '不含超出本次交付范围的追加服务；如需扩展需求，将重新评估交付窗口后单独受理。'
  ];
}
function defaultPlan() {
  return [
    '阶段 1 · 拆解派发：解析需求依赖，建立关键路径并将任务并行排入生产队列；',
    '阶段 2 · 并行生产：各分身按验收口径推进，交叉质检并自动回退返工；',
    '阶段 3 · 交付归档：汇总产物、复核验收标准、归档入库并同步知识图谱。'
  ];
}

/* ---------------- Word 风格预览 ---------------- */
export function renderDocPreview(container, content) {
  const s = content.sections || [];
  const dl = s.find(x => x.id === 'deliverables');
  const table = dl && dl.table && dl.table.length
    ? `<table class="dr-table"><thead><tr><th>序号</th><th>交付物</th><th>格式</th><th>责任 AI</th></tr></thead><tbody>${dl.table.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.item)}</td><td>${esc(r.fmt)}</td><td>${esc(r.owner)}</td></tr>`).join('')}</tbody></table>`
    : '';
  const body = s.map(sec => {
    const lines = (sec.body || []).map(t => `<p>${esc(t)}</p>`).join('');
    const tbl = sec.id === 'deliverables' ? table : '';
    return `<section class="dr-sec" data-sec="${sec.id}"><h2>${esc(sec.h)}</h2>${lines}${tbl}</section>`;
  }).join('');
  const m = content.meta;
  container.innerHTML = `
    <header class="dr-header">
      <div class="dr-brand">AIC · 自主经营体</div>
      <div class="dr-titledoc">交付方案 · Deliverable</div>
    </header>
    <h1 class="dr-title">${esc(content.title)}</h1>
    <table class="dr-meta">
      <tr><th>客户</th><td>${esc(m.client)}</td><th>编号</th><td>${esc(m.docNo)}</td></tr>
      <tr><th>需求</th><td>${esc(m.demand)}</td><th>版本</th><td>${esc(m.version)}</td></tr>
      <tr><th>交付</th><td colspan="3">${esc(m.delivery)}</td></tr>
    </table>
    ${body}
    <footer class="dr-foot">${esc(content.footer.author)} · ${esc(content.footer.date)}</footer>`;
}

/* ---------------- 审阅引擎（依据文档真实内容指出不足） ---------------- */
export function reviewDoc(content, context = {}) {
  const findings = [];
  const has = id => (content.sections || []).some(x => x.id === id);
  const secBody = id => { const s = (content.sections || []).find(x => x.id === id); return s && s.body ? s.body.join('') : ''; };
  const dl = (content.sections || []).find(x => x.id === 'deliverables');
  const order = context.order || {};
  const tasks = Array.isArray(context.tasks) ? context.tasks : [];
  const discussion = Array.isArray(context.discussion) ? context.discussion : [];
  const taskTitles = tasks.map(t => t && t.title).filter(Boolean);
  const listedTitles = (dl && dl.table || []).map(r => r.item).filter(Boolean);
  const openTasks = tasks.filter(t => t && ['doing', 'queued', 'blocked', 'rework', 'wait'].includes(t.status));
  const hasUnresolvedDiscussion = discussion.find(x => /待确认|待补充|阻塞|返工|超时|风险|未完成|进行中/.test(String(x)));

  if (!has('acceptance')) findings.push({ level: 'high', source: '文档结构', section: '验收标准', issue: '缺失「验收标准」章节，无法界定交付是否合格', evidence: '文档章节扫描未找到验收标准', suggestion: '补充可量化验收口径：关键节点通过率、性能阈值与签署确认流程。' });
  if (!has('conclusion')) findings.push({ level: 'high', source: '文档结构', section: '结论', issue: '缺少「结论」章节，收尾仓促', evidence: '文档章节扫描未找到结论', suggestion: '在文末给出明确结论、归档状态与下一步动作。' });
  const m = content.meta || {};
  if (!m.client || !m.demand || !m.docNo || !m.version || !m.date) findings.push({ level: 'high', source: '订单字段', section: '订单信息', issue: '客户、需求、编号、版本或日期存在空缺', evidence: `客户=${m.client || '空'}，需求=${m.demand || '空'}，编号=${m.docNo || '空'}，版本=${m.version || '空'}，日期=${m.date || '空'}`, suggestion: '补齐订单元数据后再提交审阅。' });
  if (order.status === 'settled' && m.orderStatus !== 'settled') findings.push({ level: 'mid', source: '订单字段', section: '交付状态', issue: '订单已归档，但文档状态未同步为已交付', evidence: `订单状态=${order.status}，文档状态=${m.orderStatus || '未记录'}`, suggestion: '同步归档时间与最终交付状态。' });
  if (tasks.length && taskTitles.some(t => !listedTitles.includes(t))) findings.push({ level: 'high', source: '任务状态', section: '交付清单', issue: '存在任务未对应到交付物', evidence: `未列入清单：${taskTitles.filter(t => !listedTitles.includes(t)).join('、')}`, suggestion: '逐项补入任务产出、格式和责任 AI。' });
  if (listedTitles.length !== new Set(listedTitles).size) findings.push({ level: 'mid', source: '文档结构', section: '交付清单', issue: '交付清单存在重复项', evidence: '检测到相同交付物标题重复出现', suggestion: '合并重复条目并保留唯一责任归属。' });
  if (openTasks.length && /各项交付物已完成并归档/.test(secBody('conclusion'))) findings.push({ level: 'high', source: '任务状态', section: '结论', issue: '结论声称已完成，但仍有任务未闭环', evidence: `未闭环任务：${openTasks.map(t => `${t.title}（${t.status}）`).join('、')}`, suggestion: '改为阶段性交付，待任务完成、阻塞解除并复核后再归档。' });
  if (hasUnresolvedDiscussion && /各项交付物已完成并归档/.test(secBody('conclusion'))) findings.push({ level: 'mid', source: '群聊风险', section: '风险与结论', issue: '群聊仍有未闭环风险，但文档结论已写成最终归档', evidence: String(hasUnresolvedDiscussion).slice(0, 160), suggestion: '在文档中记录风险处理结果，未闭环前不要写最终归档。' });
  const plan = secBody('plan');
  if (!plan || plan.length < 35 || /待补充|待填|占位/.test(plan)) findings.push({ level: 'mid', source: '文档结构', section: '执行与排期', issue: '排期缺少可执行的阶段、依赖或责任说明', evidence: plan || '执行与排期为空', suggestion: '补充阶段、关键依赖、责任 AI 与交付节点。' });
  const acceptance = secBody('acceptance');
  if (acceptance && !/(通过率|阈值|确认|验收)/.test(acceptance)) findings.push({ level: 'low', source: '文档结构', section: '验收标准', issue: '验收标准缺少可判断条件', evidence: '验收章节未检测到通过率、阈值或确认条件', suggestion: '增加可量化指标和明确的验收动作。' });
  if (dl && (!dl.table || !dl.table.length) && tasks.length) findings.push({ level: 'high', source: '任务状态', section: '交付清单', issue: '订单存在任务，但交付清单为空', evidence: `当前订单关联任务 ${tasks.length} 项`, suggestion: '将实际任务产出逐项写入交付清单。' });

  const score = Math.max(0, 100 - findings.reduce((a, f) => a + ({ high: 18, mid: 10, low: 5 }[f.level] || 8), 0));
  return { findings, pass: findings.length === 0, score };
}

/* ---------------- 真实 .docx 下载（尽力而为，失败降级） ---------------- */
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function fileName(content) {
  const base = (content.meta && content.meta.demand) || '交付方案';
  return `AIC-${esc(base)}-${(content.meta && content.meta.docNo) || 'doc'}`.replace(/[\\/:*?"<>|]/g, '-');
}

export async function downloadDocx(content) {
  const D = window.docx;
  if (D && D.Packer && D.Document) {
    try {
      const rows = (content.sections.find(s => s.id === 'deliverables') || {}).table || [];
      const children = [];
      /* docx 文本不经 HTML 转义，需显式脱敏：保证下载件同样不含金额与价格字眼 */
      const tx = v => AIC.stripMoney(String(v == null ? '' : v));
      children.push(new D.Paragraph({ heading: D.HeadingLevel.TITLE, children: [new D.TextRun({ text: tx(content.title) })] }));
      children.push(new D.Paragraph({ children: [new D.TextRun({ text: `客户：${tx(content.meta.client)}   需求：${tx(content.meta.demand)}   交付：${tx(content.meta.delivery)}` })] }));
      children.push(new D.Paragraph({ children: [new D.TextRun({ text: `文档编号：${tx(content.meta.docNo)}   版本：${tx(content.meta.version)}   日期：${tx(content.meta.date)}` })] }));
      (content.sections || []).forEach(sec => {
        children.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, children: [new D.TextRun({ text: tx(sec.h) })] }));
        (sec.body || []).forEach(t => children.push(new D.Paragraph({ children: [new D.TextRun({ text: tx(t) })] })));
        if (sec.id === 'deliverables' && rows.length) {
          children.push(new D.Table({
            width: { size: 100, type: D.WidthType.PERCENTAGE },
            rows: [
              new D.TableRow({ children: ['序号', '交付物', '格式', '责任'].map(h => new D.TableCell({ children: [new D.Paragraph({ children: [new D.TextRun({ text: h, bold: true })] })] })) }),
              ...rows.map((r, i) => new D.TableRow({ children: [i + 1, r.item, r.fmt, r.owner].map(c => new D.TableCell({ children: [new D.Paragraph({ children: [new D.TextRun({ text: tx(c) })] })] })) }))
            ].filter(Boolean)
          }));
        }
      });
      children.push(new D.Paragraph({ children: [new D.TextRun({ text: tx(`— ${content.footer.author} · ${content.footer.date}`) })] }));
      const doc = new D.Document({ sections: [{ children }] });
      const blob = await D.Packer.toBlob(doc);
      saveBlob(blob, fileName(content) + '.docx');
      return true;
    } catch (err) { /* 忽略，走降级 */ }
  }
  /* 降级：Word 兼容 HTML，作为 .doc 下载 */
  const html = (() => {
    let h = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(content.title)}</title></head><body><h1>${esc(content.title)}</h1>`;
    h += `<p>客户：${esc(content.meta.client)}　需求：${esc(content.meta.demand)}　版本：${esc(content.meta.version)}　编号：${esc(content.meta.docNo)}　日期：${esc(content.meta.date)}</p>`;
    (content.sections || []).forEach(sec => {
      h += `<h2>${esc(sec.h)}</h2>`;
      (sec.body || []).forEach(t => h += `<p>${esc(t)}</p>`);
      if (sec.id === 'deliverables' && sec.table && sec.table.length) {
        h += `<table border="1" cellpadding="4"><tr><th>序号</th><th>交付物</th><th>格式</th><th>责任</th></tr>${sec.table.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.item)}</td><td>${esc(r.fmt)}</td><td>${esc(r.owner)}</td></tr>`).join('')}</table>`;
      }
    });
    h += `<p style="margin-top:24px">— ${esc(content.footer.author)} · ${esc(content.footer.date)}</p></body></html>`;
    return h;
  })();
  saveBlob(new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), html], { type: 'application/msword' }), fileName(content) + '.doc');
  return false;
}

/* ---------------- 弹窗：打开 + 自动审阅（单例，防自动弹窗叠加） ---------------- */
let activeReview = null;   // { docNo, destroy, api }
export function openDocReview(content, order, opts = {}) {
  const root = document.getElementById('doc-review');
  if (!root) return null;
  const context = opts.context || {};
  const docNo = String((content && content.meta && content.meta.docNo) || '');

  /* 同文档且弹窗已开 → 复用既有实例：不重渲染、不重启审阅（自动弹窗连击安全） */
  if (activeReview && activeReview.docNo === docNo && root.classList.contains('dr-on')) {
    return activeReview.api;
  }
  /* 打开的是另一份文档 → 先拆除旧实例（清定时器与监听，DOM 就地复用） */
  if (activeReview) activeReview.destroy();

  const el = id => root.querySelector(id);
  const paper = el('#dr-paper');
  const statusEl = el('#dr-status');
  const sideList = el('#dr-findings');
  const scoreEl = el('#dr-score');
  const batchEl = el('#dr-batch');
  const auditBtn = el('#dr-audit');
  const dlBtn = el('#dr-download');
  const reviewStream = el('#dr-review-stream');
  const chat = el('#dr-chat');
  const onFindings = opts.onFindings;
  let running = false;
  let round = 0;
  let returnFocus = null;          /* 打开前的焦点，关闭时归还 */
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { while (timers.length) clearTimeout(timers.pop()); };
  root.dataset.docNo = docNo;

  renderDocPreview(paper, content);
  el('#dr-title').textContent = `${content.title}.docx  - Word`;
  if (auditBtn) { auditBtn.disabled = false; auditBtn.textContent = '开始 AI 审阅'; }
  if (chat) {
    const rows = context.chatRows || [];
    chat.innerHTML = `<div class="dr-chat-day">交付方案 · ${esc(content.meta.date)}</div>${rows.map(r => { const ts = chatTs(r); return `<div class="dr-chat-row ${r.main ? 'dr-chat-row--ai' : ''}"><div class="dr-chat-avatar">${esc(r.who || 'AI').slice(0, 1)}</div><div class="dr-chat-bubble"><b>${esc(r.who || 'AI')}</b><span>${esc(r.text || '')}</span><small data-ts="${ts}">${fmtAgo(ts)}</small></div></div>`; }).join('')}<div class="dr-file-card"><svg class="dr-file-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#ft-word"></use></svg><div class="dr-file-main"><b>${esc(content.title)}.docx</b><span>交付方案 · ${esc(content.meta.version)} · ${esc(content.meta.docNo)}</span><small>主 AI 上传 · ${esc(content.meta.date)} · 已生成</small></div><strong>DOCX</strong><em>已上传</em></div>`;
    chat.scrollTop = chat.scrollHeight;
  }
  statusEl.textContent = '等待 AI 审阅';
  statusEl.className = 'dr-status dr-status--wait';
  sideList.innerHTML = '<div class="dr-empty">由数据分析读取订单、任务和群聊证据…</div>';
  if (reviewStream) reviewStream.innerHTML = '<div class="dr-stream-line">读取订单字段 → 关联任务 → 群聊风险 → 验收章节</div>';
  scoreEl.innerHTML = '';
  batchEl.textContent = '第 1 轮';

  function appendStream(text, kind = '') {
    if (!reviewStream) return;
    const line = document.createElement('div');
    line.className = `dr-stream-line ${kind ? `dr-stream-line--${kind}` : ''}`;
    line.textContent = text;
    reviewStream.appendChild(line);
    reviewStream.scrollTop = reviewStream.scrollHeight;
  }
  function appendChat(who, text, main = false) {
    if (!chat) return;
    const row = document.createElement('div');
    row.className = `dr-chat-row ${main ? 'dr-chat-row--ai' : ''}`;
    row.innerHTML = `<div class="dr-chat-avatar">${esc(who).slice(0, 1)}</div><div class="dr-chat-bubble"><b>${esc(who)}</b><span>${esc(text)}</span><small data-ts="${Date.now()}">${fmtAgo(Date.now())}</small></div>`;
    chat.appendChild(row);
    chat.scrollTop = chat.scrollHeight;
  }

  function run() {
    if (running) return;
    clearTimers();            // 重入前清掉上一轮挂起的步骤，避免重复追加
    running = true;
    round++;
    batchEl.textContent = `第 ${round} 轮`;
    auditBtn.disabled = true;
    auditBtn.textContent = '审阅中…';
    statusEl.textContent = '审阅中 · 读取真实证据…';
    statusEl.className = 'dr-status dr-status--run';
    sideList.innerHTML = '<div class="dr-empty dr-empty--live"><span class="eb-caret"></span>正在比对订单字段、任务状态与群聊风险…</div>';
    appendStream('订单字段一致性检查中…');
    later(() => appendStream('关联任务与交付清单比对中…'), 650);
    later(() => appendStream('群聊风险与结论一致性检查中…'), 1200);
    later(() => {
      const res = reviewDoc(content, context);
      const { findings, pass, score } = res;
      statusEl.textContent = pass ? '审阅完成 · 无不足' : '审阅完成 · 指出不足';
      statusEl.className = 'dr-status ' + (pass ? 'dr-status--ok' : 'dr-status--bad');
      scoreEl.innerHTML = `<div class="dr-score ${pass ? 'dr-score--ok' : 'dr-score--warn'}"><b>${Math.round(score)}</b><span>${pass ? '真实检查通过 · 准予归档' : `命中 ${findings.length} 项 · 待修订`}</span></div>`;
      if (reviewStream) {
        reviewStream.innerHTML = '';
        appendStream(pass ? '检查完成：未发现订单、任务、讨论或文档结构问题。' : `检查完成：发现 ${findings.length} 项需要回写的实际问题。`, pass ? 'ok' : 'risk');
        findings.forEach(f => appendStream(`${f.source} · ${f.section}：${f.issue}`, 'risk'));
      }
      sideList.innerHTML = pass
        ? '<div class="dr-pass"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg><b>无不足 · 文档规范</b><span>真实订单、任务状态、交付清单与群聊证据均已对齐，可直接签署归档。</span></div>'
        : findings.map(f => `<div class="dr-find dr-find--${f.level}"><span class="dr-find__tag">${levelLabel(f.level)}</span><div><b>${esc(f.source)} · ${esc(f.section)}</b><strong>${esc(f.issue)}</strong><span>证据：${esc(f.evidence)}</span><em>建议：${esc(f.suggestion)}</em></div></div>`).join('');
      auditBtn.disabled = false;
      auditBtn.textContent = '重新审阅';
      running = false;
      if (typeof onFindings === 'function') onFindings(res, content, order, round);
    }, 2600);
  }

  function onKeydown(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
  /* 点击遮罩空白关闭：window2-review.css 下弹窗满屏，此分支通常不可达，保留以兼容居中布局 */
  function onBackdrop(e) { if (e.target === root) close(); }

  auditBtn.onclick = run;
  dlBtn.onclick = () => downloadDocx(content);
  el('#dr-close').onclick = close;
  el('#dr-close2').onclick = close;
  document.addEventListener('keydown', onKeydown);
  root.addEventListener('click', onBackdrop);

  function destroy() {
    clearTimers();
    document.removeEventListener('keydown', onKeydown);
    root.removeEventListener('click', onBackdrop);
    running = false;
  }
  function close() {
    destroy();
    root.hidden = true;
    root.classList.remove('dr-on');
    document.body.classList.remove('dr-lock');
    if (activeReview && activeReview.docNo === docNo) activeReview = null;
    /* 焦点归还触发元素（chip / 群聊气泡 / 知识目录行），键盘流不中断 */
    if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus();
    returnFocus = null;
  }
  function open() {
    /* 记住触发元素，并把焦点移进弹窗：否则 Tab 仍在背景内容里游走、ESC 之后也不知身在何处。
       焦点落在弹窗容器（tabindex=-1，不产生可见焦点环），Tab 再进入内部控件。 */
    returnFocus = document.activeElement;
    root.hidden = false;
    root.classList.add('dr-on');
    document.body.classList.add('dr-lock');
    const win = root.querySelector('.doc-review__window');
    if (win) { win.setAttribute('tabindex', '-1'); win.focus({ preventScroll: true }); }
  }
  open();
  mountTimeTicker();
  if (opts.auto !== false) run();
  const api = { close, docNo, isOpen: () => root.classList.contains('dr-on') };
  activeReview = { docNo, destroy, api };
  return api;
}