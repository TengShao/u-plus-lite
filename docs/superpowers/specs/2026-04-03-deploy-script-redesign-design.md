# U-Plus-Lite 部署脚本重构设计

## 概述

重构 `u-plus-lite` 的一键部署脚本，目标是面向小白用户简单实用，同时支持 macOS 和 Windows。

**核心目标**：一个脚本同时搞定首次部署和更新，由脚本自动判断当前状态，智能跳过不必要的步骤。

---

## 术语

- **本地部署** / **已有部署**：指 `~/u-plus-lite`（macOS）或 `%USERPROFILE%\u-plus-lite`（Windows）目录下的 U-Plus-Lite 项目，且包含 `.git` 目录
- **全新部署**：本地不存在部署时的首次部署
- **更新**：已有部署时拉取最新代码并重启服务
- **卸载**：删除整个部署目录

---

## 架构

### 文件结构

```
u-plus-lite/
├── deploy/
│   ├── deploy.sh          # macOS/Linux 部署脚本
│   └── deploy.ps1         # Windows PowerShell 部署脚本
└── docs/
    └── deploy-guide.md    # 部署指南（更新）
```

**删除**：`scripts/deploy.sh` 和 `scripts/update.sh`

### 脚本入口

| 平台 | 运行方式 |
|------|---------|
| macOS/Linux | `curl -fsSL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/deploy/deploy.sh \| bash` |
| Windows | `irm https://raw.githubusercontent.com/TengShao/u-plus-lite/master/deploy/deploy.ps1 \| iex` |

---

## 流程设计

### 完整流程图

```
┌─────────────────────────────────────────────────────┐
│                   开始                               │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  Step 0: 环境检测 & 依赖安装                          │
│  - node: 不存在则自动安装                            │
│  - git:  不存在则提示/安装                            │
│  - pm2:  自动全局安装                                │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  Step 1: 获取最新版本号                              │
│  - GitHub API: /repos/TengShao/u-plus-lite/releases │
│  - 失败时降级：提示"无法获取"，继续部署（版本号不更新）    │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  Step 2: 检测本地部署状态                             │
│  - 默认路径: ~/u-plus-lite (macOS)                   │
│             %USERPROFILE%\u-plus-lite (Windows)      │
│  - 路径不存在 → 选项: 全新部署 / 输入已有路径           │
│  - 路径有效 → 继续                                  │
│  - 路径无效 → 报错退出                               │
└─────────────────────┬───────────────────────────────┘
                      ▼
              ┌────────┴────────┐
              │  是全新部署?      │
              └────────┬────────┘
               YES     │     NO
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌─────────────────┐    ┌─────────────────────────────────┐
│ Step 3: 全新部署 │    │ Step 4: 已存在部署操作            │
│                 │    │                                 │
│ - 克隆代码       │    │ - 显示: 当前版本 vs 最新版本      │
│ - npm install   │    │ - 选项 1: 更新                   │
│ - prisma generate│   │   (git pull + 智能构建 + 重启)    │
│ - db push       │    │ - 选项 2: 卸载                   │
│ - 创建管理员账号 │    │   (删除目录，需二次确认)           │
│ - .env 配置     │    │ - 选项 3: 重装                   │
│ - npm run build │    │   (删除目录 + 全新部署，需二次确认)│
│ - PM2 启动      │    │                                 │
│ - 写入 version.txt│  └─────────────────────────────────┘
│ - CSV 导入       │
│ - 询问自启      │
└─────────────────┘
```

---

## Step 0: 环境检测 & 依赖安装

### macOS

| 依赖 | 检测方式 | 不存在时 |
|------|---------|---------|
| git | `command -v git` | 提示安装 Xcode CLT (`xcode-select --install`)，脚本退出等待用户手动安装 |
| node | `command -v node` | 自动 `brew install node` |
| pm2 | `command -v pm2` | 自动 `npm install -g pm2 --silent` |

### Windows

| 依赖 | 检测方式 | 不存在时 |
|------|---------|---------|
| git | `Get-Command git -ErrorAction SilentlyContinue` | 自动 `choco install git -y`；无 choco 时先 `Set-ExecutionPolicy` + 安装 choco |
| node | `Get-Command node -ErrorAction SilentlyContinue` | 自动 `choco install nodejs -y` |
| pm2 | `npm list -g pm2` | 自动 `npm install -g pm2 --silent` |

---

## Step 1: 获取最新版本号

- **API**: `GET https://api.github.com/repos/TengShao/u-plus-lite/releases/latest`
- **解析**: `tag_name` 字段（格式 `v1.0.0`），去掉 `v` 前缀
- **失败处理**: 输出 "无法获取最新版本，继续部署..."，版本号用 `"unknown"`，不影响后续流程
- **版本比较**: 如果是全新部署，显示 "最新版本: x.x.x"；如果已部署，显示 "当前版本: x.x.x，最新版本: x.x.x，有更新/已是最新"

---

## Step 2: 检测本地部署状态

### 路径检测

| 平台 | 默认路径 |
|------|---------|
| macOS/Linux | `~/u-plus-lite` |
| Windows | `$env:USERPROFILE\u-plus-lite` |

### 路径不存在时的处理

```
检测到默认路径不存在：
┌────────────────────────────────────────────┐
│ 检测到未部署 U-Plus-Lite                     │
│                                            │
│  1. 全新部署                                │
│  2. 我已有部署，输入路径                      │
│                                            │
│ 请选择 [1]:
└────────────────────────────────────────────┘
```

- 选择 1：走全新部署流程
- 选择 2：让用户输入路径，验证是否为有效 git 仓库（检查 `.git` 目录）
  - 有效：继续更新流程
  - 无效：报错退出

---

## Step 3: 全新部署流程

### 3.1 克隆代码

```bash
git clone https://github.com/TengShao/u-plus-lite.git <目标路径>
```

### 3.2 安装依赖

```bash
npm install
```

**失败处理**：输出 npm 错误信息，脚本退出

### 3.3 Prisma 初始化

```bash
npx prisma generate
npx prisma db push --accept-data-loss
```

### 3.4 创建管理员账号

**强制交互输入**：
- 姓名（不能为空）
- 密码（不能为空，最少8位）
- 确认密码（必须与密码一致）

### 3.5 .env 配置

写入以下内容（全新部署时创建）：

```
DATABASE_URL="file:<部署路径>/prisma/prod.db"
NEXTAUTH_SECRET="<随机生成>"
NEXTAUTH_URL="http://<本机局域网IP>:<端口>"
```

### 3.6 端口配置

- **默认 3000**
- 检测 3000 是否被占用
  - 占用时：
    ```
    端口 3000 被占用
    1. 帮我释放 3000 端口（kill 占用进程）
    2. 查找下一个可用端口（注意：可能影响正在使用产品的用户）
    请选择 [1]:
    ```
    - 选项 1：`lsof -ti:3000 | xargs kill`（macOS）/ `Get-NetTCPConnection -LocalPort 3000 | Stop-Process -Force`（Windows）
    - 选项 2：扫描 3001, 3002, ... 找到第一个可用端口
- 不占用：直接使用 3000

### 3.7 构建

```bash
npm run build
```

### 3.8 PM2 启动

```bash
pm2 delete u-plus-lite 2>/dev/null || true
PORT=<端口> pm2 start npm --name u-plus-lite -- start
pm2 save
```

### 3.9 写入版本文件

```bash
echo "<version>" > <部署路径>/version.txt
```

### 3.10 CSV 导入（可选）

```
┌────────────────────────────────────────────┐
│ 是否导入管线和预算项？                        │
│                                            │
│  1. 指定 CSV 文件路径                        │
│  2. 直接粘贴 CSV 内容                        │
│  3. 跳过（稍后通过 Web 端手动添加）            │
│                                            │
│ 请选择 [3]:
└────────────────────────────────────────────┘
```

**CSV 格式**：
- 管线文件（每行一个名称）
- 预算项文件（格式：`管线名称,预算项名称`）

### 3.11 开机自启

```
是否配置开机自启？
- 是：自动设置（需要 sudo/管理员权限）
- 否：不配置
```

---

## Step 4: 已存在部署的操作

### 4.1 显示版本信息

```
当前部署版本: 1.2.0
最新版本:     1.3.0
状态: 有更新

┌────────────────────────────────────────────┐
│ 1. 更新（推荐）— 只拉取代码，不影响账号和数据   │
│ 2. 卸载 — 删除所有数据                        │
│ 3. 完全重装 — 删除所有数据后重新部署           │
│                                            │
│ 请选择 [1]:
└────────────────────────────────────────────┘
```

### 4.2 选项 1：更新

**智能构建**：

1. `git fetch origin && git pull origin master`
2. 比较 `package.json`：
   - 有变化：`npm install`
3. 比较 `prisma/schema.prisma`：
   - 有变化：`prisma generate && prisma db push --accept-data-loss`
4. `.env` 中的 `NEXTAUTH_URL` 如果变了（IP 或端口变化），自动更新
5. `npm run build`
6. `pm2 restart u-plus-lite`
7. 更新 `version.txt`

**注意**：更新时不重新创建管理员、不跑 CSV 导入

### 4.3 选项 2 & 3：卸载 / 完全重装

**二次确认**：

```
⚠️  警告：此操作将删除所有数据（账号、周期、填报记录等），无法恢复！
请输入 "YES" 确认：_
```

- 卸载：删除整个部署目录，退出
- 完全重装：删除整个部署目录后，跳转到 Step 3 全新部署流程

---

## 特殊情况处理

| 情况 | 处理方式 |
|------|---------|
| GitHub API 请求失败 | 提示"无法获取最新版本"，继续部署，版本号记为 "unknown" |
| npm install 失败 | 显示错误信息，脚本退出 |
| git clone 失败（网络问题） | 显示错误信息，脚本退出 |
| PM2 命令不可用 | 自动安装 |
| 磁盘空间不足 | npm/build 自然失败，无特殊处理 |
| 部署中途 Ctrl+C | 不做清理，下次重新运行即可 |
| 数据库文件损坏 | 不在脚本处理范围，提示用户 |
| Windows PowerShell 执行策略限制 | 脚本开头自动 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force` |

---

## 脚本输出规范

- **标题**：`U-Plus-Lite 部署脚本`
- **颜色**：ERROR（红）、WARNING（黄）、INFO/OK（绿）、普通输出（无色）
- **进度提示**：使用 `[1/7]` 这样的序号标注当前步骤
- **最终输出**：显示访问地址、管理员账号、常用命令

---

## 后续工作

1. 编写 `deploy/deploy.sh`（macOS）
2. 编写 `deploy/deploy.ps1`（Windows）
3. 更新 `docs/deploy-guide.md`
4. 删除 `scripts/` 目录
5. 提交代码并打 tag 发布
