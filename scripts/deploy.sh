#!/bin/bash
set -e

# ============================================================
# U-Minus 一键部署脚本（macOS 服务器用）
# 使用方式：
#   curl -sL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/scripts/deploy.sh | bash
# ============================================================

# 获取脚本自身所在目录，自动切换到项目根目录
# $0 可能是相对路径（如 scripts/deploy.sh），需要先转为绝对路径
[[ "$0" != /* ]] && _script="$PWD/$0" || _script="$0"
SCRIPT_DIR="$(cd -P "$(dirname "$_script")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

REPO_URL="https://github.com/TengShao/u-plus-lite.git"
DEFAULT_DIR="$HOME/u-plus-lite"
DEPLOY_DIR=""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 静默读取密码（跨平台兼容，macOS Terminal.app 上也能正确隐藏输入）
read_secret() {
    local prompt="$1"
    local var_name="$2"
    # 使用 stty 禁用终端回显，trap 确保退出时恢复
    trap 'stty echo 2>/dev/null' EXIT INT TERM
    stty -echo 2>/dev/null
    read -r "$var_name"
    stty echo 2>/dev/null
    trap - EXIT INT TERM
    # 打印换行（因为输入时没有回显换行）
    echo ""
}

# 获取局域网 IP (macOS)
get_local_ip() {
    local ip
    ip=$(ipconfig getifaddr en0 2>/dev/null)
    if [ -z "$ip" ]; then
        ip=$(ipconfig getifaddr en1 2>/dev/null)
    fi
    if [ -z "$ip" ]; then
        ip=$(ipconfig getifaddr en0)
    fi
    echo "$ip"
}

# 检测端口是否被占用 (macOS)
is_port_used() {
    local port=$1
    lsof -i :$port >/dev/null 2>&1
}

# 查找可用端口
find_available_port() {
    local port=3000
    while is_port_used $port; do
        port=$((port + 1))
    done
    echo $port
}

# 检测命令是否存在
command_exists() {
    command -v "$1" &> /dev/null
}

# 打印带颜色的状态
print_status() {
    local ok=$1
    local msg=$2
    if [ "$ok" = "ok" ]; then
        echo -e "${GREEN}[✓]${NC} $msg"
    elif [ "$ok" = "fail" ]; then
        echo -e "${RED}[✗]${NC} $msg"
    else
        echo -e "${YELLOW}[-]${NC} $msg"
    fi
}

# ============================================================
# Step 0: 依赖检测
# ============================================================
check_dependencies() {
    echo ""
    echo "正在检测系统依赖..."
    echo ""

    local missing_deps=()
    local dep_info=""

    # 检测 Git
    if command_exists git; then
        local git_version
        git_version=$(git --version | sed 's/git version //')
        print_status "ok" "Git: 已安装 ($git_version)"
    else
        print_status "fail" "Git: 未安装"
        missing_deps+=("git")
        dep_info="${dep_info}  - Git: 未安装（Xcode Command Line Tools 包含）\n"
    fi

    # 检测 Node.js
    if command_exists node; then
        local node_version
        node_version=$(node -v)
        # 检查版本是否 >= 18
        local major_version
        major_version=$(echo $node_version | sed 's/v\([0-9]*\)\..*/\1/')
        if [ "$major_version" -ge 18 ]; then
            print_status "ok" "Node.js: $node_version"
        else
            print_status "fail" "Node.js: $node_version (需要 v18+)"
            missing_deps+=("node")
            dep_info="${dep_info}  - Node.js: $node_version (需要 v18+)\n"
        fi
    else
        print_status "fail" "Node.js: 未安装"
        missing_deps+=("node")
        dep_info="${dep_info}  - Node.js: 未安装（需要 v18+）\n"
    fi

    # 如果有缺失依赖，提示安装
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}检测到缺少以下依赖：${NC}"
        echo -e "$dep_info"
        echo ""
        echo "是否自动安装？ [Y/n]: "
        read -r response
        response=${response:-Y}
        response=$(echo "$response" | tr '[:lower:]' '[:upper:]')

        if [ "$response" != "Y" ]; then
            echo ""
            echo -e "${RED}部署取消。请先手动安装缺少的依赖后，重新运行脚本。${NC}"
            echo ""
            echo "安装指引："
            echo "  macOS: https://nodejs.org/ 或 brew install node"
            echo "  Git:   安装 Xcode Command Line Tools (运行 xcode-select --install)"
            exit 1
        fi

        echo ""
        echo "正在安装依赖..."
        echo ""

        # 安装 Git (通过 Xcode CLT)
        for dep in "${missing_deps[@]}"; do
            if [ "$dep" = "git" ]; then
                echo "正在安装 Git..."
                xcode-select --install 2>/dev/null || true
                # 等待用户确认安装弹窗
                sleep 2
                print_status "ok" "Git 安装命令已触发，请等待 Xcode CLT 安装完成"
            fi
        done

        # 安装 Node.js (通过 Homebrew)
        for dep in "${missing_deps[@]}"; do
            if [ "$dep" = "node" ]; then
                if ! command_exists brew; then
                    echo "正在安装 Homebrew..."
                    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                fi
                echo "正在安装 Node.js..."
                brew install node
                print_status "ok" "Node.js 安装完成"
            fi
        done

        echo ""
        echo "所有依赖检测通过，继续部署..."
    else
        echo ""
        echo -e "${GREEN}所有依赖检测通过！${NC}"
    fi
}

# ============================================================
# Step 1: 路径配置
# ============================================================
setup_path() {
    echo ""
    echo "=========================================="
    echo " U-Minus 部署脚本"
    echo "=========================================="
    echo ""
    echo "部署路径 [默认: ~/u-plus-lite]: "
    read -r input
    DEPLOY_DIR=${input:-$DEFAULT_DIR}
    DEPLOY_DIR=$(eval echo "$DEPLOY_DIR")  # 展开 ~ 等

    # 如果路径末尾不是 /u-plus-lite，自动添加（方便用户输入 ~/部署 这样的路径）
    if [ "${DEPLOY_DIR##*/}" != "u-plus-lite" ]; then
        DEPLOY_DIR="$DEPLOY_DIR/u-plus-lite"
    fi
}

# ============================================================
# Step 2: 检测/克隆代码
# ============================================================
setup_code() {
    echo ""

    if [ -d "$DEPLOY_DIR/.git" ]; then
        # 已有代码，走更新流程
        echo "检测到已有代码，进入更新模式..."
        echo ""
        echo "即将更新现有部署：$DEPLOY_DIR"
        echo "是否继续？[Y: 更新，其他: 取消并退出]"
        read -r confirm
        confirm=${confirm:-Y}
        if [ "$(echo "$confirm" | tr '[:upper:]' '[:lower:]')" != "y" ]; then
            echo "已取消更新。请使用其他部署路径重新运行脚本。"
            exit 0
        fi
        cd "$DEPLOY_DIR"
        UPDATE_MODE=true
        PROJECT_ROOT="$DEPLOY_DIR"
        # 清理旧的构建缓存（防止 .next 中残留的 Prisma 客户端数据库路径导致连接错误数据库）
        if [ -d ".next" ]; then
            echo "清理旧的构建缓存..."
            rm -rf .next
        fi
        # 用本地正确版本覆盖（GitHub 上的版本可能较旧）
        cp "$SCRIPT_DIR/deploy.sh" "$DEPLOY_DIR/scripts/deploy.sh"
        echo "部署脚本已更新为最新版本"
    else
        # 首次部署
        if [ -d "$DEPLOY_DIR" ]; then
            echo -e "${YELLOW}警告：$DEPLOY_DIR 目录已存在，但不是 U-Minus 项目目录${NC}"
            echo "是否删除并重新克隆？ [y/N]: "
            read -r response
            response=${response:-N}
            if [ "$(echo "$response" | tr '[:upper:]' '[:lower:]')" = "y" ]; then
                rm -rf "$DEPLOY_DIR"
            else
                echo "部署取消。"
                exit 1
            fi
        fi

        echo "[1/7] 正在克隆代码仓库..."
        git clone "$REPO_URL" "$DEPLOY_DIR"
        cd "$DEPLOY_DIR"
        UPDATE_MODE=false

        # DEPLOY_DIR 即为项目根目录
        PROJECT_ROOT="$DEPLOY_DIR"

        # 用本地正确版本的 deploy.sh 覆盖克隆的版本（防止 GitHub 上的旧版本有问题）
        cp "$SCRIPT_DIR/deploy.sh" "$DEPLOY_DIR/scripts/deploy.sh"

        # 替换 seed.ts 为支持命令行参数的版本
        cat > prisma/seed.ts << 'SEED_EOF'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const providedName = process.argv[2]
  const providedPassword = process.argv[3]

  if (providedName && providedPassword) {
    const hashedPassword = await bcrypt.hash(providedPassword, 10)
    await prisma.user.upsert({
      where: { name: providedName },
      update: {},
      create: {
        name: providedName,
        password: hashedPassword,
        role: 'ADMIN',
      },
    })
    console.log(`Seed complete: admin user "${providedName}" created`)
  } else {
    const hashedPassword = await bcrypt.hash('88888888', 10)
    await prisma.user.upsert({
      where: { name: '邵腾' },
      update: {},
      create: {
        name: '邵腾',
        password: hashedPassword,
        role: 'ADMIN',
      },
    })
    console.log('Seed complete: admin user "邵腾" created (default)')
  }

  console.log('Seed complete: admin user created (pipelines/budget items via CSV import or Web UI)')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
SEED_EOF
        echo "seed.ts 已更新为支持命令行参数的版本"

        # 写入 import.ts（因为该文件未推送到 GitHub，需要内嵌）
        cat > prisma/import.ts << 'IMPORT_EOF'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as readline from 'readline'

const prisma = new PrismaClient()

type CliArgs = {
  pipelines?: string
  budgetItems?: string
}

function parseArgs(): CliArgs {
  const args: CliArgs = {}
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--pipelines=')) args.pipelines = arg.replace('--pipelines=', '')
    if (arg.startsWith('--budget-items=')) args.budgetItems = arg.replace('--budget-items=', '')
  }
  return args
}

async function readCsvLines(input: string): Promise<string[]> {
  if (input === '-') {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
    const lines: string[] = []
    for await (const line of rl) lines.push(line)
    return lines
  }
  if (!fs.existsSync(input)) {
    console.error('文件不存在: ' + input)
    process.exit(1)
  }
  return fs.readFileSync(input, 'utf8').split('\n').filter((l) => l.trim())
}

function parsePipelinesCsv(lines: string[]): string[] {
  if (lines.length < 2) return []
  return lines.slice(1).filter((l) => l.trim())
}

function parseBudgetItemsCsv(lines: string[]): Array<{ pipeline: string; name: string }> {
  if (lines.length < 2) return []
  return lines.slice(1).map((line) => {
    const firstComma = line.indexOf(',')
    if (firstComma === -1) return { pipeline: '', name: line.trim() }
    return {
      pipeline: line.slice(0, firstComma).trim(),
      name: line.slice(firstComma + 1).split(',')[0].trim(),
    }
  })
}

async function ensureOtherPipeline(): Promise<number> {
  const existing = await prisma.pipelineSetting.findUnique({ where: { name: '其他' } })
  if (existing) return existing.id
  const created = await prisma.pipelineSetting.create({ data: { name: '其他' } })
  console.log('  自动创建"其他"管线')
  return created.id
}

async function importPipelines(args: CliArgs) {
  if (!args.pipelines) {
    console.log('跳过管线导入（未指定 --pipelines）')
    return
  }
  const lines = await readCsvLines(args.pipelines)
  const names = parsePipelinesCsv(lines)
  if (names.length === 0) {
    console.log('pipelines.csv 为空，跳过')
    return
  }
  let created = 0, skipped = 0
  for (const name of names) {
    if (!name.trim()) continue
    const existing = await prisma.pipelineSetting.findUnique({ where: { name } })
    if (existing) {
      skipped++
    } else {
      await prisma.pipelineSetting.create({ data: { name } })
      created++
    }
  }
  console.log('管线导入完成：跳过 ' + skipped + '，已创建 ' + created)
}

async function importBudgetItems(args: CliArgs) {
  if (!args.budgetItems) {
    console.log('跳过预算项导入（未指定 --budget-items）')
    return
  }
  const otherPipelineId = await ensureOtherPipeline()
  const lines = await readCsvLines(args.budgetItems)
  const items = parseBudgetItemsCsv(lines)
  if (items.length === 0) {
    console.log('budget_items.csv 为空，跳过')
    return
  }
  let created = 0, skipped = 0
  const pipelineMap = new Map<string, number>()
  const allPipelines = await prisma.pipelineSetting.findMany()
  for (const p of allPipelines) pipelineMap.set(p.name, p.id)
  for (const item of items) {
    if (!item.name.trim()) continue
    let pipelineId = item.pipeline ? pipelineMap.get(item.pipeline) : undefined
    if (!pipelineId) {
      if (item.pipeline) {
        const createdPipeline = await prisma.pipelineSetting.create({ data: { name: item.pipeline } })
        pipelineMap.set(item.pipeline, createdPipeline.id)
        pipelineId = createdPipeline.id
        console.log('  自动创建管线: ' + item.pipeline)
      } else {
        pipelineId = otherPipelineId
      }
    }
    const existing = await prisma.budgetItemSetting.findFirst({
      where: { pipelineId, name: item.name },
    })
    if (existing) {
      skipped++
    } else {
      await prisma.budgetItemSetting.create({ data: { pipelineId, name: item.name } })
      created++
    }
  }
  console.log('预算项导入完成：跳过 ' + skipped + '，已创建 ' + created)
}

async function main() {
  const args = parseArgs()
  console.log('')
  await importPipelines(args)
  await importBudgetItems(args)
  console.log('')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
IMPORT_EOF
        echo "import.ts 已写入"

        # 创建 .env 文件（如果不存在，git clone 不会复制 .gitignore 中的文件）
        if [ ! -f ".env" ]; then
            echo "DATABASE_URL=\"file:$DEPLOY_DIR/prisma/dev.db\"" > .env
            echo 'NEXTAUTH_SECRET="u-minus-dev-secret-change-in-production"' >> .env
            echo 'NEXTAUTH_URL="http://localhost:3000"' >> .env
            echo ".env 文件已创建"
        fi
    fi
}

# ============================================================
# Step 3: 安装依赖
# ============================================================
install_deps() {
    echo "[2/7] 安装项目依赖..."
    npm install
}

# ============================================================
# Step 4: Prisma 初始化
# ============================================================
setup_prisma() {
    echo "[3/7] 生成 Prisma 客户端..."
    npx prisma generate

    echo "[4/7] 应用数据库迁移..."
    # 使用 db push 而非 migrate deploy，避免相对路径解析到错误位置（prisma/prisma/dev.db）
    npx prisma db push --accept-data-loss
}

# ============================================================
# Step 5: 创建管理员（仅首次）
# ============================================================
setup_admin() {
    if [ "$UPDATE_MODE" = true ]; then
        echo "[5/7] 跳过管理员创建（更新模式）..."
        return
    fi

    echo "[5/7] 创建管理员账号..."
    echo ""
    echo "首次部署，创建管理员账号"
    echo ""

    read -p "  管理员姓名: " ADMIN_NAME
    while [ -z "$ADMIN_NAME" ]; do
        echo "  错误：管理员姓名不能为空"
        read -p "  管理员姓名: " ADMIN_NAME
    done

    read_secret "  密码: " ADMIN_PASSWORD
    while [ -z "$ADMIN_PASSWORD" ]; do
        echo "  错误：密码不能为空"
        read_secret "  密码: " ADMIN_PASSWORD
    done

    while [ ${#ADMIN_PASSWORD} -lt 8 ]; do
        echo "  错误：密码至少8位"
        read_secret "  密码: " ADMIN_PASSWORD
    done

    read_secret "  确认密码: " ADMIN_PASSWORD_CONFIRM
    while [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]; do
        echo "  错误：两次输入的密码不一致"
        read_secret "  密码: " ADMIN_PASSWORD
        while [ -z "$ADMIN_PASSWORD" ]; do
            echo "  错误：密码不能为空"
            read_secret "  密码: " ADMIN_PASSWORD
        done
        while [ ${#ADMIN_PASSWORD} -lt 8 ]; do
            echo "  错误：密码至少8位"
            read_secret "  密码: " ADMIN_PASSWORD
        done
        read_secret "  确认密码: " ADMIN_PASSWORD_CONFIRM
    done

    npx tsx "$PROJECT_ROOT/prisma/seed.ts" "$ADMIN_NAME" "$ADMIN_PASSWORD"
}

# ============================================================
# Step 6: 构建并启动
# ============================================================
build_and_start() {
    echo "[6/7] 构建生产版本..."
    # PORT 和 NEXTAUTH_URL 已在 config_nextauth 中更新到 .env
    npm run build

    echo "[7/7] 启动 PM2 服务..."

    # 安装 PM2（如果尚未安装）
    npm install -g pm2 --silent 2>/dev/null || true

    # 停止旧实例
    pm2 delete u-plus-lite 2>/dev/null || true

    # 启动服务（PORT 由 config_nextauth 设置在 .env 中，启动时 PM2 自动加载 .env）
    PORT=$PORT pm2 start npm --name u-plus-lite -- start
    pm2 save
}

# ============================================================
# Step 7: 配置 NEXTAUTH_URL
# ============================================================
config_nextauth() {
    # 在 build 前更新 .env 中的 NEXTAUTH_URL（Next.js build 时会嵌入环境变量）
    echo "[配置] 更新 NEXTAUTH_URL..."

    # 查找可用端口
    PORT=$(find_available_port)
    echo "使用端口：$PORT"

    LOCAL_IP=$(get_local_ip)

    if [ -f ".env" ]; then
        sed -i '' "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=\"http://$LOCAL_IP:$PORT\"|" .env
        echo "NEXTAUTH_URL 已更新为 http://$LOCAL_IP:$PORT"
    fi

    # 自启配置
    echo ""
    echo "是否配置开机自启？[Y/n]: "
    read -r enable_autostart
    enable_autostart=${enable_autostart:-Y}
    if [ "$(echo "$enable_autostart" | tr '[:upper:]' '[:lower:]')" = "y" ]; then
        echo "（需要输入本机管理员密码）"
        sudo pm2 startup 2>/dev/null || true
    else
        echo "已跳过开机自启配置"
    fi
}

# ============================================================
# Step 8: CSV import (optional)
# ============================================================
import_csv_data() {
    # 确保从项目根目录执行
    cd "$PROJECT_ROOT"

    echo ""
    echo "[8/8] 是否导入预算项和管线数据？"
    echo ""
    echo "  1 - 指定 CSV 文件路径"
    echo "  2 - 直接粘贴 CSV 内容"
    echo "  3 - 跳过（稍后通过 Web 端手动添加）"
    echo ""
    echo "请选择（直接回车跳过）: "
    read -r choice
    choice=${choice:-3}

    if [ "$choice" = "1" ]; then
        echo ""
        echo "请输入管线名称文件路径（CSV格式，直接回车跳过）: "
        echo "  格式示例：每行一个管线名称，如："
        echo "    UGC研发"
        echo "    UGC运营"
        echo "    玩法"
        echo ""
        read -r pipelines_path
        echo ""
        echo "请输入预算项文件路径（CSV格式，直接回车跳过）: "
        echo "  格式示例：管线名称,预算项名称，如："
        echo "    UGC研发,UGC商业化功能"
        echo "    UGC运营,乐园会员体系"
        echo ""
        read -r budget_path

        local cmd_args=""
        if [ -n "$pipelines_path" ]; then
            cmd_args="$cmd_args --pipelines=$pipelines_path"
        fi
        if [ -n "$budget_path" ]; then
            cmd_args="$cmd_args --budget-items=$budget_path"
        fi

        if [ -n "$cmd_args" ]; then
            npx tsx "$PROJECT_ROOT/prisma/import.ts" $cmd_args
        else
            echo "未指定文件，跳过导入"
        fi

    elif [ "$choice" = "2" ]; then
        echo ""
        echo "请粘贴管线名称文件内容（每行一个名称，Ctrl+D 结束）: "
        echo "  格式示例："
        echo "    UGC研发"
        echo "    UGC运营"
        echo "    玩法"
        echo ""
        local pipelines_content
        pipelines_content=$(cat)
        echo ""
        echo "请粘贴预算项文件内容（格式：管线名称,预算项名称，Ctrl+D 结束）: "
        echo "  格式示例："
        echo "    UGC研发,UGC商业化功能"
        echo "    UGC运营,乐园会员体系"
        echo ""
        local budget_content
        budget_content=$(cat)

        # 使用临时文件传递内容（避免 stdin pipe 与 tsx ESM 加载冲突）
        if [ -n "$pipelines_content" ]; then
            local pipelines_tmp
            pipelines_tmp=$(mktemp)
            echo "$pipelines_content" > "$pipelines_tmp"
            npx tsx "$PROJECT_ROOT/prisma/import.ts" --pipelines="$pipelines_tmp"
            rm -f "$pipelines_tmp"
        fi
        if [ -n "$budget_content" ]; then
            local budget_tmp
            budget_tmp=$(mktemp)
            echo "$budget_content" > "$budget_tmp"
            npx tsx "$PROJECT_ROOT/prisma/import.ts" --budget-items="$budget_tmp"
            rm -f "$budget_tmp"
        fi
    else
        echo "跳过导入，管理员可在 Web 端手动添加管线/预算项"
    fi
}

# ============================================================
# 完成
# ============================================================
show_complete() {
    LOCAL_IP=$(get_local_ip)

    echo ""
    echo "=========================================="
    echo -e " ${GREEN}部署完成！${NC}"
    echo "=========================================="
    echo ""
    echo "局域网访问地址：http://$LOCAL_IP:$PORT"
    echo ""

    if [ "$UPDATE_MODE" = false ]; then
        echo "管理员账号：$ADMIN_NAME"
        echo "管理员密码：$ADMIN_PASSWORD"
    fi

    echo ""
    echo "常用命令："
    echo "  pm2 status              查看状态"
    echo "  pm2 logs u-plus-lite   查看日志"
    echo "  pm2 restart u-plus-lite 重启"
    echo "=========================================="
}

# ============================================================
# 主流程
# ============================================================
main() {
    check_dependencies    # Step 0: 依赖检测
    setup_path           # Step 1: 路径配置
    setup_code           # Step 2: 克隆/更新代码
    install_deps         # Step 3: 安装依赖
    setup_prisma         # Step 4: Prisma
    setup_admin          # Step 5: 管理员
    config_nextauth      # Step 6: 配置 NEXTAUTH_URL（必须在 build 前，以嵌入正确环境变量）
    build_and_start      # Step 7: 构建并启动
    import_csv_data      # Step 8: CSV import
    show_complete        # 完成
}

main "$@"
