// ============================================================
// window2.html 控制器：横向卷轴（第 2/3/4 屏）· 组合入口
// 三屏逻辑已按 section 拆分（P3-1）：
//   sections/chat.js       第 2 屏 群聊
//   sections/badges.js     第 2 屏 数字员工工牌
//   sections/think.js      第 3 屏 思考链
//   sections/hub.js        第 3 屏 中枢（表情球 / 监管终端 / 面板）
//   sections/knowledge.js  第 4 屏 知识（戴森球 / 星表）
//   sections/docgen.js     交付文档生成与审阅（跨屏共享）
//   handlers.js            世界事件处理映射（经 bus 跨 section 调度）
// 本文件只做：挂载全部 section + 订阅世界事件 + 卷轴初始化。
// 纯 ES 模块：AIC / World 由 import 引入，Bloub / EmotionBall / gsap 为经典全局。
// ============================================================
import { initStaticTimes } from './window2/static-times.js';
import { initReel } from './window2/reel.js';
import { gsapOK, later } from './window2/shared.js';
import { initChat } from './window2/sections/chat.js';
import { initBadges, updateBadges } from './window2/sections/badges.js';
import { initThink } from './window2/sections/think.js';
import { initHub } from './window2/sections/hub.js';
import { initKnowledge, syncHeroDocVer } from './window2/sections/knowledge.js';
import { initDocgen } from './window2/sections/docgen.js';
import { subscribeWorld, updatePanels, renderEventLog, updateKbStats } from './window2/handlers.js';

/* ================= 真实时间：静态时间标签归一化（P2-5） ================= */
initStaticTimes();

/* ================= 按屏挂载（缺容器的 section 自动跳过） ================= */
initChat();
initBadges();
initThink();
initHub();
initKnowledge();
initDocgen();

/* ================= 世界引擎订阅：一切数字与消息的源头 ================= */
subscribeWorld([updateBadges, updatePanels, renderEventLog, updateKbStats, syncHeroDocVer]);

/* ================= 卷轴：拖拽 + 吸附 + 键盘 + 入场动效（P2-5） ================= */
const reelNav = initReel({
  gsapOK,
  isBlockedTarget: (t) => t && t.id === 'cat-search',
  later
});

/* ================= 启动 ================= */
updateBadges(); updatePanels(); renderEventLog(); updateKbStats(); syncHeroDocVer();
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
requestAnimationFrame(() => reelNav.go(1, false));
window.addEventListener('load', () => reelNav.go(1, false));
window.addEventListener('resize', () => reelNav.go(reelNav.getIdx(), false));
