/* ============================================================
 * AI 员工轮播 · 模板与名单数据源（screen1 独有，不污染四屏共享 cast.js）
 * 纯数据模块：3 套轮播模板 / 形状与墨色注册表 / 名单随机装配与去重
 *
 * 口径（用户确认）：
 * · 每个 AI 有唯一且跨模板稳定的可读 ID（STAFF_ID 注册表）；
 * · 同一套名单内颜色与形状不得重复（dedupe 收尾 pass 保证）；
 * · 真实角色为主（状态/任务来自 World 实时数据），名单 ≥4 人时
 *   以约 35% 概率补 1 名虚拟员工（仅静态档案，不接实时状态）；
 * · 主 AI 跨模板常驻首位。
 * ============================================================ */
import { CAST } from './cast.js';

/* 形状注册表：与 bloub.js 的 SHAPES id 一一对应（cercle 已被主 AI 常驻占用） */
export const SHAPES = ['cercle', 'galet', 'squircle', 'capsule', 'triangle', 'hexagone', 'carre', 'nuage', 'goutte'];

/* 墨色池：BallCore.COLORS 12 色注册表去重（orange/ambre、vert/turquoise 各为同值），
   并入 cast.js 角色独有的靛 #818cf8 与翠 #34d399，共 12 个独立色值。
   只允许作为头像墨色与名单内信号点（--sig）出现，不参与状态编码（DESIGN.md §2）。 */
export const INK_POOL = [
  '#5ec8ff', '#2dd4bf', '#ffd23f', '#c084fc', '#818cf8', '#34d399',
  '#f472b6', '#ff5a6a', '#ffb347', '#a3a3a3', '#eafdff', '#f1efe9'
];

/* 三套轮播模板：layout 决定卡片骨架（CSS 变体类 staff-card--*），kbTopic 是知识库读数的专题标签 */
export const STAFF_TEMPLATES = [
  { id: 'badge', name: '工牌轮播', tag: '值机', layout: 'badge', kbTopic: '个人入库', desc: '值机工牌横卡：头像左置，任务与知识库贡献常驻。' },
  { id: 'dossier', name: '档案轮播', tag: '在册', layout: 'dossier', kbTopic: '档案引用', desc: '在册档案竖卡：头像居上，任务进度线收底。' },
  { id: 'signal', name: '信号轮播', tag: '在线', layout: 'signal', kbTopic: '全局吞吐', desc: '在线信号卡：头像主导，只读身份与状态。' }
];

/* 稳定 ID 注册表：同一 AI 在任何模板中 ID 不变，保证「单独的 ID 识别」。
   虚拟员工使用固定键，重复出场不换号。 */
const STAFF_ID = {
  main: 'AI-00', planner: 'PL-01', writer: 'WR-01', analyst: 'AN-01',
  designer: 'DE-01', engineer: 'EN-01', qc: 'QC-01',
  'v-loc': 'LOC-01', 'v-sec': 'SEC-01', 'v-cs': 'CS-01'
};

/* 主 AI：跨模板常驻首位。墨色 #ffffff 与旧接力线领跑位一致。 */
const MAIN = {
  uid: 'main', name: '主 AI', role: 'MAIN', shape: 'cercle', ink: '#ffffff', expr: 'attentif',
  virtual: false, main: true,
  think0: '统筹全局：自动接单、派发与归档；监控各线进度与阻塞，优先消解关键路径风险。'
};

/* 虚拟员工池：仅作档案展示。形状取角色未占用的 squircle/triangle，
   第三位复用 galet，若与同名单真实角色撞车由 dedupe 换牌。 */
const VIRTUAL_POOL = [
  {
    uid: 'v-loc', name: '多语本地化', role: 'LOCALIZE', shape: 'squircle', ink: '#f472b6', expr: 'curieux', virtual: true,
    think0: '三语术语表已对齐；先统一计量与日期口径，再批量回填长句翻译，最后做一轮界面截断排查。',
    skills: [['术语对齐', 91], ['语序本地化', 88]]
  },
  {
    uid: 'v-sec', name: '安全合规', role: 'SECURITY', shape: 'triangle', ink: '#ff5a6a', expr: 'attentif', virtual: true,
    think0: '弱口令告警已清零；下一步复核数据出域审批链路，并补一次权限最小化巡检。',
    skills: [['漏洞巡检', 92], ['合规审计', 89]]
  },
  {
    uid: 'v-cs', name: '客户成功', role: 'SUCCESS', shape: 'galet', ink: '#ffb347', expr: 'heureux', virtual: true,
    think0: '回访队列按交付时间排序；优先跟进新归档客户，收集首轮使用反馈并回写知识库。',
    skills: [['客户回访', 90], ['反馈沉淀', 87]]
  }
];

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/* 生成全新成员对象并归一化字段名（CAST 用 key/color，虚拟池用 uid/ink）：
   避免 dedupe 就地改写污染 CAST / VIRTUAL_POOL 原始数据 */
function toMember(src) {
  const uid = src.uid || src.key;
  return { ...src, uid, ink: src.ink || src.color, virtual: !!src.virtual, id: STAFF_ID[uid] || uid };
}

/* 同一名单内的形状/墨色去重：真实角色与主 AI 保持登记形状（与甘特 --c-* 角色信号跨区一致），
   虚拟补位撞车时从余量池换牌（名单 ≤7 人 < 9 形状 / 12 墨色，必然找得到空位）。 */
function dedupe(members) {
  const usedS = new Set();
  const usedI = new Set();
  const virtuals = [];
  members.forEach((m) => {
    if (m.virtual) { virtuals.push(m); return; }
    usedS.add(m.shape);
    usedI.add(m.ink);
  });
  virtuals.forEach((m) => {
    if (usedS.has(m.shape)) m.shape = SHAPES.find(s => !usedS.has(s)) || m.shape;
    if (usedI.has(m.ink)) m.ink = INK_POOL.find(c => !usedI.has(c)) || m.ink;
    usedS.add(m.shape);
    usedI.add(m.ink);
  });
  return members;
}

/* 装配一套名单：返回 { tpl, members }；members 含主 AI 在内共 4-7 张卡（员工 3-6 名）。 */
export function buildRoster(tplId) {
  const tpl = STAFF_TEMPLATES.find(t => t.id === tplId) || STAFF_TEMPLATES[0];
  const size = 3 + Math.floor(Math.random() * 4);                       // 员工 3-6 名
  const vCount = size >= 4 && Math.random() < 0.35 ? 1 : 0;             // 真实为主，虚拟最多 1 名
  const reals = shuffle(CAST.slice()).slice(0, size - vCount).map(toMember);
  const virtuals = shuffle(VIRTUAL_POOL.slice()).slice(0, vCount).map(toMember);
  const members = dedupe([{ ...MAIN, id: STAFF_ID.main }, ...reals, ...virtuals]);
  return { tpl, members };
}
