/* ============================================================
 * 世界引擎 · 订单需求模板 / 场景 / 初始状态
 * 纯数据模块：所有经营参数与硬编码业务数据在此收敛
 * 时间一律用 minutesAgo（分钟前）表达，由 time 模块转成真实时钟
 * ============================================================ */

export const CLIENTS = ['白屿文旅', '极光出行', '山川出版社', 'QUARK SaaS', '慢闪咖啡', '蓝湾地产', '星野影视', '千屿电商', '北纬科技', '岚山酒店', '纸鸢教育', '沄舟医疗', 'MOMO 设计', '橙禾农业'];

export const DEMAND_POOL = [
  { demand: '品牌官网改版', tasks: [['视觉设计', '首页视觉稿重构'], ['工程开发', '官网前端工程'], ['内容撰写', '官网文案重写']] },
  { demand: '秋季新品发布全案', tasks: [['内容撰写', '发布会主文案'], ['视觉设计', '主视觉设计'], ['工程开发', '落地页工程'], ['数据分析', '传播数据回收']] },
  { demand: '用户增长数据分析', tasks: [['数据分析', '增长漏斗诊断'], ['规划协调', '增长实验排期']] },
  { demand: '小程序原型设计', tasks: [['视觉设计', '小程序界面稿'], ['工程开发', '原型工程搭建']] },
  { demand: '品牌视觉规范升级', tasks: [['视觉设计', '规范修订'], ['内容撰写', '规范文案校对']] },
  { demand: '季度营销复盘报告', tasks: [['数据分析', '数据回收清洗'], ['内容撰写', '复盘报告撰写']] },
  { demand: '电商详情页优化', tasks: [['视觉设计', '详情页改版'], ['内容撰写', '卖点文案'], ['工程开发', 'A/B 实验部署']] },
  { demand: '产品发布会 keynote', tasks: [['内容撰写', 'keynote 大纲'], ['视觉设计', '幻灯片设计']] }
];

export const ROLE_BY_NAME = { '规划协调': 'planner', '内容撰写': 'writer', '数据分析': 'analyst', '视觉设计': 'designer', '工程开发': 'engineer' };

export const BLOCK_REASONS = ['依赖方接口时序响应超时', '上游数据集未按窗口回传', '素材库版本冲突待合并', '审校规则命中灰度冲突', '构建产物哈希校验失败'];

export const DEMAND_FLASH = [
  { demand: '大促秒杀活动页', tasks: [['视觉设计', '秒杀页主视觉'], ['工程开发', '秒杀页切图部署'], ['内容撰写', '秒杀卖点文案']] },
  { demand: '直播间切片素材包', tasks: [['视觉设计', '直播间贴片设计'], ['内容撰写', '切片口播稿']] },
  { demand: '商品详情页 A/B 实验', tasks: [['视觉设计', '详情页 B 版'], ['工程开发', '实验分流部署'], ['数据分析', '实验数据回收']] },
  { demand: '大促 EDM 序列', tasks: [['内容撰写', 'EDM 三连发文案'], ['视觉设计', 'EDM 模板设计'], ['工程开发', 'EDM 触发部署']] },
  { demand: '购物车挽回弹窗', tasks: [['视觉设计', '弹窗视觉稿'], ['工程开发', '弹窗埋点接入']] },
  { demand: '旗舰店首页大促装修', tasks: [['视觉设计', '大促头图设计'], ['工程开发', '装修位前端搭建'], ['数据分析', '装修位点击监测']] },
  { demand: '售卖数据作战日报', tasks: [['数据分析', '成交数据清洗'], ['内容撰写', '日报要点提炼']] }
];

export const DEMAND_BRAND = [
  { demand: '品牌焕新全案', tasks: [['规划协调', '品牌诊断与策略'], ['数据分析', '品牌资产盘点'], ['视觉设计', '新 VI 主视觉'], ['内容撰写', '品牌故事与口径'], ['视觉设计', 'VI 应用规范'], ['工程开发', '品牌官网焕新']] },
  { demand: '年度视觉规范委托', tasks: [['规划协调', '范围与里程碑'], ['视觉设计', '规范体系设计'], ['内容撰写', '规范使用条款'], ['视觉设计', '规范样机审校'], ['工程开发', '规范在线站点']] },
  { demand: '品牌发布会全案', tasks: [['规划协调', '发布会整体排期'], ['内容撰写', '发布会主题文案'], ['视觉设计', '主 KV 设计'], ['工程开发', '邀约与直播页'], ['数据分析', '传播效果复盘'], ['内容撰写', 'keynote 终稿统稿']] },
  { demand: '企业 VI 升级工程', tasks: [['视觉设计', '标识系统升级'], ['内容撰写', 'VI 手册文案'], ['视觉设计', '办公环境应用'], ['工程开发', 'VI 资产库搭建']] },
  { demand: '品牌片视觉与脚本', tasks: [['内容撰写', '品牌片脚本'], ['视觉设计', '分镜视觉稿'], ['数据分析', '受众偏好洞察']] }
];

export const DEMAND_SPRINT = [
  { demand: '预览环境全链路压测', tasks: [['工程开发', '压测脚本编排'], ['数据分析', '压测数据分析'], ['工程开发', '瓶颈定位修复']] },
  { demand: '支付链路回归治理', tasks: [['工程开发', '回归用例补全'], ['工程开发', '失败用例修复'], ['数据分析', '回归通过率报告']] },
  { demand: '数据管道实时化改造', tasks: [['工程开发', '管道架构改造'], ['数据分析', '口径一致性校验'], ['规划协调', '灰度切换排期']] },
  { demand: '埋点体系补全', tasks: [['数据分析', '埋点缺口盘点'], ['工程开发', '埋点接入与验证']] },
  { demand: '接口性能专项治理', tasks: [['工程开发', '慢接口治理'], ['数据分析', '性能基线对比'], ['工程开发', '缓存策略上线']] },
  { demand: '监控告警体系接入', tasks: [['工程开发', '告警规则接入'], ['内容撰写', '值班手册撰写']] }
];

export const CLIENTS_FLASH = ['千屿电商', '慢闪咖啡', 'MOMO 设计', '橙禾农业', '极光出行', '拾味食品', '潮汐运动'];
export const CLIENTS_BRAND = ['白屿文旅', '山川出版社', '蓝湾地产', '星野影视', '岚山酒店', '沄舟医疗', '纸鸢教育'];
export const CLIENTS_SPRINT = ['北纬科技', 'QUARK SaaS', '极光出行', '千屿电商', '沄舟医疗', '北岸云'];

export const TEMPLATES = {
  daily: {
    id: 'daily', name: '日常经营', tag: '基准',
    desc: '混合需求持续接单，节奏平稳，经典经营面。',
    meta: ['均衡节奏', '中低复杂度', '低风险'],
    cadence: [75000, 140000], amount: [18, 98], taskCount: [2, 3],
    backlogLimit: 16, blockRate: 0.045, reworkRate: 0.0, deposit: 0,
    demands: DEMAND_POOL, clients: CLIENTS
  },
  flash: {
    id: 'flash', name: '电商大促', tag: '高频',
    desc: '大促脉冲：订单高频短链路涌入，并行度与阻塞同步升高。',
    meta: ['高频短链路', '低复杂度', '阻塞偏高'],
    cadence: [22000, 48000], amount: [6, 30], taskCount: [2, 3],
    backlogLimit: 28, blockRate: 0.075, reworkRate: 0.015, deposit: 0,
    demands: DEMAND_FLASH, clients: CLIENTS_FLASH
  },
  brand: {
    id: 'brand', name: '品牌全案', tag: '长链路',
    desc: '低频长链路：需求受理后分阶段验收，交付与归档逐项确认。',
    meta: ['低频长链路', '高复杂度', '两阶段验收'],
    cadence: [150000, 300000], amount: [150, 600], taskCount: [4, 6],
    backlogLimit: 10, blockRate: 0.05, reworkRate: 0.03, deposit: 0.3,
    demands: DEMAND_BRAND, clients: CLIENTS_BRAND
  },
  sprint: {
    id: 'sprint', name: '技术冲刺', tag: '高压',
    desc: '工程与数据任务加权，压测故障频发，返工率升高。',
    meta: ['工程加权', '中高复杂度', '高返工'],
    cadence: [45000, 95000], amount: [20, 120], taskCount: [2, 4],
    backlogLimit: 20, blockRate: 0.065, reworkRate: 0.05, deposit: 0,
    demands: DEMAND_SPRINT, clients: CLIENTS_SPRINT
  }
};

/* ---------------- 初始账本 / 规模基准 ---------------- */
export const INIT = {
  EARN0: { planner: 8600, writer: 6400, analyst: 7800, designer: 2100, engineer: 7100 },
  /* [key, status, task, pct, taskId] */
  CAST0: [
    ['planner', 'run', '依赖路径重排', 82, 't01'],
    ['writer', 'run', '发布会主文案终校', 64, 't02'],
    ['analyst', 'busy', '漏斗异常定位补录', 91, 't03'],
    ['designer', 'idle', '视觉规范对比度修订', 38, 't04'],
    ['engineer', 'run', '落地页联调 · 时序确认', 57, 't05']
  ],
  /* 员工日志（t 用 minutesAgo 表达） */
  EMP_LOG: {
    planner: [
      { ago: 3, s: 'run', txt: '在岗：依赖路径重排' },
      { ago: 246, s: 'run', txt: '晨会目标同步，进入工位' }
    ],
    writer: [
      { ago: 3, s: 'run', txt: '在岗：发布会主文案终校' },
      { ago: 246, s: 'run', txt: '晨会目标同步，进入工位' }
    ],
    analyst: [
      { ago: 3, s: 'busy', txt: '在岗：漏斗异常定位补录' },
      { ago: 246, s: 'run', txt: '晨会目标同步，进入工位' }
    ],
    designer: [
      { ago: 3, s: 'idle', txt: '在岗：视觉规范对比度修订' },
      { ago: 246, s: 'run', txt: '晨会目标同步，进入工位' }
    ],
    engineer: [
      { ago: 3, s: 'run', txt: '在岗：落地页联调 · 时序确认' },
      { ago: 246, s: 'run', txt: '晨会目标同步，进入工位' }
    ]
  },
  /* 主角单：白屿文旅 · 秋季发布会全案 */
  HERO: { pct: 42, value: 12000, regen: 7 },
  /* 其余在产订单（ago 分钟前下单） */
  ORDERS: [
    { id: 'o1', client: '白屿文旅', demand: '秋季发布会全案', amount: 186000, status: 'producing', ago: 246 },
    { id: 'o2', client: 'QUARK SaaS', demand: '季度数据洞察', amount: 48000, status: 'producing', ago: 278 },
    { id: 'o3', client: '千屿电商', demand: '详情页转化优化', amount: 36000, status: 'producing', ago: 253 },
    { id: 'o4', client: '星野影视', demand: '发布会 keynote', amount: 42000, status: 'producing', ago: 228 },
    { id: 'o5', client: '北纬科技', demand: '小程序原型设计', amount: 39000, status: 'producing', ago: 318 },
    { id: 'o6', client: '岚山酒店', demand: '品牌官网改版', amount: 66000, status: 'producing', ago: 103 }
  ],
  /* 正在执行的任务 [id, title, owner, pct, orderId] */
  DOING: [
    ['t01', '依赖路径重排', 'planner', 82, 'o1'],
    ['t02', '发布会主文案终校', 'writer', 64, 'o1'],
    ['t03', '漏斗异常定位补录', 'analyst', 91, 'o1'],
    ['t04', '视觉规范对比度修订', 'designer', 38, 'o1'],
    ['t05', '落地页联调 · 时序确认', 'engineer', 57, 'o1'],
    ['t06', '传播排期校准', 'planner', 45, 'o1'],
    ['t07', '转化数据周报 · 第 37 期', 'analyst', 76, 'o2'],
    ['t08', '预览环境压测', 'engineer', 68, 'o3'],
    ['t09', '对外口径 FAQ 补录 12 条', 'writer', 97, 'o4']
  ],
  /* 排队任务 [id, title, orderId] */
  QUEUED: [
    ['q1', '整合稿素材合并 v0.7', 'o1'], ['q2', '发布包打包与校验', 'o1'],
    ['q3', '视觉规范无障碍复核', 'o1'], ['q4', 'keynote 幻灯片排版', 'o4'],
    ['q5', '详情页 A/B 实验部署', 'o3'], ['q6', '季度报告结论校对', 'o2'],
    ['q7', '排期风险复审', 'o1'], ['q8', '官网 404 路由修复', 'o6']
  ],
  DONE_COUNT: 31,
  /* 今日营收曲线采样终点 */
  SPARK_END: 32000,
  /* 事件流 [minutesAgo, text, kind] */
  EVENTS: [
    { ago: 0, text: '视觉规范 v3.0 收到修订请求', kind: 'risk' },
    { ago: 17, text: '数据报告 v1.8 写入知识库', kind: 'done' },
    { ago: 36, text: '交付归档：慢闪咖啡 · 已写入知识库', kind: 'settle' },
    { ago: 92, text: '重排 3 个阻塞任务的依赖', kind: 'info' },
    { ago: 246, text: '晨会目标同步至全员', kind: 'info' }
  ],
  LEDGER: { total: 1286000, today: 32000, cost: 201000, costToday: 8420, settled: 23, clients: 14 },
  KB: { total: 1284, today: 37, settledToday: 5 },
  COUNTERS: { total: 48, done: 31, todayOrders: 13, ontime: 96.4, runtime: 0 }
};
