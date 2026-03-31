# U-Plus-Lite 部署指南

## 环境要求

- macOS 或 Windows 作为服务器
- Node.js 18+
- 团队成员在同一局域网内

---

## 一、一键部署（推荐）

### 1. 运行部署脚本

**macOS / Linux：**
```bash
# 方式一：一键运行（推荐）
bash <(curl -sL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/scripts/deploy.sh)

# 方式二：先下载再运行（备用）
curl -fsSL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/scripts/deploy.sh -o /tmp/deploy.sh && bash /tmp/deploy.sh
```

**Windows（PowerShell）：**
```powershell
irm https://raw.githubusercontent.com/TengShao/u-plus-lite/master/scripts/deploy.ps1 | iex
```

脚本自动完成：依赖检测 → 代码克隆 → 依赖安装 → 数据库初始化 → 管理员创建 → 构建 → PM2 启动 → CSV 导入。

### 2. 部署步骤说明

| 步骤 | 内容 | 说明 |
|------|------|------|
| Step 0 | 依赖检测 | 检查 Git、Node.js，未安装则提示安装 |
| Step 1 | 路径配置 | 输入部署路径（默认 `~/u-plus-lite`，输入任意路径会自动在其下创建 `u-plus-lite` 子目录） |
| Step 2 | 克隆/更新代码 | 首次部署克隆；已有 .git 则进入更新模式 |
| Step 3 | 安装依赖 | `npm install` |
| Step 4 | Prisma 初始化 | `prisma generate` + `db push` |
| Step 5 | 创建管理员 | 仅首次部署，交互式输入账号密码（密码输入不回显） |
| Step 6 | 配置 NEXTAUTH_URL | 自动检测局域网 IP 和可用端口，更新 .env |
| Step 7 | 构建并启动 | `npm run build` + PM2 启动 |
| Step 8 | CSV 导入 | 可选导入管线和预算项（文件路径或直接粘贴） |

### 3. 端口说明

脚本自动查找 3000 起未被占用的端口。如需指定端口，可手动修改 `.env` 后重启：
```bash
# 编辑 .env 中的 NEXTAUTH_URL 和 DATABASE_URL 端口
pm2 restart u-plus-lite
```

Windows 用户修改 `.env` 后重启：
```powershell
pm2 restart u-plus-lite
```

### 4. 开机自启

Step 6 会询问是否配置开机自启。已配置则服务在服务器重启后自动恢复。

---

## 二、更新部署（不丢失数据）

已有部署目录重新运行脚本：

macOS / Linux：
```bash
bash ~/u-plus-lite/scripts/deploy.sh
```

Windows：
```powershell
~\u-plus-lite\scripts\deploy.ps1
```

数据库文件完全不受影响。

---

## 三、CSV 导入（管线和预算项）

### 导出当前数据

```bash
npx tsx prisma/export.ts
```
输出：`prisma/exports/pipelines.csv`、`prisma/exports/budget_items.csv`（具体数量取决于当前数据）

### 导入管线和预算项

脚本 Step 8 支持导入 CSV 文件。CSV 格式如下：

**管线文件**（示例）：
```csv
name
UGC研发
UGC运营
玩法
```

**预算项文件**（示例）：
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
- 预算项可选择不关联管线（留空管线字段，自动归入"其他"管线）
- 已存在的管线/预算项跳过，不会重复创建

### Web 端管理

管理员也可在 Web 端手动管理：
- **设置 → 管线管理**：添加、编辑管线
- **设置 → 预算项管理**：添加、编辑预算项

---

## 四、常用命令

```bash
pm2 status              # 查看服务状态
pm2 logs u-plus-lite   # 查看日志
pm2 restart u-plus-lite # 重启服务
```

---

## 五、数据备份

SQLite 数据库文件位置：

- macOS / Linux：`~/u-plus-lite/prisma/dev.db`
- Windows：`%USERPROFILE%\u-plus-lite\prisma\dev.db`

建议定期备份：

macOS / Linux：
```bash
cp ~/u-plus-lite/prisma/dev.db ~/backup/dev.db.$(date +\%Y\%m\%d)
```

Windows：
```powershell
Copy-Item "$env:USERPROFILE\u-plus-lite\prisma\dev.db" "$env:USERPROFILE\backup\dev.db.$(Get-Date -Format 'yyyyMMdd')"
```

---

## 六、团队访问

### 局域网访问

同一网络下浏览器打开 `http://<服务器IP>:<端口>`。

### 管理员登录

首次部署由脚本 Step 5 创建。后续可 Web 端修改密码。

### 远程成员访问

目前远程成员需要先连 VPN 回办公室网络，再通过局域网 IP 访问。

