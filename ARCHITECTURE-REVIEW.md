# 架构评审报告 · AI 自主经营中枢（ai-autonomous-ops v2.1.0）

> 评审对象：`d:/Users/15372/Desktop/h5/网页设计3`
> 评审性质：静态架构走查（不运行、不改动源码）。方法镜头取自 impeccable `critique` / `audit` 维度：复杂度、可维护性、性能与资源生命周期、耦合/重复、可访问性、工程化。
> 证据来源：对仓库的全量静态侦察，所有结论均附 `文件:行号`。
> 本轮交付：仅本报告，不动任何 `.html / .js / .css / 配置`。

---

## 0. 项目形态速写

| 项 | 现状 |
|---|---|
| 页面 | `index.html`（启动器）、`screen1.html`（浅色运营驾驶舱）、`window2.html`（深色横向卷轴 2/3/4 屏） |
| 脚本形态 | **经典脚本挂全局**（bloub / emotionball / gsap via CDN）+ **ES 模块**（controllers/*、modules/* 中部分文件），混用 |
| 构建/依赖 | 无构建、无 `dependencies`/`devDependencies`、`package.json` 仅 12 行 |
| 工程化 | 无 lint / 类型检查 / 测试 / `.gitignore` / `README` |
| 数据层 | `src/data/*` 静态常量；运行时可变状态集中在 `src/modules/world.js` 的 `World.state` |
| 跨窗口 | `localStorage` + `storage` 事件 + 轮询兜底（无 `BroadcastChannel` / `postMessage`） |

设计意图本身是清晰且有趣的（世界引擎单一真相源 + 双窗口只读派生），但**落地层面存在大量重复实现、资源泄漏与死代码**，把"单一数据源"的好架构拖入了维护泥潭。

---

## 1. 严重度模型

- **P0 高风险**：资源泄漏或可见稳定性/正确性风险（rAF / 定时器未清理、Map 只增、监听器重复注册）。
- **P1 高**：重复实现 / 隐式耦合 / 死代码，直接抬升理解成本与"改坏"概率。
- **P2 中**：可维护性坏味道（内联事件、硬编码绕过 token、巨型单文件、零引用导出）。
- **P3 低**：超长行、不可达分支、工程化缺失。

---

## 2. 评审清单

### P0 — 资源生命周期 / 泄漏（高风险）

#### P0-1 bloub 表情球的 rAF 返回值被全部丢弃 → 常驻动画
- **证据**：`src/modules/bloub.js:1641`（mount 内部无限 rAF，需调用方保留 `stop()` 取消）；调用方 `src/controllers/index.js:8,11`、`src/controllers/window2.js:168,216` **均丢弃返回值**。
- **影响**：`window2` 同时挂载 5 张工牌 + 1 个群聊头 = **6 个永不停止的 rAF**。即便用 `innerHTML` 覆盖 DOM（如 `window2.js:225` 用 `Bloub.static(...)` 替换 `.avatar-slot`），底层 rAF 仍持有对旧节点的引用并继续跑，造成 CPU 空转与潜在内存泄漏。
- **建议（仅描述）**：让 `mount()` 返回句柄（已具备 `stop()`），在工牌重建 / 翻面 / 卸载路径显式调用；或改为 `IntersectionObserver` 暂停（可借鉴 `engine.js` 的 `ticker` + `visible` 门控思路）。

#### P0-2 世界引擎心跳 / 轮询定时器永不清理
- **证据**：`src/modules/world.js:534-535` 注册 `beatTimer`(2s) 与 `pollTimer`(1.5s)；`stopEngine`(`world.js:528-532`) 只清另 5 个定时器，漏掉这两个。
- **影响**：`stopEngine` 名不副实；若未来有 leader 让位 / 页面卸载调用 `stopEngine`，仍残留两个常驻定时器；当前虽仅 `boot` 调用一次，属结构性隐患。
- **建议（仅描述）**：在 `stopEngine` 中 `clearInterval(beatTimer)` / `clearInterval(pollTimer)`；leader 选举与引擎循环统一用一组句柄登记 + 统一销毁。

#### P0-3 多处 `setInterval` 永不清理
- **证据**：
  - `src/modules/time.js:78,110`（`tick` / `mountTimeTicker` 的 `setInterval`）
  - `src/controllers/screen1.js:339`（`setInterval(moveToday, 30000)`）、`screen1.js:621`（`renderSync, 3000`）
  - `src/controllers/window2.js:1155`(运行时长 15s)、`1165`(负载 3s)
  - `src/modules/nebula.js:98`（`setInterval(..., 5200/9000)`）
- **影响**：演示站虽是单页长驻，但定时器散落、无集中登记，难以在保证不重复注册的前提下安全重启；多窗口各跑一份，叠加负载。
- **建议（仅描述）**：抽出统一的 `intervalRegistry`（登记 + 全部 `clear`），或将"实时玩具"类定时器收敛进 `World` 的 ticker，由引擎统一驱动。

#### P0-4 `docRefs` Map 只增不减
- **证据**：`src/controllers/window2.js:27` `docRefs`（`docNo → context`）只有 `set`，无 `delete` / 上限。
- **影响**：长时间运行（演示挂机）后 Map 单调增长，且 key 为业务文档号，理论上无界。
- **建议（仅描述）**：在文档审阅关闭 / 归档后 `delete` 对应 key；或改 `WeakMap` + 弱引用，或加 LRU 上限。

#### P0-5 全局监听器永不解绑 + 可重复注册
- **证据**：`src/modules/world.js:541-560` 注册 `storage` / `visibilitychange` / `focus` / `pageshow` / `pagehide` 监听，无对应 `removeEventListener`；`startSync`(`533`) 若被再次调用会重复注册。
- **影响**：单页内可接受，但 `startSync` 缺少"幂等"保护，未来任何二次调用都会叠加事件处理；与 P0-2 同源。
- **建议（仅描述）**：`startSync` 首行加 `if (started) return;` 守护；卸载路径统一 `removeEventListener`。

---

### P1 — 重复实现 / 隐式耦合 / 死代码（高）

#### P1-1 两套表情球引擎（最大重复）
- **证据**：`src/modules/bloub.js`（1706 行，`window.Bloub`，SVG 静态/动画球）vs `src/modules/emotionball/{rings.js(13)+emotions.js(508)+ball.js(606)+engine.js(815)=1942 行}`（`window.EmotionBall`，眼环弹簧球）。两者 API 风格完全不同（`Bloub.mount` vs `EmotionBall.create`）。
- **影响**：同一"数字人球体"概念两份独立实现，约 3600 行重复维护面；造型、表情、状态逻辑各写各的，无法统一演进（例如想统一加一个表情，要改两处且易不一致）。
- **建议（仅描述）**：保留一套作为"球渲染内核"，另一套迁就或删除；若视觉差异是设计需要，至少抽出共享的 `shapes / colors / expressions` 数据层，避免两套 `SHAPES / COLORS / EXPRESSIONS` 各存一份。

#### P1-2 同页三套球体渲染并存
- **证据**：bloub SVG 球（`bloub.js`）+ emotionball 眼环球（`emotionball/*`）+ `src/modules/nebula.js:78-86` canvas 3D 点云球。
- **影响**：`window2.html` 一个页面里三种球渲染技术并存，性能与心智负担都重。
- **建议（仅描述）**：明确每处该用哪种球（工牌/中枢/星图），能复用的复用；星图若是装饰性点阵，可评估并入 nebula 或独立成纯组件。

#### P1-3 跨窗口协议"双实现"
- **证据**：协议 key 定义在 `src/modules/world.js:17-30`（`aic-world-state-v2` / `aic-world-leader-v1` / `aic-world-cmd-v1`）；`src/controllers/screen1.js:429-522` **另写一份**租约解读逻辑（`readLease / renderSync`），并复制 `LEASE_MS`（与 `world.js:23` 手工同步，注释"与 world.js 保持一致"）。
- **影响**：协议真相出现两处，改一处易漏另一处；`screen1` 直读 `localStorage` 绕过了 `World` 的封装。
- **建议（仅描述）**：把"租约读取/解析"作为 `World` 的只读派生 API（如 `World.leaderInfo()`），`screen1` 只消费，不再各自读 `localStorage`。

#### P1-4 模板切换 / 派发路由 / 事件标签 各两份
- **证据**：
  - 模板切换器：`screen1.js:427-485` vs `window2.js:1123-1150`（`wireSeg`/`speedSeg`/`syncTplUI`/`TPL`）
  - 派发语义路由：`screen1.js:560-576`（`RE_ROLE_AT`/`routeRole`/`normalizeTitle`）vs `window2.js:715-735`（`RE_TASK_VERB`/`RE_GREET`/`RE_THANKS`/`RE_WHO`/`routeRole`/`normalizeTitle`/`converse`）
  - 事件类型→标签：`screen1.js:432` `EV_KIND` vs `window2.js:850` `EV_TAG`
- **影响**：两控制器平行重复，"联动是否一致"无法保证；新增一个事件类型要改两处。
- **建议（仅描述）**：把联动 UI（模板切换、流速、派发、事件流渲染）抽出为共享模块（如 `src/modules/linkage.js` + 对应 UI 片段），两页共用。

#### P1-5 `doc-review` 样式两份且互相覆盖
- **证据**：`src/styles/pages/window2.css:977-1131`（居中弹窗版）与 `src/styles/pages/window2-review.css:1-21`（全屏工作台版），**两份都被 `window2.html:9-10` 加载**，后者覆盖前者；`window2-review.css:15` 用 `!important`。
- **影响**：同一组 `.doc-review__*` / `.dr-*` 两套数值，维护时改 A 被 B 盖掉，调试困难。
- **建议（仅描述）**：二选一（保留"全屏工作台"版更符合第 3 屏语境），删除另一份；或合并为带 `data-variant` 的单文件。

#### P1-6 同名不同实现：`data/world.js` vs `modules/world.js`
- **证据**：`src/data/world.js`（168 行，纯数据：`CLIENTS / DEMAND_POOL / TEMPLATES / INIT`）vs `src/modules/world.js`（619 行，引擎）。仅靠目录层级区分。
- **影响**：新人极易混淆；`import` 时路径写错会拿到错误对象且无任何报错。
- **建议（仅描述）**：重命名其一（如数据层 `world.data.js` 或引擎层 `worldEngine.js`），或在 `data/` 与 `modules/` 间划清"静态数据"vs"运行时引擎"的边界约定。

#### P1-7 i18n 脚本加载却无消费方（死数据）
- **证据**：`window2.html:570-574` 加载 5 个语言文件，定义 `window.AIC_I18N`；全仓无任何文件读取 `AIC_I18N`；`window.L10n` 从未定义，却被 `common.js:18,21,37`、`screen1.js:440`、`window2.js` 经 `AIC` 当可选能力做三元探测（永久走 fallback）。全站 `data-i18n` 仅 6 处（`index.html:6,14,32`、`screen1.html:23,24`、`window2.html:286`）。
- **影响**：约 9.3KB 语言包 + 5 个 `<script>` 加载成本纯浪费；且 `screen1` / `index` 用了 `data-i18n` 却**根本没加载 i18n 脚本** → 这两页的 `data-i18n` 永不生效。
- **建议（仅描述）**：要么接线上线（`window2` 独占消费、`screen1`/`index` 补加载 + 运行时 `L10n`），要么连同 5 个语言文件一起删除，去掉 `data-i18n` 占位。

#### P1-8 未加载的 `docx` 分支（不可达代码）
- **证据**：`src/modules/docgen.js:189` 探测 `window.docx`，但该库从未引入（全仓仅此一处引用）；`downloadDocx` 实际永远走 `.doc` 降级路径(`docgen.js:220-234`)。
- **建议（仅描述）**：若不需要真实 `.docx`，删掉 `window.docx` 分支；若需要，补 CDN 引入并测试闭环。

#### P1-9 备份目录死代码（约 45 文件 / ~400KB）
- **证据**：`_backup_light/`、`_backup_softeditorial/`（内含 `modules/modules/` 双层错误目录）、`.rem_backup/` 均 0 引用，且与 `src/` 中同名文件已分叉（如 `bloub.js` 大小 53.63KB vs 53.27KB）。
- **影响**：严重干扰"哪里是真相源"的判断；仓库体积与认知负担无意义膨胀。
- **建议（仅描述）**：确认无需回滚后整体删除；误删风险低（无引用）。

#### P1-10 未引用的导出 / 函数
- **证据**：
  - `Bloub` 9 个导出（`bloub.js:1692-1703`：`RAYON/DEMI_VIEWBOX/SHAPES/COLORS/EXPRESSIONS/STATES/SEQUENCE/POSES/BotEngine`）全仓 0 引用
  - `src/modules/time.js`：`nowHMS`(25)、`todayMMDD`(42)、`tick`(76) 无调用
  - `src/modules/nebula.js`：`inspectNext / improve / focus / unfocus / debug` 无外部调用
- **建议（仅描述）**：清点后删除，或保留为有意公开 API 时在文件头注明用途。

---

### P2 — 可维护性坏味道（中）

#### P2-1 内联 `onclick` 迫使模块污染 `window`
- **证据**：`index.html` 7 处内联 `onclick`(`30/39/40/41/42/48/56`)；`src/controllers/index.js:35-36` 被迫 `window.openBoth = openBoth; window.openSized = openSized;` 才能被调用。
- **影响**：破坏 ES 模块封装，全局命名空间污染；`index.js` 的"模块性"名存实亡。
- **建议（仅描述）**：在 `index.js` 内 `querySelector` 绑定事件，去掉 `onclick` 与 `window.*` 挂载。

#### P2-2 大量内联 `style`
- **证据**：`screen1.html` 31 处（如 `43/44/45/394`）、`window2.html` 22 处（如 `30/31/33/537-542`）。
- **影响**：样式散落 HTML，与 `pages/*.css` 形成"双份真值"，响应式/主题切换难以统一。
- **建议（仅描述）**：把内联尺寸/颜色抽到 CSS 类或 `var(--token)`；仅保留真正动态计算的行内值。

#### P2-3 `tokens.css` 名不副实
- **证据**：`src/styles/tokens.css` 仅 1 行 `@import url("./components.css")`；三个页面却都 `link` 它（`index.html:8`、`screen1.html:8`、`window2.html:8`）。
- **影响**：文件名暗示"只放设计 token"，实际等于直接加载整个 885 行 `components.css`；token 真正定义在 `components.css:6-141`，文件名误导。
- **建议（仅描述）**：把 `components.css` 的 `:root` token 段（6-141）拆到 `tokens.css` 并让 `components.css` 引入它，或直接让页面 `link components.css` 并删掉 `tokens.css` 这层。

#### P2-4 魔法数字 / 硬编码色值绕过 token
- **证据**：含 `rgba(`/`#hex` 的行数 `components.css` 101、`window2.css` 133、`screen1.css` 104（如 `screen1.css:105`、`window2.css:1230-1257`）；JS 中 `screen1.js:315`（`rgba(31,111,92,0.10)`）、`window2.js:69`（`RING_C = 245.04`）、`screen1.js:96`（`W=260,H=48,PAD=4`）。
- **影响**：主题切换 / 明暗对比（驾驶舱浅色 vs 卷轴深色）时，硬编码值不会随之变化，出现"补丁盖补丁"。
- **建议（仅描述）**：把颜色收口到 `tokens.css` 的 CSS 变量；几何常量提到模块顶部具名常量。

#### P2-5 巨型单文件
- **证据**：`src/controllers/window2.js` 1310 行（承担 6 个屏 3 的功能 + docgen 集成）、`src/styles/pages/window2.css` 1341 行（含 5 层主题补丁）、`bloub.js` 1706 行。
- **影响**：远超单文件可维护阈值，定位困难、合并冲突频发。
- **建议（仅描述）**：按"屏"拆分 `window2.js`（如 `s2-badges.js` / `s3-core.js` / `s4-nebula.js` + 共享 `linkage.js`）；CSS 按屏分文件。

#### P2-6 跨文件重复选择器叠 5 层
- **证据**：`window2.css` 中 `.well`(420/1070/1115/1231/1251)、`.plain-ring`(411/1074/1119/1230/1252)、`.eb-card`(77/346/1059/1113) 等同选择器多次定义，形成"暗→浅→暖→深"覆盖链。
- **影响**：改一处样式要通读 5 个定义才能确定生效值。
- **建议（仅描述）**：按主题拆文件而非同文件叠加；或改用 `data-theme` + 单一定义。

---

### P3 — 低危 / 工程化缺失

#### P3-1 超长单行
- **证据**：`src/modules/emotionball/rings.js:11` 单行约 40KB（眼环点阵数据）；`i18n/*.js` 每文件 10 行超长行；`window2-review.css:15-18` 每行数 KB。
- **影响**：编辑器卡顿、diff 不可用、可读性差。
- **建议（仅描述）**：数据转 JSON / 多行数组；CSS 多行展开。

#### P3-2 零工程化
- **证据**：无 `.gitignore`（`search_file` 0 命中）、无 `README`、无 `eslint`/`prettier`、`package.json` 无 devDeps；`serve.err` 是 `EADDRINUSE :::4173` 崩溃日志残留。
- **建议（仅描述）**：补 `.gitignore`（忽略 `.codebuddy/`、`.zcode/`、`_backup_*`、`.rem_backup/`、`serve.err`、`.shot_*`）、补 `README`（启动方式 / 架构说明 / 双窗口机制）、引入 ESLint（仅 `scripts` 校验）+ 一个最小冒烟测试（如 `World` reducer 单测）。

#### P3-3 模块/经典脚本混用，加载顺序脆弱
- **证据**：经典脚本（bloub / emotionball / gsap）先于 module 执行，靠 HTML 书写顺序耦合；全仓 0 处 `defer`/`async`。
- **影响**：任何一个经典脚本顺序调整都会破坏 `window.Bloub` 等全局的就绪时机。
- **建议（仅描述）**：统一为 ES 模块（把 bloub / emotionball 改 `export`），用 `import` 静态保证依赖就绪，去掉对全局顺序的依赖。

#### P3-4 文案字面量驱动的逻辑
- **证据**：`src/controllers/window2.js:57-62` 遍历全文档所有 `<p>` 做文本正则替换（O(全部段落)，且依赖中文文案字面量）。
- **影响**：文案一改逻辑即失效，脆弱。
- **建议（仅描述）**：改由 `data-*` 属性或显式 id 定位目标节点，脱离文案字面量。

---

## 3. 用户勾选修复重点的覆盖映射

| 用户勾选的重点 | 本报告对应条目 |
|---|---|
| ① 死代码与冗余 | P1-7（i18n 死数据）、P1-8（docx 不可达）、P1-9（备份目录）、P1-10（未用导出）、P2-3（tokens.css 名不副实）、P3-2（零工程化含 .gitignore/README） |
| ② 生命周期/泄漏 | P0-1（bloub rAF）、P0-2（心跳/轮询）、P0-3（setInterval）、P0-4（docRefs）、P0-5（监听器） |
| ③ 重复实现收敛 | P1-1（两套球引擎）、P1-2（三套球渲染）、P1-3（协议双实现）、P1-4（联动双份）、P1-5（doc-review 双份）、P1-6（同名文件） |
| ④ 工程化补强 | P2-1（内联 onclick）、P2-2（内联 style）、P3-1（超长行）、P3-2（lint/test/gitignore）、P3-3（模块混用） |

> 另已覆盖的两个在侦察中确认的事实：`screen1.html`/`index.html` 使用 `data-i18n` 却未加载 i18n 脚本（见 P1-7）；`tokens.css` 实际只是 `@import components.css`（见 P2-3）。

---

## 4. 总体结论

**架构意图（好）**：世界引擎 `World.state` 作为唯一真相源、UI 只读派生、双窗口经 `localStorage` 同步——这是一个清晰、正确的核心设计。

**落地层面（差）**：上述好设计被四类问题侵蚀——
1. **重复**：同一"球"约 3600 行两份引擎、联动 UI 三组分两份、协议双实现；
2. **泄漏**：6 个常驻 rAF + 至少 5 处永不清的定时器 + 只增的 Map + 可重复注册的监听器；
3. **死代码**：备份目录 ~400KB、i18n 9.3KB 死数据、docx 不可达分支、未用导出；
4. **工程化裸奔**：无 lint/test/gitignore/README，巨型单文件，内联事件与样式散落。

**建议优先级**：先 P0（消除泄漏，低改动高收益）→ 再 P1（删死代码 + 收敛重复，显著降低后续改坏概率）→ P2/P3（可维护性补课）。若后续进入修复，建议从 P0-1、P0-2、P1-9 这三项低风险高收益项起步。

---

*本报告由静态走查生成，所有行号基于评审时的仓库快照；进入修复前建议以 `grep` 复核目标行号是否因后续编辑偏移。*

---

## 5. 原子级评估（函数级）

> 镜头：impeccable `critique` / `audit`（复杂度、可维护性、性能与资源生命周期、耦合、坏味道）。范围：高风险核心文件（`world.js` / `window2.js` / `bloub.js` / `emotionball/*` / `nebula.js` / 关键 CSS 主题层）。粒度：以函数为原子单元。
> 每条结构：**职责 / 圈复杂度 CC / 潜在 bug / 坏味道 / 改进点**。CC 为分支点（if/switch/for/while/三元/&&||）估算，`>` 10 标红为重构重点。行号为真实读取复核值。

---

### 5.1 `src/modules/world.js`（世界引擎，619 行）

**`buildState` 56:114** — 用数据模块 + 真实时钟构造初始可变状态。CC≈5。
- bug：`empName`(50) 依赖 `window.AIC.CAST`，未注入时返回 key 自身（显示异常不崩）；`t-hero` 与 `HERO.regen`(172) 编号衔接依赖初值。
- 坏味道：任务价值 `3000+Math.random()*9000` 在 75/79/90 行重复 3 次（后面 `order`213/`spawnOrder`371 又重复）；魔数（日志长 6、事件长 60、spark 长 26）。
- 改：提 `genTaskValue()` 与顶部常量。

**reducer 段**
- `progress` 147:153（CC≈3）空引用已防，无 bug。
- `taskDone` 154:178（CC≈6）**bug**：156 行只拦截 `status==='done'`，`queued/blocked` 任务经 `completeTask`(589) 可被「空完成」（无 owner 则只 `counters.done++/kb++`）；169-176 `t-hero$nv` **无上限累积**，长会话 `tasks` 无限增长。
- `claim` 179:187（CC≈2）**bug**：不校验任务是否已被他人认领，直接覆盖 `owner`（抢单），且不释放旧 owner 的 `current`。
- `block`/`unblock`/`rework` 188:203 / 248:256 — 空引用已防，无实质 bug；`rework` 用 `Math.max(15,…)` 保证下限合理。
- `order` 204:219（CC≈4）**bug**：订单永不删除（只 `settling/settled`），`orders` 长会话无限增长；派生任务 `value` 魔数重复。
- `settle` 220:232（CC≈4）`o.status==='settled'` 守卫有效；与 `scheduleFlow`442 的 `push` 重复「>26 则 shift」逻辑。
- `dispatch` 233:247（CC≈5）**bug**：238 行暂存回池只判断 `doing`，原任务 `blocked` 不回池；员工状态字符串 `'run'/'idle'/'wait'/'busy'` 散落多处魔数，无枚举。
- `template` 257:262（CC≈2）/ `note` 263（CC≈1）— 无 bug；`note` 空 reducer 仍触发一次 `persist()`(279)。
- `speed` 264:268（CC≈3）**bug**：`v=0` 时流速为 0、世界冻结（无下限校验）。

**事件总线**
- `notify` 272:274（CC≈2）`try/catch` 内 `console.error` 生产噪声；可能广播未应用的未知类型事件。
- `applyBatch` 275:281（CC≈4）**bug**：278 行未知 `e.type` **静默丢弃无日志**（调试盲区）；`changed=false` 时仍 `notify` 未处理事件。

**持久化**
- `persist` 289:295（CC≈2）**bug**：294 行同时写 `time:state.time` 与 `state`（含 time）——重复序列化，快照体积翻倍；长会话写整份膨胀的 `tasks/orders`，localStorage 配额压力大。

**引擎循环**
- `tick` 302:352 — **CC≈15+（重构首选）**，50 行承担进度/完成认领/阻塞/结算四职责。
  - **bug**：337/347 的 block/unblock/settle `setTimeout` 回调**未存句柄，无法被 `stopEngine` 取消**；`taskDoing().forEach` 306 与 321 行被调用两次。
  - 坏味道：魔数密集（0.22/0.5/1.9/1.7/0.45/0.8/72/2600/2400/9000/12000）。
  - 改：拆 `advanceProgress/autoClaim/maybeBlock/scheduleSettle`，setTimeout 句柄可 clear。
- `spawnOrder` 355:380（CC≈6）**bug**：371 派生任务带 `_role` 但 `order`(213) 建任务**完全忽略 `_role`**（死字段 + 进快照涨体积）；`d.tasks` 为空时产生无任务订单。
- `scheduleOrder` 381:390（CC≈3）递归自调度，首行 `clearTimeout` 防重，OK。
- `systemLoad` 393:400（CC≈2）手写估算公式魔数散落。
- `schedulePatrol` 402:421（CC≈3）巡检走 `applyBatch([{type:'note'}])` 触发**无谓 persist**。
- `scheduleCost` 424:433（CC≈2）**bug**：425 行 `setInterval` 未先 clear（依赖 `startEngine` 先清）；每 5s 整份 `persist()`，长会话配额压力大。
- `scheduleFlow` 436:447（CC≈4）`pushSpark` 应与 `settle` 抽公共。

**leader 选举**
- `adoptSnapshot` 453:467（CC≈6）**bug**：462 行沿用旧快照 `speed`，新 leader 流速可能短暂不被追随者感知；`v!==2`(454) 版本号硬编码，升级协议易漏改。
- `pull` 470:481（CC≈7）**bug**：474 行 `10000` 为魔数（10s 指令有效期）；命令过期后**不删除**，陈旧命令常驻 localStorage。
- `canClaim` 487:493（CC≈4）判定自洽；`LEASE_MS`/`REVIVE_MS` 与心跳 2000ms 隐式 4×，无派生常量。
- `claimLeadership` 495:501 / `beat` 504:520（CC≈6-7）退位判定与 `canClaim` 对称，无竞态崩溃；逻辑正确。
- `startEngine` 522:527 / `stopEngine` 528:532 — **重点核实**：`stopEngine` **确实不 clear `beatTimer`(534)/`pollTimer`(535)**（设计内，属 startSync）；但建议补 clear 以防重复 `startSync`。
- `startSync` 533:561（CC≈6-7）**重点核实**：**无幂等守卫**，重复调用会泄漏 interval + 重复绑定 5 个监听器；537 行 `if(!window.addEventListener)return` 放在 interval 已起之后，极端环境无法清理。

**对外 API** `World` 564:606 — 各方法 CC≈1-2，模式一致（applyBatch + 非 leader 写 CMD_KEY）。
- **bug**：`setSpeed`(577) 透传 `v` 无校验（v=0 卡死）；`completeTask`(589) 可对任意状态强制完成；`dispatch`(585) 透传 `task` 对象，缺 `id` 时静默 return 无反馈。
- 坏味道：7 个命令方法 90% 结构重复，应抽 `dispatchCmd(type,payload)`；所有 `Date.now()` ts 与 `pull` 的 10s 有效期魔数分散。

**`boot`** 611:619（CC≈3）**bug**：613 行 `10*60*1000` 魔数与 `pull` 的 10s、`REVIVE_MS` 20s 均无关联常量；跨页流速短暂不一致（同 `adoptSnapshot`）。

> **world.js 全局结论**：① 状态无限增长（`tasks`/`orders` 永不清理）最应优先修；② 魔数/手写同步（任务价值 5+ 处、员工状态字符串、LEASE_MS 隐式 4×）；③ 定时器治理薄弱；④ 可观测性缺失（未知 action 静默跳过）；⑤ `tick` 是复杂度峰值。

---

### 5.2 `src/controllers/window2.js`（控制器，1310 行）

**`normalizeStaticTimes` 30:65** — 把写死时间改成"N分钟前"。CC≈7。**bug 核实成立**：57 行 `document.querySelectorAll('p')` **全文档遍历**，仅按 `indexOf('写入知识库')` 过滤，文案一改即失效；4 段逻辑重复。

**工牌** `updateBadges` 188:213（CC≈7）— `RING_C=245.04` 魔法常量重复；`World.state.employees[m.key].pct` 在 employee 缺失时 `undefined.pct` 抛错（CAST 与 employee key 强耦合）。`Bloub.mount` 167-172/216-218 无销毁/单例保护。

**群聊**
- `addChatRow` 272:308 — **CC≈13（>10）**。bug：280 行 review 类气泡若缺 `docId` 会渲染成文件卡却不可点；302 行每次成行全线程 `querySelectorAll('.chat-row')` 重查。坏味道：className 三元拼接 + 内联 `innerHTML` + 魔数 `46`。
- `queueChat`/`drainChat` 252:265（CC≈2）模块重载会遗留悬挂 `setTimeout`。
- `addReact` 325:334（CC≈2）**bug**：未校验末行是否已被 46 行裁剪移除。`reviewFromBubble` 314 依赖 `docRefs` 命中。

**思考链** `thinkChain` 495:511（CC≈7）`while(thinkQ.length>7)` 内 `forEach` 找最低 prio 再 splice（O(n²)，n≤8 可接受）；`dedupe` 不更新 `recent.at`（非滑动窗口）。`typeStep`/`playThinking`/`pumpThinking` 无实质 bug。

**巡检/文档**
- `postReviewToChat` 598:633（CC≈4）**高优 bug**：615 行 `res.findings[0]` 与 617/622/626/629 直接访问 `top.section/.issue/.suggestion/.source`；当 `!res.pass` 但 `res.findings` 为空/undefined 时**直接抛 TypeError 中断整条处理**（应加 `res.findings?.length` 守卫）。
- `latestDeliveredOrder` 551:557 兜底返回 `{}` → 下游 `generateDeliverableDoc` 的 `docRefs.set` 键可能为 undefined。
- `generateDeliverableDoc` 634:658（CC≈4）647 行 `docRefs` **只增**；4200ms 延时未存可清。

**第3屏球**
- `IntersectionObserver` 675:681 — **核实：ebTimer 已正确 clear**（此前"未清理"线索在此不成立）。`armIdle` 691:699 22s 看门狗续命正确。
- **重复 querySelector 核实成立**：709-710 行 `.p3` 各查一次，应缓存 `const p3`。

**监管/派发**
- `routeRole` 720:728（CC≈6）`normalizeTitle` 729:734 — 字符串字面量硬依赖分身职责关键词。
- `converse` 736:755（CC≈4）`ebBall.setEmotion('10')` 与 `runDispatch` 的球态存在**视觉竞争**。
- `runDispatch` 794:846 — **setTimeout 链竞态部分成立**：6 连 setTimeout（813/814/822/826/829/841）**均未保存无法 clear**；正常因 `taskBusy` 不叠加，但热重载会留野定时器写入状态；`ebBall` 表情与 `World.on` 事件球态竞争。

**面板/事件**
- `renderEventLog` 857:880（CC≈6）每帧整表 `innerHTML` 重渲。
- `updatePanels` 882:906（CC≈5）`kb.total` 等无防御若 undefined 显示 "undefined"；`prod-orders` 内联样式拼接(903)。
- `syncHeroDocVer` 923:935（CC≈5）929 行每次重查 `.shelf-row`；931 行 `Nebula.docs().find(...)` 每次重建全量数组。

**世界事件总处理** `World.on` 969:1120 — **巨型 switch，CC≈26（>10），~150 行，可读性热点成立**：10 个 case（order/taskDone/claim/settle/block/unblock/rework/note/dispatch/speed）+ Nebula.on 7 分支。建议拆 `handlers[type](e,st)` 映射表。
- **bug**：`taskDone` 1005-1009 延时给"末行"加表情时该行可能已被裁剪顶替（同 addReact）；`settle` 1046 自动弹审阅与 `postReviewToChat` 归档路径**可能双开弹窗**；`rework` 1082-1083 `Nebula.stats().current/getPoint/inspect` 链式访问**无空守，任一 undefined 抛错**。

**控件** `wireSeg` 1123 / `patrolChk` 1141 — OK。
- **setInterval 未清理核实成立**：1155 运行时长、1165 `updateLoad` 均**未赋变量无 clearInterval**（对比 677/690 已受管）；长会话/热重载泄漏两个定时器。

**知识目录** `docContentFromCatalog` 1192 / 搜索 1171:1182（CC≈3）`textContent.includes(q)` 全目录逐行扫描；点击复看 1207 重复执行会重复绑定 click；1213 `docRefs.set` 同 key 覆盖。

**卷轴** `go` 1224 / 拖拽 1230:1258（CC≈6）/ 键盘 1269:1273 / `revealPage` 1277:1301 — 无实质 bug；拖拽用模块级变量 `startX/lastX` 跨监听共享。`revealPage` i===0 处内联多段 gsap 动画。

**启动** 1303:1310（CC≈2）`go(1)` 被绑到 rAF 与 load 两次（幂等无害）。

> **window2.js 全局结论**：① `docRefs` 只增不减（27/314/647/1213）已确认内存泄漏；② `World.on` 巨型 switch（CC≈26）是最大可读性问题；③ 两处 setTimeout 未 clear（1155/1165）+ runDispatch 6 连未存；④ 额外高优 bug：`postReviewToChat` findings 空抛错、`World.on rework` 链空守、`addChatRow` review 气泡不可点；⑤ 仅 `addChatRow`/`World.on` CC>10。

---

### 5.3 `src/modules/bloub.js`（球引擎 A，1706 行）

**几何/形状（53-263）**：`silhouette`/`circle`/`blend`/`toPoints`/`closedPath`/`profileFromPolygon`/`hullOfCircles`/`radiusAtAngle`/`superellipseProfile`/`unionOfCirclesProfile`/`roundedPolygon`/`regularPolygonProfile`/`polyPath`/`capsulePath` — 多纯函数，CC 均 ≤2，无实质 bug；`blend`(74) 长度不等时兜底为 1 安全；`pose` 未校验键名（坏味道）。

**`skins` 264:335** — `COLORS`(308) 中 `ambre` 与 `orange` 同为 `#ffd23f`、`vert` 与 `turquoise` 同为 `#2dd4bf`（**重复色值坏味道**）。

**`decor`/`face`** — `wheel`(337,CC≈7 分段 HSL)、`arcRender`、`eyePoses`、`blinkLid` 等均无 bug。

**`expressions` 571:615** — `EXPRESSIONS`(16 套) 与 emotionball 的 `EXPRESSIONS`（眼环）**命名冲突语义不同**（两套引擎各自维护表情数据，坏味道）。

**`states` 616:982** — `STATES`(671-971，~300 行) 16 状态内联；`POSES`(975) 与 `STATES[i].duration` 重复表达时长（坏味道）；`durations` 无运行时校验，越界时退化为不混合（安全）。

**`eyefit` 983:1207** — `resous`(1069,CC≈5) 方向二分法 O(N) 较重，但仅 `batir()` 启动期跑一次（可接受）；`batir` 预计算偏移表，运行期不调用。

**`BotEngine` 1208:1577**
- `blendPose` 1226:1252（CC≈1）dots/arcs 合并加 `a/b` 前缀防冲突，安全。
- `setExpression` 1279:1288 / `setState` 1400:1411 — `setState` **bug**：1409 `STATE_BY_ID.get(id).blinkIn` 若 `id` 非法会 `undefined.blinkIn` 抛错（缺防御）。
- `sample` 1412:1509 — **CC≈8-10（本文件最复杂之一）**，97 行把前景/背景/掩码/dots/notif/arcs 全塞进一个返回对象。**坏味道**：建议拆 `sampleEyes/sampleDots/sampleArcs`。

**API 1523:1704**
- `renderSVG` 1523:1576（CC≈4）`linearGradient id="${uid}-${arc.id}"` 与 blendPose 加前缀的 arc.id **可能重名**（时间不同帧风险低，坏味道：id 命名空间未全局唯一）。
- `mount` 1615:1667 — **rAF 机制本身正确**（`stop()`(1666) 可取消）；**泄漏根源确认**：返回值 `{stop,engine}` 被 `index.js:8,11` 与 `window2.js:216` **丢弃** → 永远无法取消（index 两 demo 球 + chat-main 球）；`window2.js:168` 正确存入 `badgeAvatars` 但从未调用 `.stop()`。`container.innerHTML=''`（1627）**破坏性清空**兄弟节点；`void prev`(1658) **死代码**。
- `fill` 1684:1689 — `JSON.parse(el.dataset.bot||'{}')` **无 try/catch**，单元素坏数据中断整批（潜在 bug）。
- `window.Bloub` 1691:1704 — 实际导出 12 个键（非 9），`RAYON/DEMI_VIEWBOX/SHAPES/COLORS/EXPRESSIONS/STATES/SEQUENCE/POSES/BotEngine` **过度暴露内部实现**；`static` 键名与保留字冲突（可读性差）。

---

### 5.4 `src/modules/emotionball/*`（球引擎 B，1942 行）

**`engine.js`**
- `lerpColor`/`hexToRgb`(57-72) — 与 bloub 的 `mixHex/wheel` **功能重复但实现不同**（两套颜色插值坏味道）。
- `ticker` 300:316 — **核实：可用 Set 管理、可 stop**（set 空则下一帧自然停），无泄漏。
- `setEmotion` 405:445 — **CC≈8-10**，40 行承担解析/兜底/过渡/池/眨眼/特效/事件多职责；兜底链 `unknown→warn→fallback→return false` 但调用方多忽略返回值。
- `_compose` 608:762 — **CC≈15+（全工程最复杂）**，154 行单函数（pool/blinkQ/antics/spring/bounce/ring/theme/gaze/open/transition 十余系统）；`depth<4` 递归防爆栈(617)；最大维护痛点。
- `destroy` 577:582 — **核实：清理彻底**（stopTour + setActive(false) + ball.destroy 删 DOM）；小瑕疵：未置空内部引用、依赖下一帧自然停 rAF、未防御重复调用。
- `renderStatic` 566:576 临时清空 `_seq` 再 `_tick`，逻辑自洽。

**`ball.js`**
- `createBall` 77:603 — 526 行单函数 + 闭包状态（`trails/planes/confPieces/prevYaw`），**难单测**；`shape=RD.SHAPES[opts.shape]||blob` 静默回退。
- `applyPose` 419:596 — **CC≈10+，177 行，全文件最重**；`dYaw` 防 NaN/跳变(474/477)、`hist.length>48` 上限、hue 归一化，无 SVG 越界。
- `buildTrail` 281:317（CC≈3）`n-1==0` 除零由调用方 `hist.length<2` 跳过（安全）。
- `destroy` 598:600 — **bug**：svg 已移除时 `svg.parentNode` 为 null → 抛错（应判空）；`renderStatic` 同理缺幂等防护。

**`emotions.js`** `EMOTION_SEED` 33:508 — **32 套表情**，纯声明数据可读但**魔数/重复结构多**（颜色 hex、gaze 坐标、amplitude/period 无注释）；`id` 分段契约(00-09/10-29/30-49/50+) 与 `pool` 索引(0-24) 两套编号无集中校验，误填 25 被 `normalize` 静默 filter（**不报错但表情错乱**）。建议抽公共默认值 + 颜色/gaze 常量 + 启动全量校验告警。

**`rings.js`** `EB_RINGS` 7:13 — 25 组眼环（每组 48 点）+ 3 形状，`HEAD_C=114.2705` 与 ball.js 一致；**坏味道**：整段 EXPRESSIONS+SHAPES 压成**第 11 行约 40KB 单行**，diff/审阅/加注释极难，建议拆多行/多文件。

> **两套球引擎结论**：① 重复已确认（SHAPES/COLORS/EXPRESSIONS 各自维护 + 颜色插值函数重复）；② 真实 rAF 泄漏在 bloub 的调用方丢弃返回值（非 ticker 机制）；③ 复杂度峰值 `_compose`(engine)/`applyPose`(ball)/`sample`(bloub) 均 >10；④ `ball.destroy`/`setState`/`fill` 缺防御。

---

### 5.5 `src/modules/nebula.js`（知识星图，105 行）

**顶层 IIFE 8:105** — **高优 bug**：10-11 行 `if(!cv||!cv.getContext) return;` **静默早退** → `window.Nebula` 永不为赋值（行 102），调用方 `Nebula.addKnowledge` 抛 `Cannot read properties of undefined` 且无 console 报错（典型静默失效）。建议早退时挂 no-op 桩或 `console.warn`。

**状态 22:42** — `points`/`events` **无上限**（`addPoint` 每调 push，`events` Set 不退订即泄漏）；>20 个裸 `let` 未归并 `state`；`R=220` 等初始魔数。

**`addPoint` 49:53（CC≈6-7）** — **bug**：`radius:position?.radius||1` 当 `radius===0` 时回退 1（falsy 误判）；`confidence/learningScore` 用数组长度做伪随机，分布可预测；`rebuildLinks`(57) O(n²) 每次调用，n=230 时约 5 万次/次。
**`evolve` 66** — **死代码**：全文无调用点，"自演化"从未发生，与文件头注释不符。
**`render` 80:86（CC≈6-8）** — 超长单行 + 4 层嵌套 + 数十魔数（`*.28/.10/.55/.62…`），几乎不可单测；84 行 `anchorByKey.get(o.agentKey).color` 未空守；`ripples` 过期依赖每帧 render（暂停时堆积）。
**`setInterval` 98** — **核实：永不 clearInterval**（无句柄、无销毁路径）；`loopPulse` 在 `visible` 判断外，页面隐藏仍每 5s 白跑；间隔 9000/5200 魔数，与 IntersectionObserver 未打通。
**指针事件 91:94** — **bug**：未处理 `pointercancel`，拖拽中触发则 `cv._drag` 残留屏蔽悬停；move/up 每次 O(n) 命中检测。
**`inspect` 69** — `inspecting` 设后**永不自动清空**（除非下次 inspect / unfocus），连线高亮长期停留。
**`improve` 70** — 采纳条件 `answer.length>=…||Math.random()<.82` 中 82% 概率使"长度优先"形同虚设（逻辑含糊）。
**稳健项**：`emit`(67)/`kick`(89)/`showPop`/`refreshPop`/`getPoint`/`stats`/`project`/`rotate` 写得稳。

---

### 5.6 CSS 关键主题层

**window2.css 多层叠加选择器** — 真实行号全部准确，且发现**更多同链成员**：
| 选择器 | 层定义行 | 层数 |
|---|---|---|
| `.eb-card--orb` | 78/348/1060/1113/1224/1253 | **6** |
| `.well` | 420/1070/1115/1231/1251 | 5 |
| `.plain-ring` | 411/1074/1119/1230/1252 | 5 |
| `.chat__head` | 167/1052/1110/1214/1215/1240 | 6 |
| `.tp__panel`/`.p2__chat` | 281/1051/1109/1207/1235 | 5 |
| `.bubble--ai` | 201/1112/1216/1243(+components 3) | 跨文件 7 |
- 坏味道：后段只补 `background/box-shadow` 子项，读者无法在一处见完整视觉；"工业仪表层"(1235-1258) 把 `--primary-ring`/`--accent-ring` 的 RGB **再内联一遍**（如 `rgba(124,116,201,.42)`）。
- 改：每选择器单定义 + 自定义属性分层（`--surface-bg/--surface-bd/--surface-glow`）；末端层引用 token；高频叠层用 `@layer` 显式分离。

**doc-review：window2.css(977-1131) vs window2-review.css(1-21)** — 非"覆盖"而是**两份独立布局同名类**（居中模态 vs 全屏工作台），约 80% 规则重复；`.dr-tab--on` 一处用 `--primary` 一处用 `--pine-teal`（两页高亮不一致）；`window2-review.css:15` 的 `!important` 防御性非必需（建议提高特异性替代）。

**screen1.css token 覆盖层 15:79 + 84:106** — 确实重定义 components.css 颜色块的浅色纸感版（方向正确）；但**会局部露馅**：body 接管层 `rgba(47,191,160,.10)`(86) 等是 `--primary/--clay` 的内联 RGB 副本，改 components 语义色 screen1 光晕不变；`#f08a24`(685/706「阻塞」) 未用 `--clay`、`rgba(79,70,229,…)`(435) 即 `#4f46e5` 与 `--neon-violet`(#8b5cf6) **不是同一紫**；浅色阴影 `rgba(43,42,38,…)` 11+ 次写死 `--ink` 的 RGB。建议改带透明度 token（`--ink-a10` 等）。

**硬编码 rgba/#hex 代表行**：window2 172/1071/1116/1240/1245（近黑玻璃底出现 `13,21,36`/`16,20,28`/`10,13,20` 三种近似不同值）；screen1 685/706/435。共性：同语义色多"近似但不等"硬值。

**reduced-motion 覆盖评估**
- components.css 869:885 — 文件末尾**单一权威降级块**（`!important` 兜底），全仓最规范。
- screen1.css 511:527/822:826 — 降级合理但碎片化，且**漏了 `.tpl-chip i`(571) 的 pulse**。
- window2.css — **5 块分散且有缺口**：`.task-bar__send`(396)/`.chip`(669)/未覆盖；1083-1089 把动画 `animation:none` 写在**普通规则（无条件）**里，即所有用户都看不到这些动效，与"降级"语义混淆。建议收敛为末尾一块。
- window2-review.css — **全文无 `prefers-reduced-motion` 块**（19/20 实为响应式），缺安全网，建议补占位块。

**tokens.css 名不副实** — 仅 1 行 `@import components.css`；三页 link 它等于加载整套 885 行暗色系统（含 `body` 暗色背景 826-833），screen1 只能靠更高特异性压回（脆弱）。建议拆 `tokens.css`(纯 `:root`) + `components.css`(`@import tokens`)。

---

### 5.7 原子级评估小结（高风险函数速查）

| 函数 | 文件:行 | CC | 关键风险 |
|---|---|---|---|
| `tick` | world.js:302 | ~15+ | 4 职责合一 + setTimeout 句柄不可 clear |
| `World.on` | window2.js:969 | ~26 | 巨型 switch，可读性/维护热点 |
| `addChatRow` | window2.js:272 | ~13 | review 气泡不可点 + 全线程重查 |
| `runDispatch` | window2.js:794 | 4(但 6 连未存 setTimeout) | 热重载野定时器写入状态 |
| `_compose` | emotionball/engine.js:608 | ~15+ | 154 行单函数，全工程最复杂 |
| `applyPose` | emotionball/ball.js:419 | ~10+ | 177 行，难单测 |
| `sample` | bloub.js:1412 | ~8-10 | 97 行，应拆分 |
| `mount` | bloub.js:1615 | 低 | rAF 返回值被丢弃 → 泄漏（调用方） |
| IIFE 早退 | nebula.js:10 | 低 | `window.Nebula` 静默 undefined |
| `setInterval` | nebula.js:98 | 低 | 永不 clear + 隐藏页白跑 |

> 进入修复建议：先于 window2.js 补 `docRefs.delete` 与 `setTimeout`/`setInterval` 句柄登记、把 `World.on` 拆映射表；world.js 给 `tasks/orders` 加清理上限 + `tick` 拆分；bloub 持有 `mount` 返回值并卸载时 `stop()`；nebula 早退挂桩 + `setInterval` clear。CSS 先拆 `tokens.css` 与收敛 window2 五段叠层。

*（第 5 章为函数级静态走查，行号基于本轮真实读取；修复前建议 `grep` 复核偏移。）*
