/* ============================================================
   section · 交付文档生成与审阅（原 window2.js 交付产物块逐行等价迁移，P3-1）
   挂载条件：无（任意页面可挂载）。对思考链 / 群聊 / 知识库的调用全部走 bus，
   页面缺对应 section 时自动空转（如 screen3 无群聊，成稿播报仅写思考链）。
   ============================================================ */
import { World } from '../../../modules/world.js';
import { buildDocContent, reviewDoc, openDocReview } from '../../../modules/docgen.js';
import { later, setDocRef, bus } from '../shared.js';

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
  bus.think.chain(`成稿 · ${content.title}`, [
    { p: 'obs',   t: `交付记录齐备：「${demand}」相关任务均已验收，素材窗口关闭。` },
    { p: 'cut',   t: `结构盘点：按 ${content.meta.docNo} 目录归并章节，逐节标注来源订单。` },
    { p: 'sim',   t: `口径推演：正文数字与交付台账逐项比对，偏差段落留待初审定位。` },
    { p: 'judge', t: `初审判定交由数据分析：格式与完整性先跑一轮，避免带病归档。` },
    { p: 'concl', t: `《${content.title}》成稿完成，已进入审阅流程。` }
  ], { prio: 5 });
  if (silent) return;
  bus.chat.queueChat('analyst', `已整理「${demand}」交付记录，初稿《${content.title}》已生成。`, false,
    `先盘点订单字段与各章节结构；对照验收口径逐节抽查，把「格式与完整性」先跑一遍再报结论。`);
  later(() => {
    bus.chat.queueChat('main', `《${content.title}》已进入审阅流程，数据分析逐节核查并据实指出不足。`, true,
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
  bus.kbAdd('main', title, {
    type: 'DOCX', version: content.meta.version, client: content.meta.client,
    reviewedAt: content.meta.date, source: 'AI 审阅通过'
  });
  bus.shelf.addShelfRow(`${content.title} · 已审阅归档`);
  bus.think.quick(`归档 · ${content.title}`,
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
    bus.think.quick(`审阅通过 · ${title}`,
      `逐节核查完成：结构、字段、格式全部合规。`,
      `推演：未命中缺口，无需回退修订，直接进入归档路径。`,
      `签署归档：${title} 交付闭环完成。`,
      { prio: 6 });
    bus.chat.queueChat('main', `已审：《${demand}》文档无不足，规范齐整，直接签署归档。`, true,
      `逐节核查未命中任何缺口：结构、字段、格式全部合规。据实不指出不足，直接进入归档，不返回修订。`, {
        kind: 'file', fileName: `${title}.docx`, fileType: 'DOCX', docId: content.meta.docNo,
        fileMeta: `交付方案 · ${content.meta.version} · ${content.meta.docNo}`,
        fileSub: 'AI 审阅完成 · 已交给第三屏主 AI 归档', fileStatus: '已通过'
      });
  } else {
    const top = res.findings[0];
    bus.think.chain(`审阅未过 · ${title}`, [
      { p: 'obs',   t: `命中 ${res.findings.length} 处不足：${res.findings.map(f => f.section).join('、')}。`, risk: true },
      { p: 'cut',   t: `分级定位：区分阻断项与建议项，阻断项先行回退。` },
      { p: 'sim',   t: `推演：按修订清单逐条回写，复审只校验改动段落，避免整体重跑。` },
      { p: 'concl', t: `已回退修订，修订完成后自动复审。`, risk: true }
    ], { prio: 9, tone: 'risk' });
    bus.chat.queueChat('analyst', `审阅回来：先说第 1 节「${top.section}」——${top.issue}。`, false,
      `对照验收口径逐节比对，「${top.section}」是阻断项：${top.issue}；建议 ${top.suggestion}，其余先通过，不阻塞整体节奏。`);
    later(() => {
      bus.chat.queueChat('main', `已汇总审阅：共 ${res.findings.length} 处不足，反馈修订后再复审；其余通过。`, true,
        `本次审阅命中的不足：${res.findings.map(f => f.section).join('、')}。逐条回写修订清单，修完复审判定收尾。`, {
          kind: 'review', fileName: `${title}.docx`, fileType: 'DOCX', docId: content.meta.docNo,
          fileMeta: `交付方案 · ${content.meta.version} · ${content.meta.docNo}`,
          fileSub: `${top.source} · ${top.issue}`, fileStatus: '待修订'
        });
    }, 1800);
  }
}
export function generateDeliverableDoc(order, silent, opts = {}) {
  const o = order || latestDeliveredOrder();
  const tasks = tasksOfOrder(o);
  const chatRows = bus.chat.threadRows();
  const discussion = bus.chat.discussion();
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
  if (opts.openReview) openDocReview(content, o, { context, autoClose: opts.autoClose });
  return content;
}

export function initDocgen() {
  bus.doc.generate = generateDeliverableDoc;
}
