# U-Plus-Lite 部署指南

## 环境要求

- macOS 或 Windows 作为服务器
- Node.js 18+
- Git
- PM2（脚本自动安装）
- 团队成员在同一局域网内

---

## 一键部署（推荐）

### 运行命令

**macOS / Linux：**
```bash
curl -fsSL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/deploy/deploy.sh -o /tmp/deploy.sh && bash /tmp/deploy.sh
```

> 注：必须先下载到本地文件再执行，因为部署过程需要交互式输入，无法通过管道直接运行。

**Windows（PowerShell）：**
```powershell
irm https://raw.githubusercontent.com/TengShao/u-plus-lite/master/deploy/deploy.ps1 | iex
```

---

## 部署步骤说明

脚本会自动检测环境并完成以下步骤：

| 步骤 | 内容 | 说明 |
|------|------|------|
| [1/9] | Git Clone | 首次部署时克隆代码仓库 |
| [2/9] | 安装依赖 | npm install |
| [3/9] | Prisma 初始化 | prisma generate + db push |
| [4/9] | 创建管理员 | 仅首次部署，交互式输入账号密码 |
| [5/9] | 配置环境变量 | NEXTAUTH_SECRET、NEXTAUTH_URL（含端口配置） |
| [6/9] | 构建 | npm run build |
| [7/9] | PM2 启动 | 配置服务并启动 |
| [8/9] | 保存版本信息 | 写入 version.txt |
| [9/9] | CSV 导入 | 可选导入管线和预算项 |

部署后询问是否配置开机自启。

---

## 端口说明

默认使用 **3000** 端口。

**冲突处理：**
- 脚本会自动检测端口是否被占用
- 如被占用，提示你关闭占用进程或选择下一个可用端口
- 手动修改端口后重启：
```bash
pm2 restart u-plus-lite
```

---

## 更新部署

已有部署目录重新运行脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/deploy/deploy.sh -o /tmp/deploy.sh && bash /tmp/deploy.sh
```

或直接运行本地脚本：

```bash
bash ~/u-plus-lite/deploy/deploy.sh
```

脚本检测到已有部署后会进入更新模式，可选择：更新、卸载、重新安装。

**数据安全：** 数据库文件完全不受影响。

---

## 卸载

运行脚本，选择「卸载」：

```bash
bash ~/u-plus-lite/deploy/deploy.sh
```

卸载会停止服务、删除代码目录，但数据库文件需手动删除。

---

## 重新安装

运行脚本，选择「重新安装」：

```bash
bash ~/u-plus-lite/deploy/deploy.sh
```

选择「重新安装」会先卸载再全新部署。

---

## CSV 导入（管线和预算项）

### 导出当前数据

```bash
npx tsx prisma/export.ts
```
输出：`prisma/exports/pipelines.csv`、`prisma/exports/budget_items.csv`

### 导入管线和预算项

部署脚本 [9/9] 支持导入 CSV 文件。CSV 格式如下：

**管线文件（示例）：**
```csv
name
UGC研发
UGC运营
玩法
```

**预算项文件（示例）：**
```csv
pipeline,name
UGC研发,UGC商业化功能
UGC研发,编辑器WEB端功能开发
玩法,超燃相关体验设计与优化Q1
```

导入命令：
```bash
npx tsx prisma/import.ts --pipelines=管线.csv --budget-items=预算项.csv
```

**行为说明：**
- 管线不存在时自动创建
- 预算项关联的管线不存在时，自动创建该管线
- 预算项可不关联管线（留空管线字段，自动归入"其他"管线）
- 已存在的管线/预算项跳过，不会重复创建

### Web 端管理

管理员也可在 Web 端手动管理：
- **设置 → 管线管理**：添加、编辑管线
- **设置 → 预算项管理**：添加、编辑预算项

---

## 常用命令

```bash
pm2 status              # 查看服务状态
pm2 logs u-plus-lite   # 查看日志
pm2 restart u-plus-lite # 重启服务
pm2 stop u-plus-lite   # 停止服务
```

---

## 数据备份

SQLite 数据库文件位置：

- macOS / Linux：`~/u-plus-lite/prisma/dev.db`
- Windows：`%USERPROFILE%\u-plus-lite\prisma\dev.db`

定期备份命令：

**macOS / Linux：**
```bash
cp ~/u-plus-lite/prisma/dev.db ~/backup/dev.db.$(date +\%Y\%m\%d)
```

**Windows：**
```powershell
Copy-Item "$env:USERPROFILE\u-plus-lite\prisma\dev.db" "$env:USERPROFILE\backup\dev.db.$(Get-Date -Format 'yyyyMMdd')"
```

---

## 团队访问

### 局域网访问

同一网络下浏览器打开 `http://<服务器IP>:3000`

### 管理员登录

首次部署由脚本 Step 7 创建。后续可在 Web 端修改密码。

### 远程成员访问

目前远程成员需要先连 VPN 回办公室网络，再通过局域网 IP 访问。
