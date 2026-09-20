# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 项目定位

零构建、**运行时依赖 0** 的纯静态多页演示站（原生 ES 模块 + 经典脚本混用）。无打包器、无 TS、无框架。改完直接刷页面即可验证。

## 常用命令

**本地预览**：`npm run serve`（等价 `npm start` / `node serve.js`），默认 `http://localhost:4173`，用 `PORT` 环境变量覆盖端口。也可双击 `启动.bat` / 执行 `启动.sh`。原生 ES 模块必须经 HTTP 访问，直接 `file://` 打开会失败。

**质量门禁（唯一测试入口）**：`npm run check`（等价 `npm test`），即 `node scripts/check.mjs`。它是**单一脚本、六道检查串行**，没有"跑单个测试"的能力——要看某一项是否通过，只能读它打印的 `PASS/FAIL` 行。当前基线必须 **6/6 通过、失败 0**，否则 `exit 1`。六项为：引用完整性（HTML `src/href`、JS `import`、CSS `@import`）、语法检查、未用导出、DOM 契约、颜色等价、World 冒烟。

**Lint**：`npm run lint`（`eslint .`），`npm run lint:fix` 自动修复。**必须保持 0 error**；现有 10 条 warning 是历史遗留的未用内部量，属已知可接受项。

**格式化**：`npm run format` / `npm run format:check`。范围仅 `scripts/**/*.{mjs,js}`、`eslint.config.js`、`.prettierrc.json`——`.prettierignore` 显式排除了 `src/` 与 `*.md`，避免对历史大文件产生数千行无意义 diff。不要扩大格式化范围。

**视觉回归**：改动 CSS、HTML 结构或任何触发重排/重绘的 JS 之后必须跑。
```
python tools/visual/snapshot.py --label base      # 改动前采基线
python tools/visual/snapshot.py --label after-xxx # 改动后
python tools/visual/compare.py base after-xxx     # 一致则 IDENTICAL + exit 0，有差异打印清单 + exit 1
```
需 Python 3 + `playwright`；服务端口默认 `4188`（`VISUAL_PORT` 可覆盖），与预览用的 4173 错开。快照落在 `tools/visual/out/`（已忽略）。

## 架构总览

### 唯一真相源与跨窗口同步

`src/modules/world.js` 的 **`World.state` 是全站唯一可变状态**。它同时被三个页面加载，通过 `localStorage` 的三个协议键同步：状态快照、leader 租约、命令队列。同步机制为 `storage` 事件 + 轮询兜底（无 `BroadcastChannel` / `postMessage`）。

**leader 选举**：多个窗口竞争租约，优先级高者成为 leader，只有 leader 推进世界引擎并写状态；follower 通过写"命令键"间接请求变更。只读派生 API 为 `World.leaderInfo()`（`syncOK/isLeader/lease/ageMs/live/prio`）与 `World.leaderKey`。

**这是全项目最强的约束**：控制器只允许**只读派生渲染**，不得自己读写 `localStorage` 协议键、不得复制租约解析逻辑。历史上 `screen1.js` 另写过一份 `readLease()` + 复制的 `LEASE_MS`，已被消除。任何跨窗协议解读一律经 `World.*`。

### 三页与加载顺序

| 页面 | 角色 |
|---|---|
| `index.html` | 启动器：双开窗口、按桌面尺寸预览 |
| `screen1.html` | 运营驾驶舱（单窗口满屏） |
| `window2.html` | 横向卷轴，含第 2 / 3 / 4 屏 |

**脚本顺序即执行顺序**，不可随意调整。经典脚本（`ball-core.js` → `bloub.js` / `emotionball/*`）先于 ES 模块控制器执行，靠 HTML 书写顺序保证 `window.BallCore` / `window.Bloub` / `window.EmotionBall` 就绪；`gsap` 仍为 CDN 经典脚本，**可选**——所有动画必须有 gsap 缺失时的降级路径。

### 分层

- **`src/data/`**：静态常量（`worldData.js` 客户/需求池/模板、`cast.js` 角色花名册、`documents.js`、`icons.js` SVG 精灵）。
- **`src/modules/`**：引擎与共享层。`world.js` 引擎、`common.js`（挂 `window.AIC`：花名册、Toast、图标注入、窄屏提示）、`linkage.js`（**跨页共享层**：事件标签、派发语义路由、事件流 DOM 生成）、`time.js`（时间格式化 + `data-ts` 全局刷新器）、`docgen.js`（交付文档生成 + 审阅工作台）、`schedule.js`（自包含排期引擎，驱动 screen1 甘特图）、`nebula.js`（知识星图 canvas）。
- **`src/controllers/`**：页面控制器，只渲染不持有协议。`index.js` / `screen1.js` / `window2.js`，其中 `window2/` 下已抽出 `reel.js`（卷轴拖拽/吸附/键盘/入场）与 `static-times.js`。
- **`src/styles/`**：见下节。
- **`tools/`**：`visual/`（回归基座）、`baseline/`（对照截图，**已 gitignore，不入库**）。

### 三种球体渲染（有意保留）

同一"数字人球"概念存在三套渲染，属**设计需要而非重复实现**，不要合并：`bloub.js` SVG 球（工牌/头像）、`emotionball/*` 眼环球（主 AI 中枢，第 3 屏）、`nebula.js` canvas 点云（第 4 屏知识星系）。它们已收敛共享的颜色数学与调色板于 `ball-core.js`；但 `SHAPES` / `EXPRESSIONS` 两套语义不同（身体轮廓+面部表情 vs 眼环点阵+情绪种子），**各自维护是正确的**。

### 样式：严格单向依赖

`tokens.css`（唯一 `:root`，只放变量）→ `components.css`（`@import "./tokens.css"`；reset + 共享组件 + 全局背景，全站唯一一份）→ `pages/*.css`（仅本页独有规则）。

不可违反的约定（详见 `DESIGN.md`）：

- 页面层**不得**声明 token 覆盖块，**不得**在文件末尾追加"收口/覆盖"块。
- `prefers-reduced-motion` 降级块必须留在**各 CSS 文件最末**（早期因写在前面被后段规则层叠覆盖而整体失效）。
- 深度语言：近黑底上黑色投影不可见，层级由**表面阶梯**（`--sf-0..3`）+ **边缘发丝** + **顶缘高光**表达；辉光只服务活动态与浮起层，是例外不是结构。
- **光影模型**：主光正上方略前倾、冷白 ~6500K；抬升面吃 `--lit-top`、凹陷面吃 `--ao-inset`、真浮起层才用 `--elev-2` + `--glass-sheen` + `backdrop-filter`（白名单）。光效全静态，不新增 `backdrop-filter`、不动画化光效。
- `--shadow-soft` / `--shadow-lift` 是**遗留别名**，已就地指向光影模型；新代码直接用 `--edge-*` / `--lit-top` / `--elev-*` / `--contact-*`。
- 数据可视化配色纪律：**角色色只做信号点**（泳道名前圆点），图形本体只表达状态，单图形并发色相 ≤2。
- 圆角按语义取档（`--r-bar` → `--r-ctrl` → `--r-card` → `--r-panel` → `--r-pill`），禁止一个值压平全部组件。
- 字号 `--fs-micro`(1.2rem) 是绝对下限。

### 资源生命周期纪律

演示站长驻运行，泄漏会累积。既有约定：

- `Bloub.mount()` 返回 `{stop, engine}`，**必须持有句柄**并在 `pagehide` 调用 `.stop()`；丢弃返回值会造成永不停止的 rAF。
- 所有 `setInterval` / `setTimeout` 需登记并在 `pagehide` 集中清理（`world.js` 用 `pending`/`later`，`window2.js` 用 `intervals`/`timeouts`，`screen1.js` 用 `_scrIntervals`）。
- `World.startSync()` 有幂等守护，`stopSync()` 解绑全部监听器。新增全局监听器必须登记到解除列表。

### 门禁中的两条"契约"检查

`scripts/check.mjs` 有两条容易踩的检查，改代码前务必知道：

- **DOM 契约**：扫描全部 JS 里的 `#id` / `.class` / `[data-*]` 选择器，与三页 HTML + 全站 CSS 做比对，**失效即 FAIL**。这类缺陷不报错、不崩溃、lint 全绿，只会静默失效（历史事故：标签改名后入场时间线仍指向旧类名，元素带 `opacity:0` 永久不可见）。改类名/删元素必须同步所有 JS 选择器。`data-*` 属性可从 JS 生产者站点自动推导（`dataset.x =` / `setAttribute` / 非 `[` 前缀的 `data-x=`），所以**选择器不能把自己论证成已定义**。仅 `aic-toasts` / `aic-miniscreen` / `aic-ft-sprite` 由运行期创建，已在检查内以注释白名单放行。
- **颜色等价**：`ball-core.js` 的 `hexToRgb` / `rgbToHex` / `lerpColor` 与历史两套实现做 1100 组逐值回归。改动颜色数学会使该项 FAIL。

### 其他既有取舍（不要"顺手修正"）

- `eslint.config.js` **刻意不使用** `@eslint/js` 的 `recommended` 预设：历史代码会把大量风格问题升级为 error 导致门禁永远红灯。只把真·bug 类规则设为 error，可维护性类设为 warn。不要"升级"为 recommended。
- `src/styles/base.css` 已在设计系统收口中删除，其内容并入 `components.css`；不要重建。
- 运行时 `dependencies` 保持 0；新增 devDependency 需有充分理由。
- `window2.js` 仍是约 1200 行的单文件（工牌/群聊/派发/思考链共享同一闭包状态）；进一步按屏拆分需先引入显式状态容器，属结构性工作，不要零散拆分。
- 未用导出检查是启发式的，零引用导出会被记为告警；新增对外 API 前先确认调用方。
