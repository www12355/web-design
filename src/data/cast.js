/* ============================================================
 * 角色数据源（四屏唯一，避免分叉）
 * 纯数据模块：角色清单 / 状态文案 / 头像映射
 * ============================================================ */

export const CAST = [
  {
    key: 'planner', name: '规划协调', role: 'PLANNER', shape: 'hexagone', color: '#0A84FF', expr: 'neutre', bar: 'blue',
    think0: '先比对三组交付物的前后依赖，再测算并行执行的收益；把文案终校并入工程联调时段，可整体追回 0.5 天，风险集中在视觉回传节点。',
    skills: [['需求拆解', 94], ['依赖编排', 91], ['风险预判', 86], ['报价测算', 88]]
  },
  {
    key: 'writer', name: '内容撰写', role: 'WRITER', shape: 'nuage', color: '#5AC8FA', expr: 'heureux', bar: 'teal',
    think0: '对比度不足的段落集中在正文与浅底的组合；按无障碍标准提级后要回看排版张力，先改主段落，再做一次全篇灰度检查。',
    skills: [['文案写作', 93], ['口径管理', 90], ['灰度校对', 87], ['排版张力', 84]]
  },
  {
    key: 'analyst', name: '数据分析', role: 'ANALYST', shape: 'galet', color: '#FFD60A', expr: 'attentif', bar: 'orange',
    think0: '三处异常中两处为埋点缺失，一处为真回落；回落集中在移动端下午时段，先补埋点，再验证是否与版本发布时间相关。',
    skills: [['漏斗诊断', 95], ['埋点治理', 89], ['归因分析', 88], ['周报沉淀', 85]]
  },
  {
    key: 'designer', name: '视觉设计', role: 'DESIGNER', shape: 'goutte', color: '#BF5AF2', expr: 'curieux', bar: 'rose',
    think0: '主色保持石墨灰与系统蓝不变，仅提级正文与暗底的对比关系；提级后同步更新规范附页与前端变量表，避免回传时遗漏。',
    skills: [['视觉系统', 92], ['无障碍校验', 90], ['版式张力', 88], ['规范沉淀', 86]]
  },
  {
    key: 'engineer', name: '工程开发', role: 'ENGINEER', shape: 'capsule', color: '#5E5CE6', expr: 'neutre', bar: 'violet',
    think0: '预览环境已部署完成，接口时序还差两处确认；先把静态资源与路由打通，等时序回复即可进入联调，整体风险可控。',
    skills: [['前端工程', 93], ['接口联调', 90], ['自动重试', 92], ['压测护航', 85]]
  },
  {
    key: 'qc', name: '质量审查', role: 'QUALITY', shape: 'carre', color: '#30D158', expr: 'attentif', bar: 'emerald',
    think0: '对照验收口径逐节核查，阻断项先回退修订、建议项并行消化，确保带病产物不归档。',
    skills: [['验收核查', 95], ['缺陷定位', 90], ['回归验证', 88], ['标准沉淀', 84]]
  }
];

export const STATUS_TXT = { run: '运行中', busy: '专注中', idle: '待命', wait: '等待' };

/* ink 取值必须与 tokens.css 的 --c-* 角色色一致：
   小球、甘特条带、星图图例本就靠这套色指代同一批角色，
   四色漂移会让「同一个人」在不同区块显示成不同颜色。
   paper 同样全站唯一：中性石墨 --bg-elevated（#2C2C2E），
   各页不得再自备蓝味球底（#0d1524 / #263046 已废弃）。 */
export const AVATAR_MAP = {
  main:     { shape: 'cercle',   ink: '#ffffff', paper: '#2C2C2E' },
  planner:  { shape: 'hexagone', ink: '#0A84FF', paper: '#2C2C2E' },
  writer:   { shape: 'nuage',    ink: '#5AC8FA', paper: '#2C2C2E' },
  analyst:  { shape: 'galet',    ink: '#FFD60A', paper: '#2C2C2E' },
  designer: { shape: 'goutte',   ink: '#BF5AF2', paper: '#2C2C2E' },
  engineer: { shape: 'capsule',  ink: '#5E5CE6', paper: '#2C2C2E' },
  qc:       { shape: 'carre',    ink: '#30D158', paper: '#2C2C2E' }
};
