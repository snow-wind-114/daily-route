# 网页与 APK 发布

GitHub Pages 负责提供静态网页，GitHub Releases 负责提供安卓 APK。两者都不保存用户账户或活动数据。

## 正式地址

- 网页：<https://snow-wind-114.github.io/daily-route/>
- APK 固定下载地址：
  <https://github.com/snow-wind-114/daily-route/releases/latest/download/daily-route.apk>

网页把下载按钮指向最后的固定地址。因此每个正式 Release 都必须包含名为 `daily-route.apk` 的资产。

网页根目录的 `update.json` 是安卓应用主动检查更新时读取的版本清单。它不缓存于 Service Worker，并且必须与 APK 的实际 `versionCode` 和 `versionName` 一致。

## 网页发布

仓库 Settings → Pages 应保持：

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/(root)`

推送 `main` 后 GitHub Pages 会自动发布。不要修改仓库名或 Pages 路径，否则浏览器会把新地址当成新的数据空间，原有网页活动不会自动迁移。

## 构建正式 APK

先同步网页资源和插件：

```powershell
npm install
npm run cap:sync
```

再构建：

```powershell
$env:JAVA_HOME = 'E:\Android\Android Studio\jbr'
cd .\android
.\gradlew.bat assembleRelease --no-daemon
```

构建结果：

```text
android/app/build/outputs/apk/release/app-release.apk
```

签名材料必须位于被 Git 忽略的：

```text
android/daily-route-release.jks
android/keystore.properties
```

不要把密钥或密码放进仓库、Issue 或 Release。

## 创建 GitHub Release

1. 把 APK 重命名为 `daily-route.apk`。
2. 在 GitHub 仓库打开 Releases → Draft a new release。
3. 标签使用与 `package.json` 一致的版本，例如 `v0.3.0`，并标记为 Latest。
4. 上传 `daily-route.apk`。
5. 在说明中写明版本、安装未知来源提示、备份提醒和 SHA-256。
6. 发布后检查固定下载地址返回 APK。
7. 确认 `https://snow-wind-114.github.io/daily-route/update.json` 可访问且内容为最新版本。

PowerShell 计算校验值：

```powershell
Get-FileHash .\daily-route.apk -Algorithm SHA256
```

## 发布后验证

```powershell
Invoke-WebRequest -Uri 'https://snow-wind-114.github.io/daily-route/' -UseBasicParsing
Invoke-WebRequest -Uri 'https://github.com/snow-wind-114/daily-route/releases/latest/download/daily-route.apk' -UseBasicParsing
Invoke-WebRequest -Uri 'https://snow-wind-114.github.io/daily-route/update.json' -UseBasicParsing
```

再使用同一稳定签名构建一个更高 `versionCode` 的 APK，覆盖安装并确认账户、登录状态和活动均保留。

应用只发起用户主动触发的更新检查。GitHub Pages 仍只承载静态文件，不保存账户或活动。
