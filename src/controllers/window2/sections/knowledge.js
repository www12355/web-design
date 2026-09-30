/* ============================================================
   第 4 屏 section · 知识（原 window2.js 戴森球联动 / 星表目录逐行等价迁移，P3-1）
   挂载条件：页面存在 #nebula（戴森球画布）。
   对思考链 / 群聊的跨 section 调用一律走 bus。
   ============================================================ */
import { Nebula } from '../../../modules/nebula.js';
import { buildDocContent, openDocReview } from '../../../modules/docgen.js';
import { DOCS } from '../../../data/documents.js';
import {
  World, CAST, nowHM, fmtAgo, gsapOK,
  whoName, setDocRef, bus
} from '../shared.js';

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
  if (gsapOK()) gsap.from(row, { backgroundColor: 'rgba(10,132,255,0.12)', duration: 1.8, ease: 'power2.out' });
}

/* 知识图谱联动：任务完成点亮对应数字员工锚点（戴森球上的球形脉冲） */
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

/* 模板变换：星表头芯片 + 页面级 data-tpl（第一/二/四屏同拍联动，P3-2） */
function applyTemplate(tplId) {
  const tpl = ['badge', 'dossier', 'signal'].includes(tplId) ? tplId : 'badge';
  const root = document.querySelector('.p4');
  if (root) root.dataset.tpl = tpl;
  const chip = document.getElementById('atlas-tpl');
  if (chip) chip.textContent = `模板 · ${tpl === 'badge' ? '工牌' : tpl === 'dossier' ? '档案' : '信号'}`;
}

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

export function initKnowledge() {
  if (!document.getElementById('nebula')) return;   /* 本页无戴森球：不挂载 */
  bus.shelf.addShelfRow = addShelfRow;
  bus.pulse = pulseAgent;
  bus.kbAdd = (who, title, meta) => { if (Nebula && Nebula.addKnowledge) Nebula.addKnowledge(who, title, meta); };
  bus.kbRework = (t) => {
    if (Nebula && Nebula.stats && t.owner) {
      const match = Nebula.stats().current ? Nebula.getPoint(Nebula.stats().current) : null;
      if (match && match.agentKey === t.owner) Nebula.inspect(match.id);
      else Nebula.addKnowledge(t.owner, t.title, { sourceTask: t.title });
    }
  };
  bus.kb.template = applyTemplate;
  applyTemplate(World.staffTemplate);

  /* 知识统计 + 搜索联动 */
  const catSearch = document.getElementById('cat-search');
  if (catSearch) {
    const catalog = document.querySelector('.atlas-catalog');
    const groups = [...document.querySelectorAll('.atlas-catalog .shelf-group')];
    /* 无匹配时所有分组都会被隐藏，滚动区变成一片空白 ——
       用户分不清是「确实没有这条知识」还是「列表坏了」。补一条空态。 */
    const catEmpty = document.createElement('div');
    catEmpty.className = 'cat-empty';
    catEmpty.hidden = true;
    catEmpty.textContent = '没有匹配的知识条目 —— 换个关键词，或清空搜索框查看全部。';
    const catScroll = catalog && catalog.querySelector('.cat-scroll');
    if (catScroll) catScroll.appendChild(catEmpty);

    catSearch.addEventListener('input', () => {
      const q = catSearch.value.trim().toLowerCase();
      let total = 0;
      groups.forEach(g => {
        let vis = 0;
        g.querySelectorAll('.shelf-row').forEach(r => {
          const hit = !q || r.textContent.toLowerCase().includes(q);
          r.hidden = !hit;
          if (hit) vis++;
        });
        g.hidden = vis === 0;
        total += vis;
      });
      catEmpty.hidden = total > 0;
    });
    catSearch.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      /* 限定在知识索引内取首行：原先查的是整个文档，会捞到别的区块的行 */
      const first = catalog ? catalog.querySelector('.shelf-row:not([hidden])') : null;
      if (first) { first.click(); bus.eb.wakeIdle(); }
    });
  }

  /* 第4屏知识目录：单击条目 → 打开该文档的交付审阅弹窗
     （原有「定位知识图谱」已迁到双击触发，见 nebula.js） */
  document.querySelectorAll('.atlas-catalog .shelf-row[data-doc]').forEach(row => {
    const d = DOCS.find(x => x.id === row.dataset.doc);
    if (!d) return;
    row.title = '单击打开交付审阅 · 双击定位知识图谱';
    const open = () => {
      const { order, context, content } = docContentFromCatalog(d);
      setDocRef(content.meta.docNo, { content, order, context });
      bus.eb.wakeIdle();
      openDocReview(content, order, { context });
    };
    /* 键盘可达：这些行是可点行但不是原生控件，原先只绑了 click ——
       Tab 到不了、回车也打不开，键盘用户根本进不去交付审阅。 */
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.addEventListener('click', open);
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  /* 戴森球自主观测：画布详情与思考流同步 */
  if (Nebula && Nebula.on) {
    Nebula.on(({ type, payload }) => {
      if (!payload) return;
      if (type === 'inspect:start') bus.think.quick(`自主观测 · ${payload.title}`,
        `${whoName(payload.agentKey)} 打开知识点「${payload.title}」。`,
        `推演：调取历史结论与当前上下文，先列出需要比对的差异维度。`,
        `已进入比对阶段，等待候选结论。`,
        { prio: 3 });
      if (type === 'inspect:written') bus.think.quick(`知识写入 · ${payload.title}`,
        `最佳结果写入：「${payload.title}」，置信度 ${Math.round(payload.confidence * 100)}%。`,
        `推演：与既有条目的冲突项已消解，索引关系同步更新。`,
        `已入库，后续推理可直接调用。`,
        { prio: 3 });
      if (type === 'inspect:improved') bus.think.quick(`知识复盘 · ${payload.title}`,
        `第 ${payload.revisionCount} 次修订完成：「${payload.title}」。`,
        `推演：修订逐次收敛，结论稳定性提升，可上调调用优先级。`,
        `复盘归档，知识资产质量上升。`,
        { prio: 3 });
      if (type === 'point:add' && payload.sourceTask && payload.sourceTask !== '自主学习') bus.think.quick(`知识新增 · ${payload.title}`,
        `新增知识点：「${payload.title}」，来源任务 ${payload.sourceTask}。`,
        `推演：归入 ${whoName(payload.agentKey)} 的知识域，与既有条目建立关联。`,
        `已关联 ${whoName(payload.agentKey)}，索引就绪。`,
        { prio: 3 });
    });
  }
}

export { syncHeroDocVer };
