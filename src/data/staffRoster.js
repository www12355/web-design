/* ============================================================
 * AI 员工注册表（v2 · P3-2 员工展示卡系统）
 * 纯数据模块：员工注册表开机一次算齐、名单随机装配、雷达数据源
 *
 * 注册表（12 名，会话内固定）：
 *   · 6 名真实角色（CAST，World 实时状态）
 *   · 3 名档案员工（VIRTUAL_POOL，静态档案）
 *   · 3 名计算型新员工（EXPANSION_POOL + 计算颜色/形状）
 * 确定性：mulberry32(当日 yyyymmdd 种子) —— 同一天各窗口计算结果
 * 完全一致（与 world.js 同模式），跨屏同名同色同形状，无需改同步协议。
 *
 * 唯一性口径（用户确认）：颜色×形状「组合」不重复——
 *   · 颜色：金角步进色相自动计算，永不与既有 hex 碰撞（可无限扩编）；
 *   · 形状：9 种按种子轮转分配（配对仍唯一）。
 * ============================================================ */
import { CAST } from './cast.js';

/* 形状注册表：与 bloub.js 的 SHAPES id 一一对应（cercle 已被主 AI 常驻占用） */
export const SHAPES = ['cercle', 'galet', 'squircle', 'capsule', 'triangle', 'hexagone', 'carre', 'nuage', 'goutte'];

/* 墨色口径：注册表既有成员使用 BallCore 12 色去重池 + cast.js 独有靛/翠
   （BallCore.COLORS / cast.js），计算型新员工由 computeColor 生成——
   全体颜色两两不同，组合（颜色×形状）唯一。墨色只做头像/信号点（DESIGN.md §2）。 */

/* 三套轮播模板：layout 决定卡片骨架（CSS 变体类），kbTopic 是知识库读数的专题标签 */
export const STAFF_TEMPLATES = [
  { id: 'badge', name: '工牌轮播', tag: '值机', layout: 'badge', kbTopic: '个人入库', desc: '值机工牌横卡：头像左置，任务与知识库贡献常驻。' },
  { id: 'dossier', name: '档案轮播', tag: '在册', layout: 'dossier', kbTopic: '档案引用', desc: '在册档案竖卡：头像居上，任务进度线收底。' },
  { id: 'signal', name: '信号轮播', tag: '在线', layout: 'signal', kbTopic: '全局吞吐', desc: '在线信号卡：头像主导，只读身份与状态。' }
];

/* 稳定 ID 注册表：同一 AI 在任何模板中 ID 不变，保证「单独的 ID 识别」。
   计算型新员工使用固定键，重复出场不换号。 */
const STAFF_ID = {
  main: 'AI-00', planner: 'PL-01', writer: 'WR-01', analyst: 'AN-01',
  designer: 'DE-01', engineer: 'EN-01', qc: 'QC-01',
  'v-loc': 'LOC-01', 'v-sec': 'SEC-01', 'v-cs': 'CS-01',
  rpa: 'RPA-01', ops: 'OPS-01', ann: 'ANN-01'
};

/* 对外查询：员工稳定显示 ID（未注册键回退为大写键名，便于新增角色即插即用） */
export function staffIdFor(key) {
  return STAFF_ID[key] || String(key || '').toUpperCase();
}

/* 主 AI：跨模板常驻首位。墨色 #ffffff 与旧接力线领跑位一致。 */
const MAIN = {
  uid: 'main', name: '主 AI', role: 'MAIN', shape: 'cercle', ink: '#ffffff', expr: 'attentif',
  virtual: false, main: true,
  skills: [['统筹调度', 96], ['依赖编排', 94], ['质量决断', 92], ['归档治理', 90]],
  think0: '统筹全局：自动接单、派发与归档；监控各线进度与阻塞，优先消解关键路径风险。'
};

/* 档案员工池：静态档案展示（无 World 实时状态） */
const VIRTUAL_POOL = [
  {
    uid: 'v-loc', name: '多语本地化', role: 'LOCALIZE', shape: 'squircle', ink: '#f472b6', expr: 'curieux', virtual: true,
    think0: '三语术语表已对齐；先统一计量与日期口径，再批量回填长句翻译，最后做一轮界面截断排查。',
    skills: [['术语对齐', 91], ['语序本地化', 88], ['截断排查', 84], ['口径统一', 86]]
  },
  {
    uid: 'v-sec', name: '安全合规', role: 'SECURITY', shape: 'triangle', ink: '#ff5a6a', expr: 'attentif', virtual: true,
    think0: '弱口令告警已清零；下一步复核数据出域审批链路，并补一次权限最小化巡检。',
    skills: [['漏洞巡检', 92], ['合规审计', 89], ['权限巡检', 86], ['出域复核', 88]]
  },
  {
    uid: 'v-cs', name: '客户成功', role: 'SUCCESS', shape: 'galet', ink: '#ffb347', expr: 'heureux', virtual: true,
    think0: '回访队列按交付时间排序；优先跟进新归档客户，收集首轮使用反馈并回写知识库。',
    skills: [['客户回访', 90], ['反馈沉淀', 87], ['满意度分析', 85], ['续约预警', 83]]
  }
];

/* 计算型扩编员工档案（颜色/形状由本模块计算分配，档案内容手工定义一次） */
const EXPANSION_POOL = [
  {
    uid: 'rpa', name: '流程自动化', role: 'RPA', expr: 'attentif', virtual: true,
    think0: '三条重复流程已脚本化；先把异常分支补进状态机，再灰度替换人工操作，最后统计节省工时。',
    skills: [['流程编排', 93], ['脚本生成', 90], ['异常回归', 87], ['效率核算', 85]]
  },
  {
    uid: 'ops', name: '运维值班', role: 'OPS', expr: 'neutre', virtual: true,
    think0: '夜间批处理窗口零告警；交接清单已按服务分级整理，重点标注两处需要白天跟进的慢查询。',
    skills: [['监控值守', 92], ['故障定位', 89], ['备份演练', 86], ['容量评估', 84]]
  },
  {
    uid: 'ann', name: '数据标注', role: 'ANNOTATE', expr: 'curieux', virtual: true,
    think0: '边界样本的标注口径已统一；抽检一致率达标后批量回流训练集，冲突样本交质检仲裁。',
    skills: [['口径统一', 91], ['抽检仲裁', 88], ['批量回流', 86], ['边界判定', 85]]
  }
];

/* ---------------- 确定性随机（同日各窗口一致，world.js 同模式） ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function dateSeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const shuffle = (arr) => seededShuffle(arr, Math.random);

/* 颜色计算：金角步进色相（≈137.508°）→ 固定饱和度/亮度 → hex。
   与既有墨色池/角色色的色相间隔充分，hex 不可能相等 —— 可无限扩编且永不重复。 */
function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function computeColor(i) {
  const baseHue = dateSeed() % 360;
  const hue = (baseHue + (i + 1) * 137.508) % 360;
  return hslToHex(hue, 0.68, 0.62);
}

/* ---------------- 注册表（开机一次算齐，模块级缓存） ---------------- */
let REGISTRY = null;
export function getRegistry() {
  if (REGISTRY) return REGISTRY;
  const rng = mulberry32(dateSeed() ^ 0x9e3779b9);
  const shapeWheel = seededShuffle(SHAPES, rng);
  const computed = EXPANSION_POOL.map((p, i) => toMember({
    ...p,
    shape: shapeWheel[i % shapeWheel.length],
    ink: computeColor(i)
  }));
  REGISTRY = [...CAST.map(toMember), ...VIRTUAL_POOL.map(toMember), ...computed];
  return REGISTRY;
}

/* 按 uid 或显示 ID（RPA-01）查询注册成员——分享链接两种写法都可达 */
export function getMember(uid) {
  const key = String(uid || '');
  return getRegistry().find(m => m.uid === key || staffIdFor(m.uid) === key.toUpperCase()) || null;
}

/* 真实角色键集（CAST 六名，供槽位制分辨「可活卡」成员） */
const CAST_KEYS = new Set(CAST.map(m => m.key));

/* 生成全新成员对象并归一化字段名（CAST 用 key/color，档案/计算员工用 uid/ink）：
   避免 dedupe 就地改写污染原始数据 */
function toMember(src) {
  const uid = src.uid || src.key;
  return { ...src, uid, ink: src.ink || src.color, virtual: !!src.virtual, id: staffIdFor(uid) };
}

/* 同一名单内的形状去重：真实角色保持登记形状（与甘特 --c-* 信号跨区一致）；
   档案/计算成员撞车时从余量形状换牌（名单 ≤7 < 9，必然有空位）。
   墨色全局已组合唯一，名单内天然不重复，无需处理。 */
function dedupe(members) {
  const usedS = new Set();
  const virtuals = [];
  members.forEach((m) => {
    if (CAST_KEYS.has(m.uid)) { usedS.add(m.shape); return; }
    virtuals.push(m);
  });
  virtuals.forEach((m) => {
    if (usedS.has(m.shape)) m.shape = SHAPES.find(s => !usedS.has(s)) || m.shape;
    usedS.add(m.shape);
  });
  return members;
}

/* 装配一套名单：主 AI 领头 + 从注册表随机抽样的 3-6 名成员。
   opts.virtual = false 时仅抽真实六角色（第二屏槽位制）。 */
export function buildRoster(tplId, opts = {}) {
  const allowVirtual = opts.virtual !== false;
  const tpl = STAFF_TEMPLATES.find(t => t.id === tplId) || STAFF_TEMPLATES[0];
  const size = 3 + Math.floor(Math.random() * 4);                       // 员工 3-6 名
  const pool = getRegistry().filter(m => !m.main && (allowVirtual || CAST_KEYS.has(m.uid)));
  const staff = shuffle(pool).slice(0, Math.min(size, pool.length));
  const members = dedupe([{ ...MAIN, id: STAFF_ID.main }, ...staff]);
  return { tpl, members };
}

/* 八维雷达的 4 项实时轴：全部由 World 真实数据派生（与 4 项技能轴合成八角） */
export function liveAxesFor(uid, employees, counters, done12h) {
  const emp = (employees && employees[uid]) || {};
  const status = emp.status || 'idle';
  return [
    { name: '进度', value: Math.round(emp.pct || 0) },
    { name: '入库', value: Math.min(100, (done12h || 0) * 20) },
    { name: '在线', value: status === 'run' ? 95 : status === 'busy' ? 88 : status === 'idle' ? 62 : 40 },
    { name: '准时', value: Math.round(counters?.ontime ?? 0) }
  ];
}

/* 技能 → 真实软件工具（softwareIcons.js 的 sw-* 符号 key）。
   命中则用对应品牌图标，未命中回退 'tool'（通用齿轮）。
   仅用于员工展示卡技能行的图标，不改变头像/雷达的 --agc 配色纪律。 */
export const SKILL_TOOL = {
  // 规划 / 协调
  '统筹调度': 'notion', '依赖编排': 'github', '风险预判': 'grafana', '报价测算': 'trello',
  '需求拆解': 'linear', '缺口管理': 'notion',
  // 内容 / 文案
  '文案写作': 'notion', '口径管理': 'notion', '灰度校对': 'browserstack', '排版张力': 'figma',
  // 数据
  '漏斗诊断': 'amplitude', '埋点治理': 'segment', '归因分析': 'amplitude', '周报沉淀': 'notion',
  // 设计
  '视觉系统': 'figma', '无障碍校验': 'browserstack', '版式张力': 'figma', '规范沉淀': 'figma',
  // 工程
  '前端工程': 'vscode', '接口联调': 'postman', '自动重试': 'node', '压测护航': 'grafana',
  // 质量
  '验收核查': 'jira', '缺陷定位': 'sentry', '回归验证': 'playwright', '标准沉淀': 'notion',
  // 本地化 / 合规 / 客户
  '术语对齐': 'weblate', '语序本地化': 'deepl', '截断排查': 'browserstack', '口径统一': 'notion',
  '漏洞巡检': 'snyk', '合规审计': 'vault', '权限巡检': 'okta', '出域复核': 'vault',
  '客户回访': 'hubspot', '反馈沉淀': 'notion', '满意度分析': 'hubspot', '续约预警': 'hubspot',
  // 自动化 / 运维 / 标注
  '流程编排': 'n8n', '脚本生成': 'vscode', '异常回归': 'playwright', '效率核算': 'trello',
  '监控值守': 'grafana', '故障定位': 'sentry', '备份演练': 'aws', '容量评估': 'kubernetes',
  '抽检仲裁': 'tool', '批量回流': 'python', '边界判定': 'tool',
  // 主 AI 元能力
  '质量决断': 'linear', '归档治理': 'notion'
};

/* 运行状态排序：run → busy → idle → wait → 无实时档案（垫底）。
   同级叠加随机抖动 —— 每次调用顺序不固定（「数字员工的位置不要固定」），
   「在运行的 AI 员工靠前」。members 需带 uid；employees 为 World.state.employees。 */
const RUNTIME_ORDER = { run: 0, busy: 1, idle: 2, wait: 3 };
export function orderByRuntime(members, employees) {
  return members
    .map(m => {
      const live = employees && employees[m.uid];
      const s = live ? (live.status || 'idle') : 'archive';
      return { m, p: (RUNTIME_ORDER[s] ?? 4) + Math.random() * 0.5 };
    })
    .sort((a, b) => a.p - b.p)
    .map(x => x.m);
}
