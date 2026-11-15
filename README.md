# 每日安排

Daily Route 是一个面向安卓手机的本地日程工具。网页版保持匿名使用，安卓版提供本地账户、系统提醒和 JSON 活动备份。

- 正式网页：<https://snow-wind-114.github.io/daily-route/>
- 安卓 APK：<https://github.com/snow-wind-114/daily-route/releases/latest/download/daily-route.apk>
- GitHub 仓库：<https://github.com/snow-wind-114/daily-route>

## 主要功能

- 今天：00:00–24:00 时间轴，时间精确到分钟，刻度每 30 分钟。
- 本周：按天查看活动。
- 本月：每天用 12 个刻度表示占用情况，每格代表 2 小时。
- 活动：搜索、按最近发生日期排序、编辑进行中活动和删除已结束活动。
- 活动支持 1–14 天重复间隔，1–20 次或无限次，且不能跨午夜或互相重叠。
- 安卓版支持本地账户、保持登录、修改密码和活动提醒。

## 网页版与安卓版的区别

网页版不需要登录，也不提供提醒。网页数据只保存在当前浏览器、当前网址对应的本地存储中。

安卓版使用独立的应用内存储，支持本地账户和系统提醒。网页版和安卓版不会自动同步；首次迁移时，在网页版导出 JSON，再到安卓版“账户与数据”中导入。

## 本地运行网页

```powershell
node .\serve.mjs
```

打开 `http://localhost:4173`。手机尺寸可用浏览器开发者工具检查。

## 安装安卓版

1. 用安卓浏览器打开发布网页并下载 APK。
2. 按系统提示允许当前浏览器“安装未知来源应用”。
3. 安装后打开“每日安排”，创建本地账户。
4. 如需迁移网页活动，先在网页版右上角导出活动，再在安卓版账户面板导入。

安卓版不自动更新。后续版本需要从同一 GitHub Release 地址重新下载并覆盖安装。

## 开发与构建

需要：

- Node.js LTS（包含 npm）
- Android Studio 2025.1 或兼容版本
- Android SDK Platform 36、Build Tools 36.1.0、Platform Tools
- JDK 21。本项目可使用 Android Studio 自带 JBR：
  `E:\Android\Android Studio\jbr`

安装依赖并检查：

```powershell
npm install
npm test
npm run check
```

同步网页资源到 Android：

```powershell
npm run cap:sync
```

构建 Debug APK：

```powershell
$env:JAVA_HOME = 'E:\Android\Android Studio\jbr'
cd .\android
.\gradlew.bat assembleDebug --no-daemon
```

构建 Release APK：

```powershell
$env:JAVA_HOME = 'E:\Android\Android Studio\jbr'
cd .\android
.\gradlew.bat assembleRelease --no-daemon
```

Debug APK：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Release APK：

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 签名与更新

正式 APK 使用稳定 release keystore。密钥和密码位于：

```text
android/daily-route-release.jks
android/keystore.properties
```

这两个文件已被 Git 忽略，不能上传到 GitHub。请把两份文件备份到安全位置；丢失密钥后无法继续覆盖安装新版本。相同包名 `com.snowwind114.dailyroute` 和使用同一签名的 APK 才能覆盖升级并保留账户与活动。

## 安卓权限

最终 APK 只声明：

- `POST_NOTIFICATIONS`：用户首次开启活动提醒时请求。
- `RECEIVE_BOOT_COMPLETED`：设备重启后恢复尚未发生的提醒。

应用不申请精确闹钟、电池优化白名单、网络、位置、相机、通讯录、麦克风或广泛文件存储权限。通知使用非精确调度，安卓系统可能延迟几分钟。

## 数据与恢复

- 安卓账户只存在当前安装中，密码使用 PBKDF2 哈希保存，活动内容本身不加密。
- 清除应用数据、卸载应用、设备故障或丢失签名密钥都可能导致数据无法恢复。
- 忘记密码只能通过“重置本地账户”重新注册，再导入此前导出的活动备份。
- 备份 JSON 只包含活动，不包含账户名或密码。
- 网页版和安卓版是两个独立数据空间，不会自动合并。

## 测试

```powershell
npm test
npm run check
git diff --check
```

发布前还应检查：

1. 390 px 左右手机宽度无横向溢出。
2. 网页版没有登录或提醒控件，APK 下载和 JSON 导出可用。
3. Debug APK 可安装，注册、登录、导入、提醒和密码修改可用。
4. Release APK 通过覆盖安装保留账户与活动。
5. 最终 APK 权限只剩通知和开机恢复。

GitHub Pages 发布细节见 [GITHUB_PAGES.md](./GITHUB_PAGES.md)。
