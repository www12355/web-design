// ============================================================
// screen4.html 独立入口：第 4 屏 · 知识库（戴森球 + 星表目录）
// 由 window2 三屏拆分而来（P3-1）。只读渲染为主，data-world-prio=4。
// ============================================================
import { initStaticTimes } from './window2/static-times.js';
import { initNav } from '../modules/nav.js';
import { initKnowledge, syncHeroDocVer } from './window2/sections/knowledge.js';
import { initDocgen } from './window2/sections/docgen.js';
import { subscribeWorld, updatePanels, renderEventLog, updateKbStats } from './window2/handlers.js';

initStaticTimes();
initKnowledge();
initDocgen();
subscribeWorld([updatePanels, renderEventLog, updateKbStats, syncHeroDocVer]);
updatePanels(); renderEventLog(); updateKbStats(); syncHeroDocVer();
initNav('screen4');
