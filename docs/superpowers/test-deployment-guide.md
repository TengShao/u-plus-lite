# 一键部署测试指南

## 测试前准备

### 1. 导出文件位置
```
prisma/exports/pipelines.csv     # 6 条管线
prisma/exports/budget_items.csv  # 135 条预算项
```

### 2. 运行部署脚本
```bash
# 从项目根目录运行
bash scripts/deploy.sh

# 或直接下载运行（无需克隆整个仓库）
curl -sL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/scripts/deploy.sh | bash
```

---

## 脚本步骤说明

| 步骤 | 内容 | 说明 |
|------|------|------|
| Step 0 | 依赖检测 | 检查 Git、Node.js，未安装则提示安装 |
| Step 1 | 路径配置 | 输入部署路径（默认 `~/u-plus-lite`） |
| Step 2 | 克隆/更新代码 | 首次部署克隆，更新部署拉取最新代码 |
| Step 3 | 安装依赖 | `npm install` |
| Step 4 | Prisma 初始化 | 生成 Prisma Client + 迁移数据库 |
| Step 5 | 创建管理员 | 仅首次部署，输入账号密码 |
| Step 6 | 配置 NEXTAUTH_URL | 在 build 前更新环境变量 |
| Step 7 | 构建并启动 | `npm run build` + PM2 启动 |
| Step 8 | CSV 导入 | 可选导入管线和预算项数据 |

---

## 测试流程

### 方式 A：全新部署测试

**Step 1: 创建空测试目录**
```bash
mkdir ~/Downloads/deploy-test
```

**Step 2: 运行脚本（全新部署）**
```bash
bash scripts/deploy.sh
# 输入测试路径如 ~/Downloads/deploy-test/test1
# 输入管理员账号密码
# Step 8 选择 1 指定 CSV 文件路径导入
```

**Step 3: 验证**
- 浏览器打开 `http://<本机IP>:<端口>`
- 登录管理员账号
- 新建需求组 → 管线和预算项下拉应显示导入的数据
- PM2 状态：`pm2 status`

### 方式 B：更新部署测试（验证 .next 缓存清理）

已有部署目录重新运行脚本：
```bash
bash scripts/deploy.sh
# 输入已有部署路径如 ~/Downloads/deploy-test/test1
# 脚本会检测到 .git，进入更新模式
# 提示确认是否更新
# 会自动清理 .next 缓存并重新 build
```

---

## CSV 导入（Step 8）

```
[8/8] 是否导入预算项和管线数据？

  1 - 指定 CSV 文件路径
  2 - 直接粘贴 CSV 内容
  3 - 跳过（稍后通过 Web 端手动添加）

请选择（直接回车跳过）:
```

**选 1（推荐）**：
```
请输入管线名称文件路径: prisma/exports/pipelines.csv
请输入预算项文件路径: prisma/exports/budget_items.csv
```

**选 2**：粘贴 CSV 内容，以空行结束输入

---

## 验证检查清单

- [ ] 全新部署：依赖检测正常（Git、Node.js）
- [ ] 全新部署：路径自动加 `/u-plus-lite` 子目录
- [ ] 全新部署：管理员账号创建成功
- [ ] 全新部署：`npm run build` 无报错
- [ ] 全新部署：PM2 服务启动成功
- [ ] 全新部署：CSV 导入日志显示 "跳过 N，已创建 M"
- [ ] 全新部署：登录 Web UI，新需求组下拉显示 6 条管线 + 135 条预算项
- [ ] 更新部署：UPDATE_MODE 确认提示正常
- [ ] 更新部署：.next 缓存被清理，重新 build
- [ ] 更新部署：原有数据库数据保留
- [ ] 退出登录：重定向到当前地址（而非 localhost:3000）
