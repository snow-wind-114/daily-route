# 每日安排

Daily Route 是一个面向安卓手机的本地日程工具。网页版用于预览、匿名编辑、导出活动和下载 APK；安卓版提供本地账户、普通通知、精确闹钟、桌面组件和更新检查。

- 正式网页：<https://snow-wind-114.github.io/daily-route/>
- 安卓 APK：<https://github.com/snow-wind-114/daily-route/releases/latest/download/daily-route.apk>
- GitHub 仓库：<https://github.com/snow-wind-114/daily-route>

## v0.3 功能

- 今天：00:00–24:00 时间轴，时间精确到分钟，刻度每 30 分钟。
- 本周、本月和活动列表；月历每格代表 2 小时占用。
- 活动支持 1–14 天重复间隔、1–20 次或无限次，不能跨午夜或重叠。
- 编辑重复活动时可选择“只修改这一次”“修改本次及以后”或“暂停整个活动”。
- 单次调整仍属于原活动系列；暂停期间不计占用、不提醒，也不消耗有限次数。
- 安卓提醒分为普通通知和精确闹钟。闹钟需要系统“闹钟和提醒”特殊权限；未授权时会明确降级为普通通知。
- 安卓账户面板提供通知诊断、测试通知、测试闹钟、本地恢复点、JSON 导入导出和更新检查。
- 安卓桌面组件显示今天最多 3 项活动，并标记当前和下一项。

当前正式版本为 `v0.3.1`，修复了 v0.3.0 桌面组件添加到主屏后无法加载的问题。

## 网页版与安卓版

网页版不需要登录，也没有真实系统提醒或桌面组件。网页活动只保存在当前浏览器、当前网址对应的 `localStorage` 中。

安卓版使用独立的应用内存储。网页与安卓不会自动同步；首次迁移时在网页导出 JSON，再在安卓版登录后导入。

安卓应用更新保留账户和活动的前提是：

- 新 APK 使用相同包名 `com.snowwind114.dailyroute`。
- 新 APK 使用同一 release keystore 签名。
- 新 APK 的 `versionCode` 高于已安装版本。

## 本地运行网页

```powershell
node .\serve.mjs
```

打开 `http://localhost:4173`。

## 安装和更新安卓版

1. 用安卓浏览器打开正式网页并下载 APK。
2. 首次安装时允许当前浏览器“安装未知来源应用”。
3. 安卓 13 及以上会在首次启用提醒时请求通知权限。
4. 首次选择“闹钟”时还会打开“闹钟和提醒”特殊权限设置。
5. 后续在应用账户面板点“检查更新”，再通过系统浏览器下载并覆盖安装。

应用本身不申请“安装未知应用”权限，也不会静默安装。

## 提醒与权限

普通通知允许系统延迟。精确闹钟使用 `setExactAndAllowWhileIdle` 路径，但仍可能受到厂商后台策略、勿扰模式和系统限制影响。

APK 权限范围：

- `POST_NOTIFICATIONS`：显示本地通知。
- `RECEIVE_BOOT_COMPLETED`：重启后恢复尚未发生的提醒。
- `SCHEDULE_EXACT_ALARM`：用户选择闹钟提醒时使用的特殊权限。
- `INTERNET`：仅在用户主动检查更新时访问 GitHub Pages 版本清单。
- `WAKE_LOCK` 和 `VIBRATE`：本地提醒与振动所需的普通权限。

不申请位置、相机、通讯录、麦克风、广泛文件存储、电池优化白名单或应用安装权限。

## 构建

需要 Node.js、Android Studio、Android SDK Platform 36、Build Tools 36.1 和 JDK 21。

```powershell
npm install
npm test
npm run check
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

## 签名与发布

长期签名材料：

```text
android/daily-route-release.jks
android/keystore.properties
```

两者都被 Git 忽略。请单独备份；丢失后无法覆盖升级，通常只能卸载重装并丢失应用本地数据。

Release APK 必须命名为 `daily-route.apk` 并上传到最新 GitHub Release。网页固定下载地址依赖该资产名。

版本发布前必须同步：

- `package.json`
- `android/app/build.gradle`
- `app.js` 中的 `APP_VERSION` 和 `APP_VERSION_CODE`
- `update.json`

`npm run check` 会阻止这些版本号不一致。

## 数据与恢复

- 安卓账户密码使用 PBKDF2 哈希，活动内容本身不加密。
- 网页备份和安卓备份只包含活动，不包含账户名、密码哈希或盐。
- 安卓自动保留最近 5 个应用内恢复点，但清除数据、卸载、换机或设备损坏后不会保留。
- JSON 手动导出是唯一能离开应用私有空间的活动备份方式。
- 换机流程：新手机注册本地账户，再导入此前导出的 JSON；账户密码不迁移。

## 测试

```powershell
node --test
node scripts\check-versions.mjs
git diff --check
```

发布前手动检查：

1. 390 px 附近手机宽度无横向溢出。
2. 网页可匿名编辑、单次调整、暂停、导出和下载 APK。
3. Debug APK 可注册、重启保持登录、添加提醒和打开恢复点。
4. 普通通知和闹钟权限流程可见；拒绝闹钟权限时明确降级。
5. 桌面组件可添加、显示今天活动并点击进入对应日期。
6. 相同签名的新 Release 覆盖安装后账户、登录状态和活动均保留。

部署细节见 [GITHUB_PAGES.md](./GITHUB_PAGES.md)。
