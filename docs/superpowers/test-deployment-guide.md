# 一键部署测试指南

## 测试前准备

### 1. 导出文件位置
```
prisma/exports/pipelines.csv     # 6 条管线
prisma/exports/budget_items.csv  # 135 条预算项
```

### 2. 运行部署脚本

**macOS / Linux：**
```bash
# 下载到本地后运行（推荐，交互式输入需要）
curl -fsSL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/deploy/deploy.sh -o /tmp/deploy.sh && bash /tmp/deploy.sh

# 或本地已有仓库时
bash ~/u-plus-lite/deploy/deploy.sh
```

**Windows（PowerShell）：**
```powershell
irm https://raw.githubusercontent.com/TengShao/u-plus-lite/master/deploy/deploy.ps1 | iex
```

---

## 脚本步骤说明

| 步骤 | 内容 | 说明 |
|------|------|------|
| [1/9] | Git Clone | 首次部署克隆代码仓库 |
| [2/9] | npm install | 安装 Node.js 依赖 |
| [3/9] | Prisma 初始化 | prisma generate + db push |
| [4/9] | 创建管理员 | 仅首次部署，交互式输入账号密码 |
| [5/9] | 配置环境变量 | NEXTAUTH_URL、NEXTAUTH_SECRET |
| [6/9] | 构建 | npm run build |
| [7/9] | PM2 启动 | 配置服务并启动 |
| [8/9] | 保存版本信息 | 写入 version.txt |
| [9/9] | CSV 数据导入 | 可选导入管线和预算项数据 |

---

## 测试流程

### 方式 A：全新部署测试

**Step 1: 创建空测试目录**
```bash
mkdir ~/Downloads/deploy-test
```

**Step 2: 运行脚本（全新部署）**
```bash
curl -fsSL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/deploy/deploy.sh -o /tmp/deploy.sh && bash /tmp/deploy.sh
# 选择 1 - 全新部署
# 输入管理员账号密码
# [9/9] 选择 1 指定 CSV 文件路径导入
```

**Step 3: 验证**
- 浏览器打开 `http://<本机IP>:<端口>`
- 登录管理员账号
- 新建需求组 → 管线和预算项下拉应显示导入的数据
- PM2 状态：`pm2 status`

### 方式 B：更新部署测试

已有部署目录重新运行脚本：
```bash
bash ~/u-plus-lite/deploy/deploy.sh
# 脚本检测到 .git，进入更新模式
# 选择 1 - 更新（推荐）
# 自动检测依赖/数据库变化，智能构建
```

---

## CSV 导入（[9/9]）

```
请选择导入方式：
  1 - 指定 CSV 文件路径
  2 - 直接粘贴 CSV 内容
  3 - 跳过（稍后通过 Web 端手动添加）
```

**选 1（推荐）**：
```
请输入管线名称文件路径: prisma/exports/pipelines.csv
请输入预算项文件路径: prisma/exports/budget_items.csv
```

**选 2**：粘贴 CSV 内容，以空行结束输入

---

## 验证检查清单

- [ ] 全新部署：依赖检测正常（Git、Node.js、PM2）
- [ ] 全新部署：端口检测和冲突处理正常
- [ ] 全新部署：管理员账号创建成功
- [ ] 全新部署：npm run build 无报错
- [ ] 全新部署：PM2 服务启动成功
- [ ] 全新部署：CSV 导入日志显示 "跳过 N，已创建 M"
- [ ] 全新部署：登录 Web UI，新需求组下拉显示 6 条管线 + 135 条预算项
- [ ] 更新部署：脚本检测到已有部署，进入更新模式
- [ ] 更新部署：依赖无变化时跳过 npm install
- [ ] 更新部署：数据库结构无变化时跳过 prisma
- [ ] 更新部署：原有数据库数据保留
- [ ] 退出登录：重定向到当前地址（而非 localhost:3000）
