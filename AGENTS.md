# Daily Route Project Guide

> 项目级说明。本文件优先于 `D:\agent project\AGENTS.md` 的通用规则。

## 版本与状态

- 当前版本：`v0.2`
- 版本日期：`2026-11-15`
- 状态：网页版稳定；安卓版可构建、可安装，等待真机通知验收
- 网页：<https://snow-wind-114.github.io/daily-route/>
- APK 固定地址：
  <https://github.com/snow-wind-114/daily-route/releases/latest/download/daily-route.apk>
- 仓库：<https://github.com/snow-wind-114/daily-route>

### 版本规则

每次提交 GitHub 时，必须在同一提交中更新本文件。

- 文档修正、兼容性 bugfix、内部重构：`v0.2.1`、`v0.2.2`……
- 新增用户可见功能、数据结构或重要交互：`v0.3`、`v0.4`……
- 正式稳定版或不兼容的数据/URL 变化：`v1.0`、`v2.0`……
- 每个提交至少更新“当前版本”“版本日期”“最近变更”和“最近验证”。

### 最近变更

| 版本 | 日期 | 内容 |
|---|---|---|
| `v0.2` | 2026-11-15 | 网页增加 APK 下载与活动导出；新增安卓本地账户、活动导入导出和非精确本地提醒 |
| `v0.1` | 2026-11-15 | 建立离线日程 MVP、项目指南与 GitHub Pages 发布流程 |

### 最近验证

- `node --test`：21 项测试通过。
- `node --check`：网页、账户、备份、提醒和领域模块语法通过。
- 网页 390 px：无登录/提醒控件，APK 下载按钮和 JSON 导出可用。
- 网页断网重载：离线 Service Worker 成功恢复应用壳。
- Android Debug/Release：Gradle 构建成功。
- Android `testDebugUnitTest`：通过。
- Release APK：v2 签名验证通过，`versionCode=2`，`versionName=0.2.0`。
- Release APK 权限：仅 `POST_NOTIFICATIONS`、`RECEIVE_BOOT_COMPLETED` 和 Android 自动生成的动态接收器权限。
- Android 16 模拟器：APK 可安装、注册页可加载、账户在应用重启后保留。
- Android 16 模拟器：非精确提醒成功进入待发送队列，并在应用切到后台后送达通知栏。
- Android 16 模拟器：备份可写入应用缓存并调起系统分享面板。
- 尚未完成：真实安卓手机的通知准时性、通知点击和重启恢复验收。

## 产品边界

Daily Route 是单用户、本地优先的未来活动安排工具。

网页版：

- 匿名使用，不提供账户和提醒。
- 数据只保存在当前浏览器、当前网址对应的 `localStorage`。
- 可导出 JSON，用于迁移到安卓版或手工备份。
- 显式提供安卓 APK 下载入口。

安卓版：

- 使用本地单账户。
- 首次注册后保持登录；主动退出或重置后才需要重新验证。
- 使用系统本地通知，不依赖后端。
- 可导入/导出活动；导入使用系统文件选择器，导出使用系统分享面板。
- 是长期使用的主入口，但不自动更新。

始终不使用：

- 后端、云数据库、云同步、多设备同步。
- 登录服务器、第三方账号或密码找回服务。
- 统计、追踪、广告或第三方 API。
- 精确闹钟、电池优化白名单、位置、相机、通讯录、麦克风和广泛文件权限。

## 技术栈

- 原生 HTML、CSS、JavaScript ES Modules。
- Node.js 24、npm 12。
- Capacitor 8.6、Android Gradle Plugin 8.13。
- Android compileSdk/targetSdk 36，minSdk 24。
- PWA：Manifest + Service Worker。
- 安卓插件：Local Notifications、Filesystem、Share。
- 测试：Node.js 内置 `node:test`。

工作区分层：

```text
index.html
  -> app.js（组合根、界面状态、交互流程）
      -> schedule.js（活动领域规则）
      -> date-utils.js（日期和时间纯函数）
      -> account.js（密码哈希与校验）
      -> app-state.js（网页/安卓存储边界）
      -> backup.js（备份格式）
      -> notifications.js（提醒计划和 Capacitor 适配）
      -> native-files.js（安卓文件分享）
      -> localStorage

scripts/prepare-android-web.mjs
  -> 复制网页资源到 www/
  -> 用 esbuild 打包 native-entry.js 为 native-bridge.js
  -> 生成仅供 Capacitor 使用的 www/index.html

android/
  -> Capacitor Android 工程
  -> www/ 资源同步到 app/src/main/assets/public
  -> Gradle 生成 Debug/Release APK
```

## 网页与安卓存储

网页存储键保持：

```text
daily-route.storage.v1
```

网页结构继续为：

```json
{
  "version": 1,
  "events": []
}
```

安卓存储键：

```text
daily-route.storage.v2
```

安卓结构：

```json
{
  "version": 2,
  "account": {
    "username": "账户名",
    "passwordHash": "base64",
    "passwordSalt": "base64",
    "passwordIterations": 210000,
    "createdAt": "ISO timestamp"
  },
  "sessionActive": true,
  "events": []
}
```

网页和安卓是不同 origin、不同数据空间，不存在自动同步。不要把网页数据迁移误写成同步；迁移路径只有：

```text
网页导出 JSON -> 安卓登录后导入 JSON
```

`android/.gitignore` 忽略复制到原生工程中的 Web 资源和生成配置。源文件始终位于仓库根目录。

## 账户与安全

- 账户名 2–64 字符。
- 密码 6–64 字符。
- 每个账户使用 16 字节随机盐。
- 密码使用 Web Crypto PBKDF2-HMAC-SHA256，迭代 210,000 次，派生 256 位哈希。
- 只保存 Base64 哈希和盐，不保存明文密码。
- 登录状态由 `sessionActive` 保持；它不是加密密钥。
- 活动内容仍是本地明文。不要声称账户系统能防御设备控制者、root、调试工具或应用数据提取。
- 忘记密码没有找回服务。登录页的“重置本地账户”会清空账户和活动，必须先提示使用备份。
- 正常账户面板不提供删除账户入口。
- 修改密码需要验证当前密码。

账户逻辑在 `account.js`，存储归一化在 `app-state.js`。不得把密码哈希逻辑复制到 DOM 事件中。

## 活动数据

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
  reminderEnabled: false,
  reminderMinutesBefore: 5,
  endBefore: null,
  createdAt: "ISO timestamp",
  updatedAt: "ISO timestamp"
}
```

约束：

- `repeatEvery`：1–14 天。
- `repeatCount`：1–20，包含第一次；`null` 表示无限。
- `reminderEnabled`：默认 `false`。
- `reminderMinutesBefore`：0–1440 分钟；0 表示开始时提醒。
- 活动不能跨午夜。
- 未来半年内活动时间不能重叠，首尾相接允许。

所有读取都必须经过 `normalizeSeries()`。旧活动或旧备份缺少提醒字段时，归一化为“不提醒、提前 5 分钟”。

## 重复、编辑和删除

活动系列每 `repeatEvery` 天发生一次，第一次计入 `repeatCount`。

编辑或删除某个发生日期时：

- 第一次发生：修改或删除整个系列。
- 中间发生：原系列用 `endBefore` 截断，从所选日期创建新系列或只截断删除。
- 无限系列在查询时按范围计算，禁止展开成无限数组。

相关逻辑位于 `schedule.js`。不要改变为“只修改单次”，除非用户明确要求。

## 冲突

`findScheduleConflict()` 验证普通表单保存。
`findConflictWithinRange()` 验证导入备份。

冲突条件：

```text
newStart < existingEnd && newEnd > existingStart
```

冲突保证只覆盖当前未来半年窗口。不要对外声称已完成半年以外的验证。

## 备份

备份模块为 `backup.js`：

```json
{
  "format": "daily-route-backup",
  "version": 1,
  "appVersion": "0.2.0",
  "exportedAt": "ISO timestamp",
  "eventCount": 1,
  "events": []
}
```

规则：

- 不包含账户、密码哈希、盐或会话状态。
- 导入前显示活动数量并确认。
- 导入替换当前活动，不替换账户。
- 导入活动必须全部可归一化，且未来半年内不能重叠。
- 导入后重新同步提醒。

## 提醒

提醒只在安卓端显示和执行。

- 新活动默认关闭提醒。
- 开启时默认提前 5 分钟，可改为 0–1440。
- 每次发生只安排一次通知。
- 同一系列的未来发生共用同一提醒设置。
- 只调度当前未来半年内、提醒时间尚未过去的 occurrence。
- 使用稳定 31 位整数 ID，避免重新同步产生重复。
- 通知 extra 包含 `kind`、`seriesId`、`occurrenceDate`。
- 点击通知进入对应日期并滚动到活动。

同步触发点：

- 登录、冷启动、应用恢复。
- 新增、编辑、删除活动。
- 导入备份。
- 提醒开关或时间变更。

Capacitor 8.3 默认尝试精确提醒并可能打开“闹钟和提醒”设置。本项目必须为每个提醒显式设置：

```js
isExactNotification: false
```

这是“不申请精确闹钟权限”的实现前提，不要删除。

权限不足时允许保存活动，但界面必须说明提醒可能无法送达。安卓系统仍可能延迟非精确提醒几分钟。

## Android 工程

- 应用 ID：`com.snowwind114.dailyroute`
- 应用名：每日安排
- `versionCode`：2
- `versionName`：0.2.0
- Capacitor webDir：`www`
- 本地 SDK：`C:\Users\Administrator\AppData\Local\Android\Sdk`
- JDK：`E:\Android\Android Studio\jbr`
- Gradle：8.14.3
- Maven 镜像：阿里云 Google/Public/Gradle Plugin
- 安卓图标和启动图由 `scripts/generate-android-icons.ps1` 从 `icons/icon-512.png` 生成。

最终权限策略：

- 保留 `POST_NOTIFICATIONS`。
- 保留 `RECEIVE_BOOT_COMPLETED`。
- 移除 `SCHEDULE_EXACT_ALARM`。
- 移除 `WAKE_LOCK`。
- 移除 `INTERNET`。
- 关闭 Android 系统备份。

修改插件或 Capacitor 版本后，必须重新检查合并后的 APK 清单，不能只看源 Manifest。

## 构建命令

安装与静态检查：

```powershell
npm install
npm test
npm run check
```

同步网页资源到 Android：

```powershell
npm run cap:sync
```

构建 APK：

```powershell
$env:JAVA_HOME = 'E:\Android\Android Studio\jbr'
cd .\android
.\gradlew.bat assembleDebug --no-daemon
.\gradlew.bat assembleRelease --no-daemon
```

输出：

```text
android/app/build/outputs/apk/debug/app-debug.apk
android/app/build/outputs/apk/release/app-release.apk
```

## 签名

长期 release 签名材料：

```text
android/daily-route-release.jks
android/keystore.properties
```

两者均被 Git 忽略：

- 不要打印、提交或上传密码。
- 用户必须单独备份这两个文件。
- 相同 `applicationId` 且相同签名才能覆盖升级并保留应用数据。
- 更换签名后，旧 APK 必须卸载，应用数据会丢失。

## 测试策略

自动测试覆盖：

- 日期窗口、重复、冲突、系列拆分和删除。
- PBKDF2 注册、正确/错误密码、修改密码。
- 安卓 v2 存储归一化、空数据和损坏数据。
- 备份往返、数量校验和敏感字段缺失。
- 提醒日期计算、已过提醒跳过和关闭提醒。
- 导入冲突检查。

手动验证：

1. 390 px 手机宽度无横向溢出。
2. 网页不出现账户和提醒控件。
3. 网页可下载 APK、导出 JSON、编辑活动。
4. Debug APK 注册、重启保持登录、添加提醒活动。
5. 系统待发送队列中存在本地通知。
6. 关闭应用后收到通知，点击后定位到活动。
7. 备份分享面板可打开，JSON 可重新导入。
8. 相同签名的新 Release 可以覆盖安装并保留账户与活动。
9. 重启手机后提醒可恢复。

## GitHub Pages 与 Release

- 网页从 `main` 根目录发布，Pages 配置保持 `Deploy from a branch`、`main`、`/(root)`。
- APK 作为 GitHub Release 资产发布，固定文件名必须为 `daily-route.apk`。
- 网页下载链接依赖 GitHub 的 `releases/latest/download/daily-route.apk`。
- 不自动更新 APK；用户从网页重新下载覆盖安装。
- 不改变仓库名、Pages 路径或应用 ID，除非同时说明数据影响。

## 提交前检查

```powershell
npm test
npm run check
git diff --check
git status
```

发布 APK 前还需：

```powershell
npm run cap:sync
$env:JAVA_HOME = 'E:\Android\Android Studio\jbr'
cd .\android
.\gradlew.bat assembleRelease --no-daemon
```

并检查：

- `aapt2 dump permissions` 只显示允许的权限。
- `apksigner verify --verbose --print-certs` 通过。
- 不提交 `www/`、`node_modules/`、Gradle 构建产物、keystore 或 `keystore.properties`。

## 当前已知限制

- 网页版不登录、不提醒，也不与安卓版同步。
- 安卓版通知为非精确调度，可能延迟。
- 提醒最多调度当前未来半年内的 occurrence；半年之后需要重新打开应用扩展窗口。
- 不记录完成状态、历史或实际用时。
- 不能只跳过某一次发生。
- 重复模型只有“每 N 天”，没有“每周几”。
- 月历占用精度为 2 小时。
- 活动备注在主要浏览视图中不可见。
- 账户密码不加密活动内容。
- 尚未在真实手机完成通知、点击、重启恢复和覆盖升级验收。
