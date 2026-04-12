# U-Plus-Lite 发版指南

## 目标

当前发布链路是“本地手工发版 + GitHub Release 安装包”：

1. 本地提升版本号并打 tag
2. 本地构建应用并生成 release 包
3. 本地把 release 包上传到 GitHub Release
4. 部署脚本从 GitHub Release 下载对应安装包

## 前提

- 已安装 `gh`
- 已完成 `gh auth login`
- 本地工作区处于可发版状态
- Node.js 18+

## 推荐流程

### 1. 更新版本号并创建 tag

```bash
npm run release
```

这一步会：
- 更新 `package.json` 版本号
- 生成或更新 `CHANGELOG.md`
- 创建新的 git commit
- 创建新的 tag，例如 `v1.2.2`

### 2. 构建并打包 release 资产

```bash
npm run package:release
```

这一步会：
- 执行 `npm install`
- 执行 `npm run build`
- 生成 release 包到 `dist/release/`

产物包括：
- `u-plus-lite-v<version>-macos-linux.tar.gz`
- `u-plus-lite-v<version>-windows.zip`（如果本机有 `zip`）
- `u-plus-lite-v<version>-checksums.txt`

## 3. 上传到 GitHub Release

```bash
npm run publish:release
```

脚本会：
- 检查 `gh` 登录状态
- 检查本地 tag 是否存在
- 如果同名 release 已存在，则覆盖上传 assets
- 如果同名 release 不存在，则新建 release 并上传 assets

## 常见检查项

发版前建议确认：

- `npm run build` 可以成功
- `dist/release/` 中有本次版本对应的文件
- `u-plus-lite-v<version>-checksums.txt` 已生成
- GitHub Release 页面上能看到 tar.gz / zip / checksums 资产

## 部署脚本依赖的资产命名

当前部署脚本会查找固定命名：

- macOS / Linux:
  - `u-plus-lite-v<version>-macos-linux.tar.gz`
- Windows:
  - `u-plus-lite-v<version>-windows.zip`

如果资产命名变化，部署脚本也需要同步修改。

## 发布后的验证

建议至少验证一次：

1. 从全新环境运行部署脚本
2. 脚本能拉到最新 release
3. 安装包能正常解压
4. `npm install --omit=dev` 成功
5. 应用可通过 PM2 启动
6. 更新流程能保留 `.env.local` 和 `prisma/prod.db`
