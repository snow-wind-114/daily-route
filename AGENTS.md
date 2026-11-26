# Daily Route Project Guide

> 项目级说明。本文件优先于 `D:\agent project\AGENTS.md` 的通用规则。

## 版本与发布地址

- 当前版本：`v0.6.3`
- Android：`versionCode=13`、`versionName=0.6.3`
- 版本日期：`2026-11-26`
- 网页：<https://snow-wind-114.github.io/daily-route/>
- 固定 APK：
  <https://github.com/snow-wind-114/daily-route/releases/latest/download/daily-route.apk>
- 更新清单：
  <https://snow-wind-114.github.io/daily-route/update.json>
- 仓库：<https://github.com/snow-wind-114/daily-route>

### 版本规则

每次提交 GitHub 时，必须在同一提交更新本文件。

- 除非用户当轮明确要求“提交”“发布”或“上传”，只更新代码和版本号、运行验证并构建本地签名 APK；不得执行 Git commit/push、标签、GitHub Release 或线上 Pages 更新。
- 未要求发布时，默认提供 `artifacts/daily-route-v<version>.apk` 和 `artifacts/daily-route.apk` 作为本地下载文件。
- 用户明确要求发布时，严格使用指定版本；不得改写已经存在的标签，也不得擅自提升或复用其他版本号。
- 文档修正、兼容性 bugfix、内部重构：`v0.5.1`、`v0.5.2`……
- 新增用户可见功能、数据结构或重要交互：`v0.4`、`v0.5`……
- 正式稳定版或不兼容的数据/URL 变化：`v1.0`、`v2.0`……
- 每个提交至少更新“当前版本”“版本日期”“最近变更”和“最近验证”。

### 最近变更

| 版本 | 日期 | 内容 |
|---|---|---|
| `v0.6.3` | 2026-11-26 | 专注运行页白名单入口、单次项目只读月历和每日专注历史 |
| `v0.6.2` | 2026-11-23 | Android 专注锁机与白名单、息屏续算、手动暂停、完成通知和壁纸保持 |
| `v0.6.1` | 2026-11-23 | 修复移动端活动多选、专注滚动、教程遮挡和壁纸预览 |
| `v0.6.0` | 2026-11-23 | 活动草稿、多选批处理、离线教程、全局分类、分类迁移和专注 MVP |
| `v0.5.2` | 2026-11-22 | 回顾直达与范围导出、顶栏添加按钮清理、12 月年度迁移和回顾清理 |
| `v0.5.1` | 2026-11-22 | 每日回顾、回顾提醒与跨年回顾册、打卡历史只读、待办文案修正、备份 v5 |
| `v0.5.0` | 2026-11-22 | 打卡提醒、周视图分区、桌面组件三分区、活动生命周期重做、备份 v4 |
| `v0.4.0` | 2026-11-22 | 自然年视图、定期/待办/打卡、分类与归档、年度迁移、原生活动闹钟排程和 v4 存储迁移 |
| `v0.3.2` | 2026-11-15 | 增加闹钟通道诊断和通知通道降级；完善组件名称、图标和静态预览 |
| `v0.3.1` | 2026-11-15 | 修复桌面组件使用 RemoteViews 不允许的 `<View>` 导致主屏加载失败 |
| `v0.3` | 2026-11-15 | 普通通知/精确闹钟、单次调整、系列暂停、桌面组件、恢复点、更新检查和 v3 存储迁移 |
| `v0.2` | 2026-11-15 | 安卓本地账户、基础非精确提醒、活动导入导出、APK 下载 |
| `v0.1` | 2026-11-15 | 离线日程 MVP、GitHub Pages 与项目指南 |

### 最近验证

- `node --test`：83 项通过。
- `node --check`、脚本语法与统一版本检查：通过，版本为 `v0.6.3 (13)`。
- Android `testDebugUnitTest`：通过，包含专注锁机包名策略测试。
- Android Debug/Release 构建：通过，`versionCode=13`、`versionName=0.6.3`。
- Release APK：v2 签名通过，证书 SHA-256 仍为 `81af0bc6dad4481ca886befff7e4dd5d87e5fde9e3ec6c7a4fe24a686f91b1ab`。
- Release APK SHA-256：`23C3F4B160FF92E284761BA00B6211B0E6BD08B60F0C58BF928BF5A0C42D504F`。
- Release 权限：INTERNET、VIBRATE、RECEIVE_BOOT_COMPLETED、WAKE_LOCK、POST_NOTIFICATIONS、SCHEDULE_EXACT_ALARM；另有 AndroidX 生成的包内动态接收器权限。
- 无头 Edge 390×844 与 320px：项目操作顺序为“开始、编辑、月历、删除”，月历只读且显示当天秒数；原有专注连续计时、暂停、壁纸和导航检查继续通过。
- Android 模拟器：v0.6.2 覆盖安装 v0.6.3 后账户、活动、累计时间、白名单 Chrome、回顾和壁纸数据保留；最终 APK 可继续覆盖安装。
- 白名单应用入口：专注运行页显示“白名单应用”，打开面板后可启动 Chrome；专注计时保持运行。
- 项目月历：Android 对话框显示 42 格月份、当天记录“2分”、月份汇总“1天有记录·2分钟·0次完成”，没有编辑控件。
- 历史兼容：旧累计时间继续保留，月历只从 v0.6.3 新记录开始显示，不虚构旧日期。

## 产品边界

Daily Route 是单用户、本地优先、按当前自然年组织的活动安排工具。

网页版：

- 匿名使用。
- 可新增、编辑、单次调整、修改后续和暂停定期活动，并使用待办与打卡。
- 数据只保存在当前浏览器、当前网址对应的 `localStorage`。
- 可导出 JSON 和下载 APK。
- 不提供账户、真实系统提醒、桌面组件或更新检查。

安卓版：

- 使用本地单账户，是长期主入口。
- 支持普通通知、应用自有精确闹钟排程、桌面组件、本地恢复点和 JSON 导入导出。
- 支持应用内专注和可选无障碍锁机；网页版无法拦截其他应用。
- 用户主动检查更新，通过系统浏览器下载覆盖安装。
- 不依赖后端、云数据库、云同步或第三方 API。

始终不主动增加：

- 后端、云同步、多设备同步。
- 统计、追踪、广告。
- 位置、相机、通讯录、麦克风或广泛文件存储权限。
- 静默安装、后台更新或应用内 APK 安装器。

## 技术栈与分层

- 原生 HTML、CSS、JavaScript ES Modules。
- Node.js、Capacitor 8.6、Android Gradle Plugin 8.13。
- Android compileSdk/targetSdk 36，minSdk 24。
- Android 插件：App、Browser、Local Notifications、Filesystem、Share 和自定义 Device/Widget/Alarm 插件。
- 测试：Node.js 内置 `node:test`。

```text
index.html
  -> app.js（组合根、界面、账户、备份、更新和交互）
      -> activities.js（三类活动、分类、打卡、归档和年度复制）
      -> drafts.js（三类新建活动草稿）
      -> focus.js（专注项目、流程、累计、密码和运行会话）
      -> focus-assets.js（本机 IndexedDB 壁纸）
      -> review.js（今年回顾、活动摘要、Markdown 回顾册和跨年清理）
      -> schedule.js（重复、暂停、单次调整、冲突等领域规则）
      -> date-utils.js（日期时间纯函数）
      -> account.js（PBKDF2 账户）
      -> app-state.js（网页/安卓存储与 v2–v5 -> v6 迁移）
      -> backup.js（备份格式与摘要）
      -> recovery.js（最近 5 个恢复点和导出时间）
      -> year-migration.js（迁移候选、暂停恢复和次年活动复制）
      -> tutorial.js（离线分类教程）
      -> notifications.js（串行提醒计划、普通通知和闹钟降级）
      -> alarm-scheduler.js（JS 到原生精确闹钟排程器）
      -> native-widget.js（当前年度发生快照、待办和打卡摘要）
      -> update-check.js（update.json 校验和版本比较）
      -> native-files.js（安卓分享）
      -> localStorage

scripts/prepare-android-web.mjs
  -> 复制网页资源到 www/
  -> esbuild 打包 scripts/native-entry.js 为 native-bridge.js

android/
  -> Capacitor Android 工程
  -> DailyRouteAlarmSchedulerPlugin（每个系列保留最近一次精确唤醒）
  -> DailyRouteAlarmReceiver（触发通知并安排下一次）
  -> DailyRouteAlarmRestoreReceiver（重启、时间和时区变化后恢复）
  -> DailyRouteWidgetPlugin（JS 到 SharedPreferences）
  -> DailyRouteWidgetProvider（RemoteViews 4×2 组件）
  -> DailyRouteFocusAccessibilityService（专注锁机窗口拦截）
  -> DailyRouteFocusLock（白名单和锁机私有状态）
  -> Gradle 生成 Debug/Release APK
```

## 网页与安卓存储

网页键保持不变：

```text
daily-route.storage.v1
```

网页 payload 版本升级为 6，但存储键和网址不得改变。读取时兼容旧活动，并补充全局分类、回顾、专注和年度迁移状态：

```js
{
  version: 6,
  events: [],
  categories: [],
  yearMigrationCompletedFor: 2026,
  reviewEntries: [],
  reviewReminder: { enabled: false, time: "21:30" },
  focusProjects: [],
  focusFlows: [],
  focusQuotes: [],
  focusWallpapers: [],
  focusPassword: null
}
```

安卓当前键：

```text
daily-route.storage.v6
```

旧键：

```text
daily-route.storage.v5
daily-route.storage.v4
daily-route.storage.v3
daily-route.storage.v2
```

启动时先读 v6；不存在时依次读取 v5、v4、v3、v2，归一化后写入 v6。旧键暂时保留为一次性恢复副本但不再作为事实来源。不得删除或改名 v6 键，除非同时实现明确迁移。

- v5 及更早状态升级时直接清空旧分类定义，并把所有活动 `categoryId` 设为 `null`。
- v1–v5 JSON 备份中的分类同样忽略；v6 备份才读取统一分类。

网页与安卓是不同 origin、不同数据空间。迁移路径只有：

```text
网页导出 JSON -> 安卓登录后导入
```

## 活动数据

所有活动共享：

```js
{
  id: "uuid",
  kind: "schedule" | "todo" | "checkin",
  title: "名称",
  notes: "备注",
  categoryId: null,
  year: 2026,
  archivedAt: null,
  archiveReason: null,
  createdAt: "ISO timestamp",
  updatedAt: "ISO timestamp"
}
```

定期活动增加：

```js
{
  id: "uuid",
  kind: "schedule",
  title: "高数课",
  date: "2026-11-16",
  startTime: "14:30",
  endTime: "15:50",
  repeatEvery: 1,
  repeatCount: 8,
  notes: "带教材",
  reminderMode: "notification",
  reminderMinutesBefore: 5,
  occurrenceOverrides: [],
  pauses: [],
  endBefore: null,
  createdAt: "ISO timestamp",
  updatedAt: "ISO timestamp"
}
```

待办使用 `deadlineDate`、`deadlineTime`、`reminderMode`、`reminderDaysBefore`（0–30）和 `completedAt`。打卡使用 `checkInDates`、`pauses`、`reminderMode`、`reminderTime` 和 `completedAt`；同一天最多一次，旧数据默认不提醒且 `reminderTime` 为 `21:00`。

约束：

- `repeatEvery`：1–14 天。
- `repeatCount`：1–20 个活跃发生，`null` 表示重复至当年 12 月 31 日。
- `reminderMode`：`none`、`notification` 或 `alarm`。
- `reminderMinutesBefore`：0–1440；新活动默认 5 分钟。
- 活动不能跨午夜。
- 当前自然年内定期活动时间不能重叠，首尾相接允许；待办和打卡不参与时间重叠。
- 所有发生日期必须限制在活动所属自然年内。

所有读取必须经过 `normalizeActivity()`；定期活动再经过 `normalizeSeries()`。旧 `reminderEnabled: true/false` 分别迁移为普通通知/不提醒。

## 每日回顾

回顾每个日期最多一条，仅保存当前自然年：

```js
{
  date: "2026-11-22",
  summary: "今日总结",
  reflection: "感想",
  inspiration: "灵感",
  activitySnapshot: {
    schedules: [{ title: "课程", startTime: "09:00", endTime: "10:00" }],
    todos: [{ title: "报告", deadlineTime: "18:00", status: "pending" }],
    checkins: [{ title: "阅读", checked: true }]
  },
  createdAt: "ISO timestamp",
  updatedAt: "ISO timestamp"
}
```

- `summary`、`reflection`、`inspiration` 各限制 1000 字符。
- 只有今天可编辑；今年历史日期只读，未来日期不可选。
- 今天页按选中日期提供回顾直达入口；未来日期不显示。
- 首次保存时冻结 `activitySnapshot`，后续修改文字不得替换快照。
- 三段文字全部为空时删除当天记录。
- 回顾正文本地明文保存，进入 JSON 备份与恢复点，账户密码不加密正文。
- 回顾可导出选中日期所在周、月或年度；周从周一开始，内容只包含已保存回顾。
- 12 月在回顾页显示年度导出提醒；网页和安卓都支持 Markdown 导出。
- 跨年清理在 1 月首次启动或恢复时执行最终提示，不得在 12 月尚未结束今年记录时清理。
- 只有成功生成文件且用户确认已保存，或用户二次确认放弃后，才可清除旧回顾及恢复点中的旧回顾。
- Markdown 回顾册只输出有总结、感想或灵感的日期。

## 活动草稿

- 独立键：`daily-route.activity-drafts.v1`，固定包含 `schedule`、`todo`、`checkin` 三个槽位。
- 只保存新建活动表单；编辑已有活动不得覆盖草稿。
- 输入约 300ms 后保存，关闭表单立即保存；点击“+”恢复最近修改的草稿，切换类型载入对应槽位。
- 成功创建、主动丢弃、退出登录或重置账户时清除对应草稿。
- 草稿不进入 JSON 备份、回顾导出、恢复点或桌面组件快照。
- 日期已过期的草稿恢复后必须重新通过现有表单校验，不能在后台自动修正正式数据。

## 专注

- 专注数据属于 v6 状态：单次项目、周期流程、语句、壁纸元数据和专注密码哈希。
- 单次项目类型仅允许 `focus`、`rest`；时长 1–240 分钟。两类都记录自身累计执行秒数，只有 `focus` 计入总专注时长。
- 周期专注是一次性顺序模板，不是日历重复活动；步骤引用单次项目并允许覆盖 1–240 分钟，最多 20 步。
- 被流程引用的单次项目不得直接删除，必须先从流程移除。
- 运行使用真实时间计算；息屏、进入后台、页面隐藏和进程恢复都继续计时，只有用户手动暂停才停止。
- 周期流程恢复时必须顺序补齐所有已跨过的阶段，不能只结算当前一步。
- 提前结束必须二次确认；设置密码时先验证密码。实际前台执行秒数计入当前项目，休息段不计入总专注时长。
- Android 专注使用原生沉浸模式和 `FLAG_KEEP_SCREEN_ON`；可选锁机使用只监听窗口状态的无障碍服务，不读取窗口内容、不模拟点击。
- 无障碍未开启时允许普通专注，但必须显示“锁机未生效”；开启后所有专注自动启用锁机。
- 手动暂停时计时停止但锁机保留；完成或提前结束后解除。锁屏、通知栏、权限确认和紧急入口固定放行，系统设置不默认放行。
- 可启动应用白名单由原生读取名称，支持搜索和多选；白名单与锁机状态只保存在 Android 私有 SharedPreferences，不进入 JSON 或恢复点。
- 专注运行页必须提供白名单应用入口；入口只显示已配置且仍安装的应用，通过原生启动应用，计时继续。
- 每个单次项目保存 `dailyHistory`：`{ date, seconds, completedRuns }`，按本地日期合并；旧版本累计值无法反推日期。
- 单次项目的“编辑”后提供只读月历，显示 42 格月度记录、每日时长、完成次数和月份汇总，不允许补录或修改历史。
- 活动运行会话保存在 `daily-route.focus-session.v1`；新会话使用 `continuityVersion: 2` 按真实时间恢复，v0.6.1 旧会话升级后首次仍按暂停恢复。
- 运行会话保存固定的 `wallpaperId`、`quoteId`；暂停、继续和前后台切换不得重新随机或清空壁纸，进程恢复时从 IndexedDB 重读同一图片。
- 专注完成通知进入现有串行提醒计划，使用普通通知通道；开始/继续安排，暂停/完成/提前结束取消，不新增精确闹钟权限。
- 专注密码使用 PBKDF2 哈希；手动 JSON 不包含哈希，导入后关闭。Android 可用本地账户密码清除，网页必须输入“清除专注密码”。
- 壁纸压缩后存入 IndexedDB，最多 12 张、最长边 1920px；图片不进入 JSON 或恢复点。

## 单次调整

`occurrenceOverrides` 以原计划发生日期为键，示例：

```js
{
  occurrenceDate: "2026-11-18",
  title: "调整后的会议",
  date: "2026-11-19",
  startTime: "16:00",
  endTime: "17:00",
  notes: "",
  reminderMode: "alarm",
  reminderMinutesBefore: 10,
  updatedAt: "ISO timestamp"
}
```

规则：

- 单次调整只能修改名称、有效日期、起止时间、备注和提醒，不改重复规则。
- 原 `occurrenceDate` 被替换，有效日期可以移动到同一自然年内其他日期。
- 活动栏仍按一个系列展示，并显示单次调整数量。
- 提醒、冲突、月历占用和桌面组件使用有效日期。
- 提醒 ID 继续使用 `seriesId + occurrenceDate`，避免移动日期后重复通知。
- `applyOccurrenceOverride()` 不负责完整冲突提示；调用方必须对最终活动集合运行 `findConflictWithinRange()`。

## 暂停与恢复

`pauses` 记录闭区间：

```js
{ "startDate": "2026-11-18", "endDate": null }
```

- `endDate: null` 表示当前暂停。
- 暂停从所选发生日期开始，之前发生保留。
- 暂停日期不显示、不计占用、不提醒，也不消耗有限次数。
- 恢复时将当前暂停结束日期设为恢复日前一天。
- 恢复后从第一个符合原重复周期的日期继续，仍遵守剩余活跃次数。
- 已暂停系列在活动栏单独归入“已暂停”，可恢复或删除。

不得把暂停实现成简单隐藏整个系列，否则会重新引入“暂停消耗次数”的错误。

## 重复、编辑与删除

发生日期通过 `occurrencesBetween()` 统一计算。禁止把无限重复展开为无界数组。

编辑范围：

- 第一次发生选择“本次及以后”：更新整个系列。
- 中间发生选择“本次及以后”：原系列用 `endBefore` 截断，从所选日期创建新系列。
- “只修改这一次”：写 `occurrenceOverrides`。
- 修改后续系列时，保留仍匹配新发生日期和次数的单次调整；不匹配项必须在界面确认后丢弃。

定期活动界面不再使用“删除本次及以后”：

- 暂停从某次发生开始，保留剩余次数。
- 归档立即停止整个系列的后续发生和提醒，并进入归档。
- 删除永久移除整个活动系列和全部历史。
- 单次变化只通过“只修改这一次”处理，不提供单次删除。
- 恢复归档项目时先打开编辑表单；保存合法新日期后才清除归档状态。
- 编辑弹窗关闭后再排队打开确认框，禁止连续 `close()`/`showModal()` 导致 WebView 丢弃确认框。

## 待办、打卡、分类与归档

- 待办过期后仍留在待办区并标记“已逾期”，完成后归档并取消提醒。
- 今天页可切换今天状态；今年的过去日期只读显示，本周页和活动页打开的打卡月历均只读。
- 打卡通知只允许操作今天；未来日期、暂停区间和归档项目不可打卡。
- 分类以全局数组存储，三类活动可共用同一分类；名称全局去重，每个活动最多一个分类。删除分类时把三类相关活动统一设为未分类。
- 活动页多选只处理当前搜索与分类筛选后的整个活动系列。切换筛选、搜索、进入归档或退出活动页时结束多选。
- 批量归类、暂停、归档和永久删除必须先创建恢复点；批量归档不得把待办或打卡自动写成“已完成”。
- 归档项目只读，可恢复或永久删除。有限定期活动结束后自动归档；年度结束后仍活动的旧项目进入对应年份归档。
- 归档页按年份和活动类型查看。恢复旧年份定期或打卡项目时必须调整到当前合法年份。

## 自然年与年度迁移

- 主视图固定为当年 1 月 1 日至 12 月 31 日，可查看今年过去日期。
- 12 月 1 日至 31 日展示迁移与回顾导出提醒；安卓在 12 月 1 日 09:00 安排一次普通通知。
- 1 月未完成迁移时允许补迁；完成迁移后不再重复提示。
- 迁移候选只包括旧年的定期和打卡，包含已暂停项目；排除待办和手动归档项目。
- 确认迁移后立即复制勾选项目到目标年份；暂停项目在次年恢复，分类和提醒保留。
- 迁移对话框按统一分类分组，分类复选框可一次选择该分类的所有定期和打卡，之后仍可逐项取消。
- 待办不迁移。旧年未完成待办在年度结束时归档并标记未完成。
- 分类跨年复用。迁移完成后写入 `yearMigrationCompletedFor`，防止重复迁移。
- 一次确认后，12 月内不再追加复制；次年副本可直接在活动页编辑。
- 回顾不随活动迁移复制；1 月迁移完成后提示导出或明确放弃后删除旧回顾。

## 冲突

冲突条件：

```text
newStart < existingEnd && newEnd > existingStart
```

- `findScheduleConflict()` 用于表单候选和当前自然年窗口。
- 单次调整只忽略正在替换的那一次，不忽略同系列的其他发生。
- 修改后续系列忽略原系列整个 ID，但保存前仍须检查最终集合。
- `findConflictWithinRange()` 用于导入和最终保存校验。

## 账户与安全

- 账户名 2–64 字符，密码 6–64 字符。
- 每个账户使用 16 字节随机盐。
- 密码使用 PBKDF2-HMAC-SHA256、210,000 次迭代、256 位哈希。
- 只保存 Base64 哈希和盐，不保存明文密码。
- `sessionActive` 只控制本地登录状态，不加密活动。
- 忘记密码只能重置账户并导入此前备份。
- 账户密码和账户名不迁移到新手机。

账户逻辑在 `account.js`，不得复制到 DOM 事件中。

## 提醒与闹钟

规则：

- 普通通知使用 `daily-route-notifications-v1` 渠道。
- 闹钟使用 `daily-route-alarms-v1` 高优先级渠道、独立声音和振动。
- 每个打卡项目每日最多提醒一次，默认时刻 `21:00`；当天已打卡、暂停或归档时跳过。
- 每日回顾提醒使用普通通知，默认关闭、默认 `21:30`，使用每日重复计划，不进入精确闹钟排程。
- 每日回顾通知点击必须打开当天的回顾页。
- 年度迁移提醒使用普通通知，12 月 1 日 09:00 触发一次；完成后重新同步取消。
- 相同触发时刻和提醒方式的多个未打卡项目必须合并成一个 `checkinGroup`。
- 打卡组使用稳定的 `checkin-group:<mode>:<time>` 身份；打卡状态变化后重新同步并取消当天旧计划。
- 活动闹钟使用 `DailyRouteAlarmSchedulerPlugin`，不再把所有未来发生交给 Capacitor 插件逐个排程。
- 原生排程器为每个活动系列只保留最近一次 future job；广播触发后从持久化 job 列表安排下一次，避免精确闹钟数量上限。
- JS 提醒同步必须串行执行，禁止并发“取消全部后重排”导致新排程被旧同步取消。
- 闹钟不是全屏 Activity。
- 首次选择闹钟时先请求通知权限，再请求“闹钟和提醒”特殊权限。
- 精确权限被拒绝时允许保存，但必须降级为普通通知，并在界面明确标注。
- 活动闹钟通道被系统关闭时，必须降级到普通通知通道，不能静默安排到不可见通道。
- “测试闹钟”与真实活动共用原生排程器，不得先跳转权限设置而丢失测试流程。
- 每次发生只安排一次。
- 只调度提醒时间尚未过去的发生；年度迁移后可在 12 月提前安排下一年提醒。
- 登录、冷启动、应用恢复、新增、编辑、暂停、恢复、导入和删除后重新同步。
- 权限不足时必须取消旧的待发送提醒，不能保留过期计划。
- 闹钟点击通过原生 pending-open 队列返回 `seriesId`、有效日期和原始日期。

账户面板应显示通知权限、精确闹钟权限、提醒计划数、系统实际排程系列数、下一项时间和最后错误，并提供测试通知和测试闹钟。

## 桌面组件

- 原生类：`DailyRouteWidgetProvider`。
- JS 原生桥：`DailyRouteWidgetPlugin`。
- 尺寸：目标 4×2，左侧最多 3 项今天定期，右上最多 2 项今天截止待办，右下显示打卡项目数与已打卡数。
- 显示当前项和下一项标记；超过 3 项显示剩余数量。
- 点击活动打开应用对应有效日期。
- JS 通过 `native-widget.js` 生成当前年度快照版本 2，按日期保存 `schedules`、`todos`、`checkins`。
- 组件点击通过 `kind` 区分 `schedule`、`todo`、`checkinSummary`。
- 原生组件必须继续读取 v0.4 数组快照作为一次性兼容回退。
- 快照写入应用私有 `SharedPreferences`，组件不得直接读取 WebView `localStorage`。
- 保存、登录、导入、暂停、恢复、应用恢复和日期变化后刷新。
- 退出登录或重置账户时清除组件快照。

## 备份与恢复

外部备份格式升级为：

```json
{
  "format": "daily-route-backup",
  "version": 6,
  "appVersion": "0.6.3",
  "exportedAt": "ISO timestamp",
  "eventCount": 0,
  "yearMigrationCompletedFor": 2026,
  "categories": [],
  "events": [],
  "reviewCount": 0,
  "reviewEntries": [],
  "reviewReminder": { "enabled": false, "time": "21:30" },
  "focusProjectCount": 0,
  "focusProjects": [],
  "focusFlows": [],
  "focusQuotes": [],
  "focusWallpapers": []
}
```

规则：

- 新导出使用版本 6。
- 解析器继续接受版本 1–6；旧活动按定期活动读取，旧打卡自动补默认提醒字段，旧备份回顾和专注默认为空。
- v1–v5 备份中的旧分类忽略，活动导入为未分类。
- 备份包含统一分类、年度迁移完成年份、专注定义、累计值和语句，不包含登录状态。
- 备份绝不包含账户名、账户密码哈希、盐、专注密码哈希、壁纸图片或会话状态。
- 导入前显示当前/导入数量、提醒数、暂停数和单次调整数。
- 导入替换活动，不替换账户。
- 导入、编辑、删除、暂停、恢复和恢复点恢复前创建应用内恢复点。
- 最近保留 5 个恢复点，相同内容不重复保存。
- 恢复点只存在应用私有空间，不能防止清除数据、卸载、换机或设备损坏。
- 账户面板记录最近手动导出时间；超过 30 天提示再次导出。
- JSON 手动导出是唯一能离开设备私有空间的活动备份。

## 更新检查

- 仅由用户点击“检查更新”触发，不后台自动检查。
- URL：`https://snow-wind-114.github.io/daily-route/update.json`。
- 必填字段：`versionCode`、`versionName`、`apkUrl`、`releaseUrl`、`notes`。
- 只接受 HTTPS URL。
- 比较 Android `versionCode`，不是字符串版本排序。
- 有新版本时显示说明，并用系统浏览器打开固定 APK 地址。
- 应用不申请 `REQUEST_INSTALL_PACKAGES`。
- Service Worker 不得缓存 `update.json`。
- `scripts/check-versions.mjs` 必须保证 package、Gradle、app.js 和 update.json 版本一致。

## Android 权限

最终权限应仅为：

- `POST_NOTIFICATIONS`
- `RECEIVE_BOOT_COMPLETED`
- `SCHEDULE_EXACT_ALARM`
- `INTERNET`
- 插件需要的 `WAKE_LOCK`
- 提醒振动需要的 `VIBRATE`

不得加入：

- `REQUEST_INSTALL_PACKAGES`
- 精确位置、模糊位置
- 相机、麦克风、通讯录
- 广泛外部存储权限
- 电池优化白名单

专注锁机的 `DailyRouteFocusAccessibilityService` 使用 `BIND_ACCESSIBILITY_SERVICE` 服务声明和 `typeWindowStateChanged`，它不是普通运行时权限，也不得开启窗口内容读取、手势执行或按键过滤。应用清单可通过 `<queries>` 查询启动器应用，但不得扩大为任意包查询或安装应用列表用途。

修改插件后必须检查合并后的 APK 清单，不能只看源 Manifest。

## Android 工程与构建

- 包名：`com.snowwind114.dailyroute`
- `versionCode`：13
- `versionName`：0.6.3
- JDK：`E:\Android\Android Studio\jbr`
- SDK：`C:\Users\Administrator\AppData\Local\Android\Sdk`
- Gradle：8.14.3

```powershell
node scripts\prepare-android-web.mjs
node node_modules\@capacitor\cli\bin\capacitor sync android
```

```powershell
$env:JAVA_HOME = 'E:\Android\Android Studio\jbr'
cd .\android
.\gradlew.bat assembleDebug --no-daemon
.\gradlew.bat assembleRelease --no-daemon
```

如果环境没有 npm，可直接调用上述 Node 入口；不要为了构建把 `node_modules` 或生成资源提交到 Git。

## 签名

长期材料：

```text
android/daily-route-release.jks
android/keystore.properties
```

两者必须被 Git 忽略：

- 不打印、提交或上传密码。
- 用户必须单独安全备份。
- 相同 applicationId 和相同签名才能覆盖升级并保留数据。
- 丢失密钥后通常只能卸载旧版，应用本地数据会丢失。

## 测试策略

自动测试至少覆盖：

- 日期窗口、重复、冲突、截断和删除。
- 自然年截断、年度复制和待办不迁移规则。
- 待办提前 0–30 天提醒、逾期和完成归档。
- 打卡单日去重、历史补打、暂停和归档。
- 打卡每日提醒默认值、成组规则、已打卡/暂停/归档跳过。
- 全局分类、同名去重、跨类型使用和分类删除后的未分类回退。
- 单次调整移动、原日期跳过和提醒身份稳定。
- 暂停不消耗次数、恢复周期和暂停不占用。
- 后续编辑保留匹配调整、丢弃不匹配调整。
- 旧提醒字段迁移、v2–v5 -> v6 存储迁移和旧分类清空。
- 账户哈希、正确/错误密码和改密。
- 备份 v1–v6、v6 分类与专注保留、旧分类丢弃、数量校验和敏感字段缺失。
- 恢复点上限、去重和导出时间。
- 普通通知、原生闹钟 job、并发同步串行化、降级和已过时间跳过。
- 桌面组件年度快照、待办截止和打卡摘要。
- 定期永久删除确认、归档恢复编辑和恢复后自动归档保护。
- 更新清单校验、HTTPS 和版本比较。
- 回顾单日唯一、首次保存冻结、空记录删除、Markdown 内容与跨年恢复点清理。
- 每日回顾普通通知重复计划、开关取消和通知点击跳转。
- 回顾周/月/年范围、空范围、迁移候选、暂停恢复、待办排除和 12 月迁移提醒。
- 三类活动草稿独立存取、删除和过期恢复。
- 专注项目校验、流程引用与时长覆盖、专注/休息累计、密码哈希和暂停会话恢复。
- 专注息屏跨阶段补算、手动暂停/继续、进程恢复、旧 v0.6.1 会话兼容、完成通知安排/取消和视觉 ID 保持。
- 专注每日历史按本地日期合并、去重、完成次数累计、编辑保留和 v6 备份往返。
- 专注密码和壁纸二进制不进入 JSON；壁纸元数据和语句进入 v6。

手动验证：

1. 390 px 附近无横向溢出。
2. 网页无账户和假提醒控件，回顾提醒设置仍隐藏。
3. 回顾今天可保存，历史只读，未保存离开有确认。
4. 本周和活动页月历不能修改打卡，只有今天页可以切换。
5. 日期页回顾按钮打开当前选中日期，顶栏没有重复“+”。
6. 回顾本周、本月、年度导出范围和内容正确。
7. Debug/Release APK 可注册并覆盖升级。
8. 普通通知、精确闹钟、12 月迁移通知和每日回顾通知正常。
9. 测试通知和测试闹钟可发送，每日回顾通知可开启和关闭。
10. 通知点击定位到有效日期、当天回顾或迁移页。
11. 桌面组件可添加、显示、刷新和点击。
12. 重启手机后可恢复尚未发生的提醒。
13. 账号退出后组件清空，重新登录后恢复。
14. JSON 导入预览、恢复点和最近导出提示正常。
15. 安卓无障碍开关、白名单搜索、非白名单拦截、暂停仍锁机、锁屏/权限界面放行和结束后解锁正常。
16. 息屏与切后台继续计时，进程恢复自动补齐，完成通知点击返回专注，暂停/继续后壁纸不消失。
17. 专注运行页白名单入口可启动允许应用；单次项目月历可查看每日记录且没有编辑控件。

## 提交前检查

```powershell
node --test
node scripts\check-versions.mjs
git diff --check
git status
```

发布 APK 前检查：

- 同签名 Release 可覆盖旧版。
- APK 文件名固定为 `daily-route.apk`。
- Release 标签与版本一致。
- `update.json` 指向该版本。
- Pages 和固定 APK URL 返回 `200`。
- `aapt2 dump permissions` 与允许权限列表一致。
- `apksigner verify --verbose --print-certs` 通过。

## 当前已知限制

- 网页和安卓不自动同步。
- 普通通知可能延迟；精确闹钟仍受厂商后台策略、勿扰模式和系统设置影响。
- 专注锁机不是设备管理员级 Kiosk；用户可从系统无障碍设置关闭服务，部分厂商也可能限制后台拉起。
- 单次项目月历从 v0.6.3 开始记录；此前只有累计时间，没有可恢复的逐日历史。
- 主视图固定为当前自然年；下一年度项目通过 12 月迁移提前创建。
- 账户密码不加密活动，不迁移到新手机。
- “每 N 天”仍不支持按星期几或结束日期。
- 只记录待办/打卡完成和归档，不提供用时、图表或统计。
- 不提供云备份、自动外部备份或静默自动更新。
- 闹钟不是全屏闹钟，不绕过勿扰模式。
