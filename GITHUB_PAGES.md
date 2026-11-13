# GitHub Pages 发布步骤

应用本身是静态 PWA，不需要数据库或后台服务器。GitHub Pages 只负责保存和提供网页文件；活动数据仍然只保存在手机浏览器里。

## 1. 创建 GitHub 仓库

1. 登录 GitHub。
2. 新建一个仓库，建议名称：`daily-route`。
3. 可见性选择 `Public`，这样免费账户可以直接使用 GitHub Pages。
4. 不要勾选自动创建 README、`.gitignore` 或许可证。

创建后，仓库地址类似：

```text
https://github.com/你的用户名/daily-route.git
```

## 2. 推送本地项目

在项目目录运行，把下面地址替换成你的实际仓库地址：

```powershell
git remote add origin https://github.com/你的用户名/daily-route.git
git push -u origin main
```

第一次推送时，Git 会要求登录 GitHub。请在浏览器完成登录授权，不要把密码或令牌发给我。

## 3. 启用 GitHub Pages

1. 打开仓库的 `Settings`。
2. 进入左侧 `Pages`。
3. 在 `Build and deployment` 的 `Source` 中选择 `GitHub Actions`。
4. 打开仓库的 `Actions` 页面，等待 `Deploy Daily Route to GitHub Pages` 完成。

发布后的网址通常是：

```text
https://你的用户名.github.io/daily-route/
```

## 4. 安装到安卓手机

1. 使用安卓 Chrome 打开发布网址。
2. 等页面完整加载一次。
3. 打开 Chrome 菜单，选择“安装应用”或“添加到主屏幕”。
4. 安装后关闭网络，确认应用仍能打开和编辑。

## 后续更新

以后修改代码后，在项目目录运行：

```powershell
git add .
git commit -m "更新应用"
git push
```

GitHub Actions 会自动重新发布。不要修改仓库名称或 Pages 地址，否则手机会把新网址当成另一份应用数据。
