// ============================================================
// screen2.html 独立入口：第 2 屏 · 数字员工（工牌 + 群聊）
// 由 window2 三屏拆分而来（P3-1）：只挂载本屏 section，
// 世界事件经 handlers 分片订阅（缺 DOM 的处理器自动空转）。
// ============================================================
import { initStaticTimes } from './window2/static-times.js';
import { initChat } from './window2/sections/chat.js';
import { initBadges, updateBadges } from './window2/sections/badges.js';
import { initDocgen } from './window2/sections/docgen.js';
import { subscribeWorld, updatePanels, renderEventLog, updateKbStats } from './window2/handlers.js';

initStaticTimes();
initChat();
initBadges();
initDocgen();
subscribeWorld([updateBadges, updatePanels, renderEventLog, updateKbStats]);
updateBadges(); updatePanels(); updateKbStats();
