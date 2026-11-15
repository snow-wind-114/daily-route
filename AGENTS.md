# Daily Route Project Guide

> 项目级说明。本文件优先于 `D:\agent project\AGENTS.md` 的通用规则。

## 版本与发布地址

- 当前版本：`v0.3.1`
- Android：`versionCode=4`、`versionName=0.3.1`
- 版本日期：`2026-11-15`
- 网页：<https://snow-wind-114.github.io/daily-route/>
- 固定 APK：
  <https://github.com/snow-wind-114/daily-route/releases/latest/download/daily-route.apk>
- 更新清单：
  <https://snow-wind-114.github.io/daily-route/update.json>
- 仓库：<https://github.com/snow-wind-114/daily-route>

### 版本规则

每次提交 GitHub 时，必须在同一提交更新本文件。

- 文档修正、兼容性 bugfix、内部重构：`v0.3.2`、`v0.3.3`……
- 新增用户可见功能、数据结构或重要交互：`v0.4`、`v0.5`……
- 正式稳定版或不兼容的数据/URL 变化：`v1.0`、`v2.0`……
- 每个提交至少更新“当前版本”“版本日期”“最近变更”和“最近验证”。

### 最近变更

| 版本 | 日期 | 内容 |
|---|---|---|
| `v0.3.1` | 2026-11-15 | 修复桌面组件使用 RemoteViews 不允许的 `<View>` 导致主屏加载失败 |
| `v0.3` | 2026-11-15 | 普通通知/精确闹钟、单次调整、系列暂停、桌面组件、恢复点、更新检查和 v3 存储迁移 |
| `v0.2` | 2026-11-15 | 安卓本地账户、基础非精确提醒、活动导入导出、APK 下载 |
| `v0.1` | 2026-11-15 | 离线日程 MVP、GitHub Pages 与项目指南 |

### 最近验证

- `node --test`：36 项通过。
- `node --check` 与统一版本检查：通过。
- Android Debug 构建：通过。
- Android Release 构建：通过，`versionCode=4`、`versionName=0.3.1`。
- Release APK：v2 签名通过，证书 SHA-256 与 v0.2 一致。
- Release 权限：INTERNET、VIBRATE、RECEIVE_BOOT_COMPLETED、WAKE_LOCK、POST_NOTIFICATIONS、SCHEDULE_EXACT_ALARM。
- Android 模拟器：v0.2 覆盖升级到 v0.3 后账户、登录状态和活动保留。
- Android 模拟器：普通活动提醒在后台按提前 5 分钟送达；通知渠道和高优先级闹钟渠道已创建。
- Android 模拟器：账户面板、通知/闹钟权限状态、恢复点和更新入口可加载。
- Android 系统：桌面组件已实际拖放到启动器，能显示日期、当天活动和“进行中”标记。
- 安卓 Chrome 手机视口：网页四个底部入口、预览提示和编辑弹窗无横向溢出；网页不显示提醒控件。

## 产品边界

Daily Route 是单用户、本地优先、未来六个月范围的活动安排工具。

网页版：

- 匿名使用。
- 可新增、编辑、单次调整、修改后续和暂停活动。
- 数据只保存在当前浏览器、当前网址对应的 `localStorage`。
- 可导出 JSON 和下载 APK。
- 不提供账户、真实系统提醒、桌面组件或更新检查。

安卓版：

- 使用本地单账户，是长期主入口。
- 支持普通通知、精确闹钟、桌面组件、本地恢复点和 JSON 导入导出。
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
- Android 插件：App、Browser、Local Notifications、Filesystem、Share。
- 测试：Node.js 内置 `node:test`。

```text
index.html
  -> app.js（组合根、界面、账户、备份、更新和交互）
      -> schedule.js（重复、暂停、单次调整、冲突等领域规则）
      -> date-utils.js（日期时间纯函数）
      -> account.js（PBKDF2 账户）
      -> app-state.js（网页/安卓存储与 v2 -> v3 迁移）
      -> backup.js（备份格式与摘要）
      -> recovery.js（最近 5 个恢复点和导出时间）
      -> notifications.js（通知/闹钟计划与 Capacitor 适配）
      -> native-widget.js（六个月内发生快照和组件点击）
      -> update-check.js（update.json 校验和版本比较）
      -> native-files.js（安卓分享）
      -> localStorage

scripts/prepare-android-web.mjs
  -> 复制网页资源到 www/
  -> esbuild 打包 scripts/native-entry.js 为 native-bridge.js

android/
  -> Capacitor Android 工程
  -> DailyRouteWidgetPlugin（JS 到 SharedPreferences）
  -> DailyRouteWidgetProvider（RemoteViews 4×2 组件）
  -> Gradle 生成 Debug/Release APK
```

## 网页与安卓存储

网页键保持不变：

```text
daily-route.storage.v1
```

网页活动 payload 版本升级为 2，但存储键和网址不得改变。读取时兼容旧活动，并补充：

```js
{
  reminderMode: "none",
  reminderMinutesBefore: 5,
  occurrenceOverrides: [],
  pauses: []
}
```

安卓新键：

```text
daily-route.storage.v3
```

旧键：

```text
daily-route.storage.v2
```

启动时先读 v3；不存在时读取 v2，归一化后写入 v3。为兼容恢复，v2 原始键暂时保留但不再作为事实来源。不得删除或改名 v3 键，除非同时实现明确迁移。

网页与安卓是不同 origin、不同数据空间。迁移路径只有：

```text
网页导出 JSON -> 安卓登录后导入
```

## 活动数据

单个活动系列：

```js
{
  id: "uuid",
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

约束：

- `repeatEvery`：1–14 天。
- `repeatCount`：1–20 个活跃发生，`null` 表示无限。
- `reminderMode`：`none`、`notification` 或 `alarm`。
- `reminderMinutesBefore`：0–1440；新活动默认 5 分钟。
- 活动不能跨午夜。
- 未来半年内活动时间不能重叠，首尾相接允许。

所有读取必须经过 `normalizeSeries()`。旧 `reminderEnabled: true/false` 分别迁移为普通通知/不提醒。

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
- 原 `occurrenceDate` 被替换，有效日期可以移动到未来半年内其他日期。
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

删除仍表示“删除本次及以后”：

- 第一次发生：删除整个系列。
- 中间发生：设置 `endBefore` 并删除边界后的调整。
- 已结束或暂停系列可从活动栏整体删除。

## 冲突

冲突条件：

```text
newStart < existingEnd && newEnd > existingStart
```

- `findScheduleConflict()` 用于表单候选和当前未来半年窗口。
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

普通通知：

```js
isExactNotification: false
allowWhileIdle: false
```

精确闹钟：

```js
isExactNotification: true
isExactMandatory: true
allowWhileIdle: true
```

规则：

- 普通通知使用 `daily-route-notifications-v1` 渠道。
- 闹钟使用 `daily-route-alarms-v1` 高优先级渠道、独立声音和振动。
- 闹钟不是全屏 Activity。
- 首次选择闹钟时先请求通知权限，再请求“闹钟和提醒”特殊权限。
- 精确权限被拒绝时允许保存，但必须降级为普通通知，并在界面明确标注。
- 每次发生只安排一次。
- 只调度未来半年内、提醒时间尚未过去的发生。
- 登录、冷启动、应用恢复、新增、编辑、暂停、恢复、导入和删除后重新同步。
- 权限不足时必须取消旧的待发送提醒，不能保留过期计划。
- 通知点击 extra 使用 `seriesId`、原始 `occurrenceDate` 和有效 `effectiveDate`。

账户面板应显示通知权限、精确闹钟权限、已安排数量和降级数量，并提供测试通知和测试闹钟。

## 桌面组件

- 原生类：`DailyRouteWidgetProvider`。
- JS 原生桥：`DailyRouteWidgetPlugin`。
- 尺寸：目标 4×2，最多显示今天前 3 项。
- 显示当前项和下一项标记；超过 3 项显示剩余数量。
- 点击活动打开应用对应有效日期。
- JS 通过 `native-widget.js` 生成未来六个月按日期索引的发生快照。
- 快照写入应用私有 `SharedPreferences`，组件不得直接读取 WebView `localStorage`。
- 保存、登录、导入、暂停、恢复、应用恢复和日期变化后刷新。
- 退出登录或重置账户时清除组件快照。

## 备份与恢复

外部备份格式仍为：

```json
{
  "format": "daily-route-backup",
  "version": 2,
  "appVersion": "0.3.0",
  "exportedAt": "ISO timestamp",
  "eventCount": 0,
  "events": []
}
```

规则：

- 新导出使用版本 2。
- 解析器继续接受版本 1。
- 备份绝不包含账户名、密码哈希、盐或会话状态。
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

修改插件后必须检查合并后的 APK 清单，不能只看源 Manifest。

## Android 工程与构建

- 包名：`com.snowwind114.dailyroute`
- `versionCode`：4
- `versionName`：0.3.1
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
- 单次调整移动、原日期跳过和提醒身份稳定。
- 暂停不消耗次数、恢复周期和暂停不占用。
- 后续编辑保留匹配调整、丢弃不匹配调整。
- 旧提醒字段迁移和 v2 -> v3 存储迁移。
- 账户哈希、正确/错误密码和改密。
- 备份 v1/v2、数量校验和敏感字段缺失。
- 恢复点上限、去重和导出时间。
- 普通通知/闹钟计划、已过时间和暂停活动跳过。
- 桌面组件六个月内发生快照。
- 更新清单校验、HTTPS 和版本比较。

手动验证：

1. 390 px 附近无横向溢出。
2. 网页无账户和假提醒控件。
3. Debug/Release APK 可注册并覆盖升级。
4. 普通通知、精确闹钟、拒绝权限后的降级均可观察。
5. 测试通知和测试闹钟可发送。
6. 通知点击定位到有效日期。
7. 桌面组件可添加、显示、刷新和点击。
8. 重启手机后可恢复尚未发生的提醒。
9. 账号退出后组件清空，重新登录后恢复。
10. JSON 导入预览、恢复点和最近导出提示正常。

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
- 桌面组件和提醒最多基于未来六个月快照；长期未打开应用后需要重新打开刷新。
- 账户密码不加密活动，不迁移到新手机。
- “每 N 天”仍不支持按星期几或结束日期。
- 不记录实际完成情况、历史、用时或统计。
- 不提供云备份、自动外部备份或静默自动更新。
- 闹钟不是全屏闹钟，不绕过勿扰模式。
