# U-Plus-Lite 部署指南

## 这次部署模型的变化

- 部署目录默认是独立运行目录，不是源码仓库。
- 更新通过 GitHub Release 安装包完成，不再依赖 `git pull`。
- 从源码仓库直接运行部署脚本时，脚本会把当前目录识别为“脚本来源”，不会把它当成部署目录更新。
- 部署过程中用到的管理员初始化和 CSV 导入 helper 会写到系统临时目录，执行后清理，不会覆盖仓库里的 `prisma/seed.ts` 或 `prisma/import.ts`。

## 环境要求

- macOS / Linux 或 Windows
- Node.js 18+
- PM2
- 部署机器可以访问 GitHub Release

说明：
- macOS / Linux 脚本会检查 `curl` 和 `tar`
- Windows 脚本使用系统内置下载和解压能力
- PM2 未安装时，脚本会尝试自动安装

## 一键部署

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/deploy/deploy.sh -o /tmp/u-plus-lite-deploy.sh
bash /tmp/u-plus-lite-deploy.sh
```

### Windows PowerShell

```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/TengShao/u-plus-lite/master/deploy/deploy.ps1 -OutFile "$env:TEMP\u-plus-lite-deploy.ps1"
powershell -ExecutionPolicy Bypass -File "$env:TEMP\u-plus-lite-deploy.ps1"
```

说明：
- 必须先下载到本地文件再运行。
- 部署过程包含交互式菜单，支持上下切换、空格选择、回车确认。
- 不建议在源码仓库根目录里直接把当前目录当部署目录使用。

## 默认部署目录

- macOS / Linux: `~/u-plus-lite`
- Windows: `%USERPROFILE%\u-plus-lite`

如果默认目录没有检测到已有部署，脚本会让你选择：
- 全新部署
- 指定已有部署路径

## 部署流程

全新部署会执行这些步骤：

| 步骤 | 内容 |
|------|------|
| [1/8] | 下载并解压最新 release 安装包 |
| [2/8] | 安装运行依赖 `npm install --omit=dev` |
| [3/8] | 初始化数据库 `prisma generate + db push` |
| [4/8] | 创建管理员账号 |
| [5/8] | 生成 `.env.local` |
| [6/8] | 启动 PM2 服务 |
| [7/8] | 写入 `version.txt` |
| [8/8] | 可选导入 CSV 数据 |

更新部署会执行这些步骤：

1. 获取最新 release 信息
2. 下载并解压新安装包到临时目录
3. 保留 `.env.local` 和 `prisma/prod.db`
4. 替换应用文件
5. 安装运行依赖
6. 更新数据库结构
7. 可选重置管理员账号
8. 重启 PM2 并更新 `version.txt`

## 数据保留策略

更新时会保留：
- `.env.local`
- `prisma/prod.db`
- `version.txt`

更新时会替换：
- 应用代码
- `.next`
- `public`
- `deploy`
- 运行所需 Prisma 文件

## 端口说明

- 默认端口是 `3000`
- 如果 `3000` 已被占用，脚本会提供菜单：
  - 释放 `3000`
  - 改用下一个可用端口

部署完成后的访问地址会显示为：

```text
http://<局域网IP>:<端口>
```

## 更新部署

重新运行部署脚本即可：

### macOS / Linux

```bash
bash ~/u-plus-lite/deploy/deploy.sh
```

### Windows

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\u-plus-lite\deploy\deploy.ps1"
```

脚本检测到已有部署后会进入更新模式，可选择：
- 更新
- 卸载
- 重新安装

## CSV 导入

部署脚本支持三种方式：
- 指定 CSV 文件路径
- 直接粘贴 CSV 内容
- 跳过，后续在 Web 端手动维护

手动导出命令：

```bash
npx tsx prisma/export.ts
```

手动导入命令：

```bash
npx tsx prisma/import.ts --pipelines=管线.csv --budget-items=预算项.csv
```

管线 CSV 示例：

```csv
name
UGC研发
UGC运营
玩法
```

预算项 CSV 示例：

```csv
pipeline,name
UGC研发,UGC商业化功能
UGC研发,编辑器WEB端功能开发
玩法,超燃相关体验设计与优化Q1
```

## 卸载

运行部署脚本并选择“卸载”即可。

脚本会：
- 停止并删除 PM2 服务
- 删除部署目录

卸载前需要手动输入 `YES` 确认。

## 常用命令

```bash
pm2 status
pm2 logs u-plus-lite
pm2 restart u-plus-lite
pm2 stop u-plus-lite
```

## 数据备份

- macOS / Linux: `~/u-plus-lite/prisma/prod.db`
- Windows: `%USERPROFILE%\u-plus-lite\prisma\prod.db`

macOS / Linux 备份：

```bash
cp ~/u-plus-lite/prisma/prod.db ~/backup/prod.db.$(date +%Y%m%d)
```

Windows 备份：

```powershell
Copy-Item "$env:USERPROFILE\u-plus-lite\prisma\prod.db" "$env:USERPROFILE\backup\prod.db.$(Get-Date -Format 'yyyyMMdd')"
```

## 发版

发版不再依赖 GitHub Actions 自动打包，当前推荐本地手工发布：

```bash
npm run release
npm run package:release
npm run publish:release
```

更完整的发版步骤见 [../docs/release-guide.md](/Users/teng/Drive/Project/u-plus-lite/docs/release-guide.md)。
