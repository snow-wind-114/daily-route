# Daily Route Project Guide

> 项目级说明。靠近本仓库的规则优先于 `D:\agent project\AGENTS.md` 的通用规则。

## 版本与状态

- 当前版本：`v0.1`
- 版本日期：`2026-11-15`
- 状态：可用的单机离线 MVP
- 发布方式：GitHub Pages，`main` 分支根目录
- 仓库：<https://github.com/snow-wind-114/daily-route>
- 正式网址：<https://snow-wind-114.github.io/daily-route/>

### 版本规则

每次提交到 GitHub 时，必须在同一个提交中更新本文件。

- 文档修正、兼容性 bugfix、内部重构但不改变行为：`v0.1.1`、`v0.1.2`……
- 新增用户可见功能、数据结构或重要交互：`v0.2`、`v0.3`……
- 进入正式稳定版或发生不兼容的数据/URL 变化：`v1.0`、`v2.0`……
- 每个提交至少更新“当前版本”“版本日期”“最近变更”和“最近验证”。
- 每次功能或架构变化，同时检查下方模块地图、数据模型、规则和测试命令是否仍然准确。

### 最近变更

| 版本 | 日期 | 内容 |
|---|---|---|
| `v0.1` | 2026-11-15 | 建立项目级 Agent 指南；记录当前离线日程 MVP 架构与发布流程 |

### 最近验证

- `node --test`：13 项规则测试通过。
- 手机尺寸下的今天、本周、本月、活动和编辑流程已人工验证。
- GitHub Pages 正式网址返回 `200`。

## 产品目标与边界

Daily Route 是一个面向安卓手机的离线日程 PWA。用户提前安排课程、会议和日常活动，并在今天时间轴、本周列表、本月占用图和活动项目列表之间查看或编辑。

当前产品约束：

- 单人使用，无账号。
- 无后端、无云同步、无多设备同步。
- 活动数据只保存在当前浏览器、当前网址对应的本地存储中。
- 不需要记录实际完成情况。
- 当前版本不发送提醒。
- 只能创建和查看从今天起未来六个月的安排。
- 活动不能跨午夜。
- 同一未来半年内的活动不能重叠。

未经用户明确要求，不要添加云同步、登录、统计追踪、后台服务、提醒或第三方 API。这些都会改变产品的数据边界和长期维护成本。

## 技术栈与运行方式

- 原生 HTML、CSS、JavaScript ES Modules。
- 无 npm 依赖、无打包步骤。
- 浏览器本地存储：`localStorage`。
- PWA：Web App Manifest + Service Worker。
- 测试：Node.js 内置 `node:test`。
- 部署：GitHub Pages 直接从 `main` 根目录发布。

本地运行：

```powershell
node .\serve.mjs
```

打开 `http://localhost:4173`。

运行测试：

```powershell
node --test
```

基础语法检查：

```powershell
node --check .\app.js
node --check .\schedule.js
node --check .\date-utils.js
node --check .\sw.js
node --check .\serve.mjs
```

## 文件架构

| 文件 | 职责 |
|---|---|
| `index.html` | 应用 DOM 骨架、四个主视图、活动表单和确认对话框 |
| `styles.css` | 移动优先布局、时间轴、月历、活动列表、弹窗和响应式样式 |
| `app.js` | 应用组合根：DOM 引用、运行时状态、事件绑定、视图渲染、本地持久化和表单流程 |
| `schedule.js` | 领域逻辑：活动规范化、重复日期计算、冲突检测、系列拆分/截断、占用槽计算 |
| `date-utils.js` | 纯日期时间工具：ISO 日期、日期差、六个月窗口、月/周边界、时间转换和默认时间 |
| `manifest.webmanifest` | PWA 名称、主题、安装图标和启动范围 |
| `sw.js` | 离线缓存、导航请求处理和静态资源缓存更新 |
| `icons/` | 普通图标、Maskable 图标和 SVG 源图标 |
| `test/schedule.test.mjs` | 日期、重复、冲突、拆分、删除和月历占用的回归测试 |
| `serve.mjs` | 无依赖本地静态文件服务器 |
| `README.md` | 用户启动、安装和数据限制说明 |
| `GITHUB_PAGES.md` | GitHub Pages 发布步骤 |
| `scripts/generate-icons.ps1` | 生成 PWA PNG 图标 |

`artifacts/`、`dist/` 和 `daily-route-site.zip` 是本地临时产物，已由 `.gitignore` 排除，不属于运行源码。

## 运行时架构

```text
index.html
  -> app.js（ES Module）
      -> date-utils.js（日期/时间纯函数）
      -> schedule.js（活动领域规则）
      -> localStorage（唯一持久化数据源）
      -> sw.js（离线应用壳缓存，由独立线程运行）
```

主要数据流：

```text
localStorage
  -> loadEvents()
  -> state.events
  -> occurrencesBetween()/occurrencesOnDate()
  -> render()
  -> 今天 / 本周 / 本月 / 活动
```

表单保存流程：

```text
活动表单
  -> validateActivityInput()
  -> seriesFromInput()
  -> findScheduleConflict()
  -> splitSeriesForEdit() 或追加新系列
  -> localStorage
  -> render()
```

`app.js` 当前集中承载界面逻辑，是小型项目的刻意取舍。不要把单个纯函数从 `schedule.js` 或 `date-utils.js` 搬回 `app.js`；领域规则应保持可测试且不依赖 DOM。

## 应用状态

`app.js` 的 `state` 是运行时界面状态：

| 字段 | 含义 |
|---|---|
| `events` | 从本地存储还原的活动系列数组 |
| `view` | `day`、`week`、`month`、`activity` |
| `selectedDate` | 当前日视图日期 |
| `weekCursor` | 当前周的周一 |
| `monthCursor` | 当前月第一天 |
| `editing` | 正在编辑的系列 ID 和发生日期 |
| `pendingDelete` | 当前确认删除目标 |
| `activityQuery` | 活动页搜索词 |
| `autoScrollDay` | 下次日视图渲染是否重新定位时间轴 |
| `dayScrollTarget` | 保存后需要定位到的时间 |

状态不是多份事实源：活动数据以 `state.events` 为准，持久化时写入 `localStorage`。

## 本地数据模型

存储键：

```text
daily-route.storage.v1
```

存储结构：

```json
{
  "version": 1,
  "events": []
}
```

单个活动系列：

```js
{
  id: "uuid",
  title: "高数课",
  date: "2026-11-13",
  startTime: "14:30",
  endTime: "15:50",
  repeatEvery: 1,
  repeatCount: 3,
  notes: "带教材",
  endBefore: null,
  createdAt: "ISO timestamp",
  updatedAt: "ISO timestamp"
}
```

字段约束：

- `date`：本地 ISO 日期 `YYYY-MM-DD`。
- `startTime`、`endTime`：本地时间 `HH:mm`，结束时间必须晚于开始时间。
- `repeatEvery`：1–14 的整数天。
- `repeatCount`：1–20 的整数，表示包含首次活动在内的总次数；`null` 表示无限次。
- `notes`：选填，最多 500 字符。
- `endBefore`：内部拆分边界，排他日期；当天及以后不再属于该系列。
- `repeatCount === 1` 表示仅发生一次。

所有加载数据都经过 `normalizeSeries()` 清洗；无效系列会被丢弃。修改数据模型时必须：

1. 保持旧数据可读，或编写可逆迁移。
2. 更新本文件的数据模型和业务规则。
3. 为兼容、边界和迁移行为添加测试。

## 日期与半年窗口

- 所有日期都按设备本地时间解释。
- 可用窗口从今天开始。
- 结束日期为“同一日期加 6 个日历月，再减 1 天”。
- 日历日期差使用 UTC 年月日中间值计算，避免夏令时导致整数天偏差。
- 只能显示窗口内发生日期；无限重复规则本身可以继续存在。
- 月视图和外层导航都被限制在窗口内。

日期逻辑优先放入 `date-utils.js`，不要在渲染函数中重复计算。

## 重复模型

活动系列从一个起始日期开始，每隔 `repeatEvery` 天产生一次发生：

```text
第 0 次：date
第 1 次：date + repeatEvery
第 2 次：date + 2 * repeatEvery
...
```

- 有限次数包含第一次，所以 `repeatCount = 3` 产生 3 次。
- 无限次数在查询时只计算请求日期范围内，绝不把无限系列展开成无限数组。
- `endBefore` 将系列限制为严格早于该日期的发生。
- 半年窗口之外的无限重复不渲染。
- 每个系列同一天最多产生一次；当前版本不支持一天内同系列的多次发生。

## 编辑、拆分和删除

用户编辑某个发生日期时，产品规则是“修改本次及以后”：

- 编辑系列第一次发生时，直接替换原系列。
- 编辑中间发生时，原系列通过 `endBefore` 截断在所选日期之前。
- 从所选日期开始创建新系列。
- 删除中间发生时，原系列同样通过 `endBefore` 截断。
- 删除第一次发生时，删除整个系列。
- 活动页中的已结束项目可以整项删除。

拆分后可能出现多个独立系列，这是预期行为，不应擅自自动合并。

## 冲突规则

使用 `findScheduleConflict()` 检查候选系列和现有系列在半年窗口内的发生日期。

- 两个时间段满足 `newStart < existingEnd` 且 `newEnd > existingStart` 时冲突。
- 首尾刚好相接不算冲突，例如 `14:30–15:50` 与 `15:50–16:30`。
- 编辑系列时忽略该系列自身，避免误报。
- 冲突会阻止保存，并显示日期、时间和冲突活动名称。
- 当前保证范围是未来半年；不要对外声称已验证半年之外的无限序列。

## 视图架构

### 今天

- 00:00–24:00 纵向时间轴。
- 每 30 分钟显示刻度和标签。
- 活动块按分钟定位。
- 重叠活动使用列布局并排显示。
- 时间轴自动滚动到当前时间或最早活动附近。
- 点击活动打开编辑表单。

### 本周

- 周一至周日。
- 当前周中过去日期不可查看，这是半年限制的一部分。
- 每天显示活动时间与名称。
- 点击日期进入日视图，点击活动直接编辑。

### 本月

- 点击日期进入该日。
- 每天使用 12 个占用槽，每槽代表 2 小时。
- 占用槽只表示对应两小时内存在活动，不表示活动持续了完整两小时。
- 月历导航被限制在半年窗口。

### 活动

- 进行中：未来半年内仍有发生。
- 已结束：未来半年内没有发生。
- 进行中按最近发生日期升序排序。
- 支持按活动名称搜索。
- 点击进行中活动直接打开“本次及以后”的编辑器。
- 已结束活动允许直接删除，但仍需确认。

## PWA 与缓存

- `manifest.webmanifest` 和 `sw.js` 必须使用站点相对路径，保证 GitHub Pages 子路径可用。
- Service Worker 对导航使用网络优先、离线回退；静态资源也优先取网络并回写缓存。
- 修改核心静态文件时，检查 `sw.js` 中的 `CACHE_NAME` 是否需要升级。
- 发布后至少验证：首页、`manifest.webmanifest`、`sw.js`、图标和一次离线重载。
- 浏览器本地数据与网址绑定。修改仓库名、Pages 路径或自定义域名会产生新的数据空间。

## 测试策略

`schedule.js` 和 `date-utils.js` 是主要自动测试接缝。新增或修改以下逻辑时必须先补回归测试：

- 日期加减、月份边界和半年窗口。
- 有限/无限重复发生日期。
- 冲突与首尾相接。
- 系列拆分、截断、删除“本次及以后”和最近发生日期。
- 2 小时占用槽。
- 输入范围、跨午夜和字段校验。

界面检查不能只依赖单元测试。修改 UI 后至少验证：

1. 390 px 左右的手机宽度无横向溢出。
2. 四个底部导航都可操作。
3. 添加、编辑、删除和冲突错误正常。
4. 本周、本月和活动页与日视图数据一致。
5. 断网重载后应用仍能打开。

## 发布与 Git 工作流

- 仓库的 `main` 分支根目录就是发布目录。
- GitHub Pages 的 Source 应保持为 `Deploy from a branch`、`main`、`/(root)`。
- 静态文件修改后直接推送到 `main`，GitHub Pages 自动发布。
- 不修改仓库名称、默认网址或发布目录，除非同时处理浏览器数据迁移问题。
- 不提交 `artifacts/`、`dist/`、`daily-route-site.zip`、`node_modules` 或本地数据。

推荐提交前检查：

```powershell
git status
node --test
git diff --check
```

推荐发布后检查：

```powershell
Invoke-WebRequest -Uri 'https://snow-wind-114.github.io/daily-route/' -UseBasicParsing
```

## 每次 GitHub 提交的强制流程

1. 完成代码或文档修改。
2. 运行与改动对应的测试和手动验证。
3. 更新本文件的版本号、版本日期、最近变更和最近验证。
4. 如果架构、数据模型、业务规则或部署方式改变，同时更新相应章节。
5. 将代码与本文件放在同一个 Git 提交中。
6. 推送后检查 GitHub Pages 是否发布成功。

只有在本文件没有准确变化时才可以保持版本号不变；即便如此，日期和验证结果也必须更新。禁止代码已经变化而本文件仍描述旧架构。

## 当前已知限制

- 没有提醒或锁屏通知。
- 没有本地备份、导入、导出或删除撤销。
- 不能只跳过一次重复活动。
- 重复模型只有“每 N 天”，没有“每周几”或工作日规则。
- 没有历史记录、完成状态或实际用时。
- 没有账号、云同步或多设备同步。
- 冲突保证只覆盖未来半年。
- 月历占用精度为 2 小时。
- 活动备注在浏览视图中不可见。

这些限制是当前产品边界，不应被文档、界面或提交说明误写成已支持。
