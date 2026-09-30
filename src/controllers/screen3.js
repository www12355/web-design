// ============================================================
// screen3.html 独立入口：第 3 屏 · 经营中枢（表情球 + 监管终端 + 思考链）
// 由 window2 三屏拆分而来（P3-1）。本页 data-world-prio=2，与旧卷轴同级可参与 leader。
// ============================================================
import { initStaticTimes } from './window2/static-times.js';
import { initNav } from '../modules/nav.js';
import { initThink } from './window2/sections/think.js';
import { initHub } from './window2/sections/hub.js';
import { initDocgen } from './window2/sections/docgen.js';
import { subscribeWorld, updatePanels, renderEventLog, updateKbStats } from './window2/handlers.js';

initStaticTimes();
initThink();
initHub();
initDocgen();
subscribeWorld([updatePanels, renderEventLog, updateKbStats]);
updatePanels(); renderEventLog(); updateKbStats();
initNav('screen3');
