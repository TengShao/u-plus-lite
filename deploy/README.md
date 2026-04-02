# U-Plus-Lite 一键部署包

## 文件说明

```
deploy/
├── README.md           # 本文件
├── deploy.sh           # macOS/Linux 部署脚本
├── deploy.ps1          # Windows 部署脚本（PowerShell）
├── pipelines.csv        # 管线数据（6条）
└── budget_items.csv    # 预算项数据（135条）
```

## 快速开始

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/scripts/deploy.sh -o /tmp/deploy.sh && bash /tmp/deploy.sh
```

或下载本文件夹中的 `deploy.sh` 直接运行：
```bash
bash deploy.sh
```

### Windows

以管理员身份打开 PowerShell，进入本文件夹后运行：
```powershell
.\deploy.ps1
```

## 部署步骤

| 步骤 | 内容 |
|------|------|
| Step 0 | 依赖检测（Git、Node.js） |
| Step 1 | 部署路径配置（默认 `~/u-plus-lite`） |
| Step 2 | 克隆或更新代码 |
| Step 3 | 安装依赖（npm install） |
| Step 4 | Prisma 初始化 |
| Step 5 | 创建管理员账号 |
| Step 6 | 配置 NEXTAUTH_URL |
| Step 7 | 构建并启动 |
| Step 8 | CSV 导入（管线和预算项，可跳过） |

## 访问地址

部署完成后，局域网访问：`http://<服务器IP>:3000`

## 常见问题

**端口 3000 被占用？**
关闭占用端口的进程后重试。

**数据库路径：**
- macOS/Linux：`~/u-plus-lite/prisma/dev.db`
- Windows：`%USERPROFILE%\u-plus-lite\prisma\dev.db`

**PM2 管理命令：**
```bash
pm2 status              # 查看状态
pm2 logs u-plus-lite   # 查看日志
pm2 restart u-plus-lite # 重启
```
