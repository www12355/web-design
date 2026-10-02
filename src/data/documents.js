/* ============================================================
 * 知识图谱 · 数字员工 / 文档 / 知识点（PL.04 Knowledge Graph）
 * 纯数据模块：文档入库时间用 minutesAgo 表达，由 time 模块转真实时钟
 * ============================================================ */

/* color / ball.ink 与 tokens.css 的 --c-* 角色色一致（同 cast.js）；
   ball.paper 全站统一中性石墨 #2C2C2E。 */
export const AGENTS = [
  { key: 'main',     name: '主 AI', color: '#F5F5F7', rel: '统筹', ball: { shape: 'cercle',   ink: '#F5F5F7', paper: '#2C2C2E' }, expr: 'attentif' },
  { key: 'planner',  name: '规划',  color: '#0A84FF', rel: '规划', ball: { shape: 'hexagone', ink: '#0A84FF', paper: '#2C2C2E' }, expr: 'neutre'   },
  { key: 'writer',   name: '内容',  color: '#5AC8FA', rel: '撰写', ball: { shape: 'nuage',    ink: '#5AC8FA', paper: '#2C2C2E' }, expr: 'heureux'  },
  { key: 'analyst',  name: '数据',  color: '#FFD60A', rel: '分析', ball: { shape: 'galet',    ink: '#FFD60A', paper: '#2C2C2E' }, expr: 'attentif' },
  { key: 'designer', name: '设计',  color: '#BF5AF2', rel: '设计', ball: { shape: 'goutte',   ink: '#BF5AF2', paper: '#2C2C2E' }, expr: 'curieux'  },
  { key: 'engineer', name: '工程',  color: '#5E5CE6', rel: '开发', ball: { shape: 'capsule',  ink: '#5E5CE6', paper: '#2C2C2E' }, expr: 'neutre'   },
  { key: 'qc',       name: '质检',  color: '#30D158', rel: '审查', ball: { shape: 'carre',    ink: '#30D158', paper: '#2C2C2E' }, expr: 'attentif' }
];

/* DOCS：time 字段为「入库分钟前」，由 nebula 按真实时钟换算展示 */
export const DOCS = [
  { id: 'doc-integrate', agent: 'main',     title: '发布方案整合稿 v0.7',    type: 'PPTX', ft: 'ft-ppt',  minutesAgo: 3 },
  { id: 'doc-plan7',     agent: 'main',     title: '执行序列 · 7 子任务拆解', type: 'PDF',  ft: 'ft-pdf',  minutesAgo: 2 },
  { id: 'doc-prd',       agent: 'planner',  title: '产品需求规格书 v2.3',    type: 'DOCX', ft: 'ft-word', minutesAgo: 35 },
  { id: 'doc-schedule',  agent: 'planner',  title: '传播矩阵排期表 v1.2',    type: 'XLSX', ft: 'ft-xls',  minutesAgo: 60 },
  { id: 'doc-copy',      agent: 'writer',   title: '发布会主文案 v4',        type: 'DOCX', ft: 'ft-word', minutesAgo: 12 },
  { id: 'doc-faq',       agent: 'writer',   title: '对外口径 FAQ 32 条',     type: 'DOCX', ft: 'ft-word', minutesAgo: 40 },
  { id: 'doc-report',    agent: 'analyst',  title: '市场数据分析报告 v1.8',  type: 'PDF',  ft: 'ft-pdf',  minutesAgo: 6 },
  { id: 'doc-brand',     agent: 'designer', title: '品牌视觉规范 v3.0',      type: 'FIG',  ft: 'ft-fig',  minutesAgo: 1 },
  { id: 'doc-landing',   agent: 'engineer', title: '落地页前端工程 v0.9-rc', type: 'REPO', ft: 'ft-code', minutesAgo: 20 },
  { id: 'doc-api',       agent: 'engineer', title: '联调接口时序说明 v1.0',  type: 'PDF',  ft: 'ft-pdf',  minutesAgo: 8 }
];

export const TOPICS = {
  'doc-integrate': ['叙事主线', '数据引用', '页面节奏', '讲稿分页', '彩排反馈', '风险预案', '附件索引'],
  'doc-plan7':     ['依赖拆解', '里程碑', '并行策略', '资源平衡', '回滚点', '交付窗口', '状态同步'],
  'doc-prd':       ['用户故事', '功能范围', '验收标准', '边界条件', '术语表', '变更记录'],
  'doc-schedule':  ['传播矩阵', '渠道排期', '素材就绪', '审核流', '缓冲策略'],
  'doc-copy':      ['主标题方案', '正文段落', '口号变体', '灰度自查', '终校清单'],
  'doc-faq':       ['高频问题', '口径统一', '敏感应对', '更新日志'],
  'doc-report':    ['漏斗异常', '埋点补录', '渠道对比', '移动端回落', '结论摘要'],
  'doc-brand':     ['色板对比度', '字体层级', '版式栅格', '组件样式', '附页索引'],
  'doc-landing':   ['路由结构', '静态资源', '表单校验', '预览部署'],
  'doc-api':       ['时序图', '字段字典', '错误码', '联调用例']
};
