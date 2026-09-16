/* ============================================================
   docgen：交付产物 · Word 文档生成 + AI 审阅引擎
   纯前端模拟，与「主 AI 经营群 / 思考过程」解耦、只做加法：
   - buildDocContent：把真实订单数据织成结构化文档模型
   - renderDocPreview：在弹窗里渲染 Word 风格 A4 预览
   - reviewDoc：按文档实际内容做规则审阅，指出不足（无不足则返回 pass）
   - downloadDocx：用 docx 库生成真实 .docx，尽力而为；失败降级为 Word 兼容 .doc
   模态 DOM 骨架与样式由 window2.html 提供，本模块只负责填充与交互。
   ============================================================ */

/* ---------------- 工具 ---------------- */
function hash(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) >>> 0;
  return h;
}
function fmtMoney(n) {
  if (n == null || n === '') return '';
  if (n >= 10000) { const w = n / 10000; return '¥' + (w >= 100 ? Math.round(w) : (Math.round(w * 10) / 10)) + '万'; }
  return '¥' + Math.round(n).toLocaleString('en-US');
}
function pad(n) { return String(n).padStart(2, '0'); }
function today() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function levelW(level) { return ({ high: 18, mid: 10, low: 5 })[level] || 8; }
function levelLabel(level) { return ({ high: '严重', mid: '中等', low: '轻微' })[level] || '提示'; }

/* 确定性缺点：~40% 的文档携带一处真实缺口，供审阅指出；其余文档完整（触发「无不足」分支） */
function pickDeficit(id) {
  const r = hash(id || '') % 10;
  if (r < 3) return 'acceptance';      // 缺「验收标准」
  if (r < 4) return 'amount';         // 金额字段为空
  if (r < 5) return 'deliverables';   // 交付清单为空
  if (r < 6) return 'conclusion';     // 缺「结论」
  return null;                        // 文档结构完整
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
  const deficit = opts.deficit !== undefined ? opts.deficit : pickDeficit(order && (order.id || order.demand));
  const amount = deficit === 'amount' ? '' : (o.amount || 0);
  const client = o.client || '（客户信息待补）';
  const demand = o.demand || '（需求待明确）';
  const version = opts.ver || 'v1.0';
  const docNo = 'AIC-' + String(hash((order && order.id) || client + demand) % 100000).padStart(5, '0');
  const delivery = (o.settledAt && o.settledAt !== '––:––') ? `已于 ${o.settledAt} 完成交付` : '已进入交付窗口';

  const deliverables = deliverablesOf(o, opts.tasks);
  const sectionTxt = {
    background: defaultLines(client, demand),
    scope: defaultScope(),
    plan: defaultPlan()
  };

  const sections = [];
  sections.push({ id: 'abstract', h: '摘要', body: [
    `面向客户「${client}」的「${demand}」订单，由全自主 AI 经营体完成需求拆解、并行生产与交付验收，全程无人力接入。${amount ? `本项目签约金额 ${fmtMoney(amount)}，${delivery}。` : '交付范围、执行排期与验收口径详见下文。'}`
  ] });
  sections.push({ id: 'background', h: '背景与目标', body: sectionTxt.background });
  sections.push({ id: 'scope', h: '交付范围', body: sectionTxt.scope });
  sections.push(deficit === 'plan' ? { id: 'plan', h: '执行与排期', body: ['（排期段落为占位文案，待补充里程碑与责任人。）'] }
    : { id: 'plan', h: '执行与排期', body: sectionTxt.plan });
  sections.push(deficit === 'deliverables'
    ? { id: 'deliverables', h: '交付清单', body: ['（本单交付清单为空。）'], table: [] }
    : { id: 'deliverables', h: '交付清单', body: ['详见下表交付物、格式与归属。'], table: deliverables });
  if (deficit !== 'acceptance') {
    sections.push({ id: 'acceptance', h: '验收标准', body: [
      '以交付清单逐项核对，确保产物格式正确、内容完整、口径与需求一致；',
      '关键节点通过率 ≥ 95%，接入方确认无阻断性缺陷后签署验收确认单，方可归档结算。'
    ] });
  }
  if (deficit !== 'conclusion') {
    sections.push({ id: 'conclusion', h: '结论', body: [
      `「${demand}」各项交付物已完成并归档，满足验收口径。本经营体将继续按节律接收下一单，交付记录与知识资产同步沉淀。`
    ] });
  }

  return {
    title: `《${demand}》交付方案`,
    meta: { client, demand, amount, delivery, docNo, version, date: today() },
    sections,
    footer: { author: '全自主 AI 经营体 · 主 AI 统筹者', date: today() }
  };
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
    '不含超出签约范围的追加服务；如需扩展需求，将重新评估窗口与费用后单独签约。'
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
      <tr><th>金额</th><td>${m.amount === '' ? '<em class="dr-void">（未填）</em>' : esc(fmtMoney(m.amount))}</td><th>版本</th><td>${esc(m.version)}</td></tr>
      <tr><th>交付</th><td colspan="3">${esc(m.delivery)}</td></tr>
    </table>
    ${body}
    <footer class="dr-foot">${esc(content.footer.author)} · ${esc(content.footer.date)}</footer>`;
}

/* ---------------- 审阅引擎（依据文档真实内容指出不足） ---------------- */
export function reviewDoc(content) {
  const findings = [];
  const has = id => (content.sections || []).some(x => x.id === id);
  const secBody = id => { const s = (content.sections || []).find(x => x.id === id); return s && s.body ? s.body.join('') : ''; };
  const dl = (content.sections || []).find(x => x.id === 'deliverables');

  if (!has('acceptance')) findings.push({ level: 'high', section: '验收标准', issue: '缺失「验收标准」章节，无法界定交付是否合格', suggestion: '补充可量化验收口径：关键节点通过率、性能阈值与签署确认流程。' });
  if (!has('conclusion')) findings.push({ level: 'high', section: '结论', issue: '缺少「结论」章节，收尾仓促', suggestion: '在文末给出明确结论、归档状态与下一步动作。' });
  if (!has('abstract')) findings.push({ level: 'low', section: '摘要', issue: '缺少摘要', suggestion: '在开头用一两句话概述客户、需求与交付结论。' });
  const m = content.meta || {};
  if (m.amount === undefined || m.amount === null || m.amount === '') findings.push({ level: 'mid', section: '摘要 / 金额', issue: '签约金额字段为空', suggestion: '补录订单金额，使交付口径与财务入账保持一致。' });
  const plan = secBody('plan');
  if (/（排期.*占位|待补充|待填|待办|ll\b/.test(plan)) findings.push({ level: 'mid', section: '执行与排期', issue: '排期段落内容过简，存在占位文案', suggestion: '展开里程碑、负责人与先后依赖，避免占位文本进入正式交付稿。' });
  if (dl && (!dl.table || !dl.table.length)) findings.push({ level: 'high', section: '交付清单', issue: '交付清单为空，无法验收', suggestion: '逐项列出交付物、文件格式与责任 AI。' });
  if (!m.version) findings.push({ level: 'low', section: '版本', issue: '未标注版本号', suggestion: '在页眉或标题标注版本，避免归档追溯困难。' });

  const score = Math.max(0, 100 - findings.reduce((a, f) => a + levelW(f.level), 0));
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
      children.push(new D.Paragraph({ heading: D.HeadingLevel.TITLE, children: [new D.TextRun({ text: content.title })] }));
      children.push(new D.Paragraph({ children: [new D.TextRun({ text: `客户：${content.meta.client}   金额：${content.meta.amount === '' ? '未填' : fmtMoney(content.meta.amount)}   交付：${content.meta.delivery}` })] }));
      children.push(new D.Paragraph({ children: [new D.TextRun({ text: `文档编号：${content.meta.docNo}   版本：${content.meta.version}   日期：${content.meta.date}` })] }));
      (content.sections || []).forEach(sec => {
        children.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, children: [new D.TextRun({ text: sec.h })] }));
        (sec.body || []).forEach(t => children.push(new D.Paragraph({ children: [new D.TextRun({ text: t })] })));
        if (sec.id === 'deliverables' && rows.length) {
          children.push(new D.Table({
            width: { size: 100, type: D.WidthType.PERCENTAGE },
            rows: [
              new D.TableRow({ children: ['序号', '交付物', '格式', '责任'].map(h => new D.TableCell({ children: [new D.Paragraph({ children: [new D.TextRun({ text: h, bold: true })] })] })) }),
              ...rows.map((r, i) => new D.TableRow({ children: [r.item, r.fmt, r.owner].map(c => new D.TableCell({ children: [new D.Paragraph({ children: [new D.TextRun({ text: c })] })] })) ))
            ].filter(Boolean)
          }));
        }
      });
      children.push(new D.Paragraph({ children: [new D.TextRun({ text: `— ${content.footer.author} · ${content.footer.date}` })] }));
      const doc = new D.Document({ sections: [{ children }] });
      const blob = await D.Packer.toBlob(doc);
      saveBlob(blob, fileName(content) + '.docx');
      return true;
    } catch (err) { /* 忽略，走降级 */ }
  }
  /* 降级：Word 兼容 HTML，作为 .doc 下载 */
  const html = (() => {
    let h = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(content.title)}</title></head><body><h1>${esc(content.title)}</h1>`;
    h += `<p>客户：${esc(content.meta.client)}　金额：${content.meta.amount === '' ? '未填' : esc(fmtMoney(content.meta.amount))}　版本：${esc(content.meta.version)}　编号：${esc(content.meta.docNo)}　日期：${esc(content.meta.date)}</p>`;
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

/* ---------------- 弹窗：打开 + 自动审阅 ---------------- */
export function openDocReview(content, order, opts = {}) {
  const root = document.getElementById('doc-review');
  if (!root) return;
  const el = id => root.querySelector(id);
  const paper = el('#dr-paper');
  const statusEl = el('#dr-status');
  const sideList = el('#dr-findings');
  const scoreEl = el('#dr-score');
  const batchEl = el('#dr-batch');
  const auditBtn = el('#dr-audit');
  const dlBtn = el('#dr-download');
  const onFindings = opts.onFindings;
  let running = false;
  let round = 0;

  renderDocPreview(paper, content);
  el('#dr-title').textContent = `${content.title}.docx  - Word`;
  statusEl.textContent = '等待 AI 审阅';
  statusEl.className = 'dr-status dr-status--wait';
  sideList.innerHTML = '<div class="dr-empty">点击「开始 AI 审阅」，由数据分析发起逐节核查…</div>';
  scoreEl.innerHTML = '';
  batchEl.textContent = '第 1 轮';

  function run() {
    if (running) return;
    running = true;
    round++;
    batchEl.textContent = `第 ${round} 轮`;
    auditBtn.disabled = true;
    auditBtn.textContent = '审阅中…';
    statusEl.textContent = '审阅中 · 逐节核查…';
    statusEl.className = 'dr-status dr-status--run';
    sideList.innerHTML = '<div class="dr-empty dr-empty--live"><span class="eb-caret"></span>正在逐节抽查：格式 → 完整性 → 逻辑一致性…</div>';

    setTimeout(() => {
      const res = reviewDoc(content);
      const { findings, pass, score } = res;
      statusEl.textContent = pass ? '审阅完成 · 无不足' : '审阅完成 · 指出不足';
      statusEl.className = 'dr-status ' + (pass ? 'dr-status--ok' : 'dr-status--bad');
      scoreEl.innerHTML = `<div class="dr-score ${pass ? 'dr-score--ok' : 'dr-score--warn'}"><b>${Math.round(score)}</b><span>${pass ? '通过率 · 准予归档' : '通过率 · 待修订'}</span></div>`;
      sideList.innerHTML = pass
        ? '<div class="dr-pass"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg><b>无不足 · 文档规范</b><span>各章节结构完整，字段齐备，格式统一，可直接签署归档。</span></div>'
        : findings.map((f, i) => `<div class="dr-find dr-find--${f.level}"><span class="dr-find__tag">${levelLabel(f.level)}</span><div><b>${esc(f.section)} · ${esc(f.issue)}</b><span>${esc(f.suggestion)}</span></div></div>`).join('');
      auditBtn.disabled = false;
      auditBtn.textContent = '重新审阅';
      running = false;
      if (typeof onFindings === 'function') onFindings(res, content, order, round);
    }, 2600 + Math.round(scoreEl ? Math.random() * 2400 : 0));
  }

  auditBtn.onclick = run;
  dlBtn.onclick = () => downloadDocx(content);
  el('#dr-close').onclick = close;
  el('#dr-close2').onclick = close;
  root.onclick = (e) => { if (e.target === root) close(); };
  function close() { root.hidden = true; root.classList.remove('dr-on'); }
  function open() {
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add('dr-on'));
    document.body.classList.add('dr-lock');
  }

  open();
  if (opts.auto !== false) run();
  return { reopen: (c, o) => { content = c; order = o; renderDocPreview(paper, content); round = 0; sideList.innerHTML = '<div class="dr-empty">点击「开始 AI 审阅」…</div>'; if (opts.auto !== false) run(); }, close };
}