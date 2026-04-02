#!/bin/bash
set -e

# ============================================================
# U-Plus-Lite 一键部署脚本 (macOS/Linux)
#
# 使用方式:
#   curl -fsSL https://raw.githubusercontent.com/TengShao/u-plus-lite/master/deploy/deploy.sh | bash
#
# 或下载后直接运行:
#   chmod +x deploy/deploy.sh && ./deploy/deploy.sh
# ============================================================

REPO_URL="https://github.com/TengShao/u-plus-lite.git"
DEFAULT_DIR="$HOME/u-plus-lite"
DEPLOY_DIR=""
DEPLOY_MODE=""  # "new" or "update"
PROJECT_ROOT=""
LATEST_VERSION="unknown"
LOCAL_VERSION="unknown"
PORT=3000

# ============================================================
# 颜色定义
# ============================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================
# 工具函数
# ============================================================

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
        echo -e "${YELLOW}[!]${NC} $msg"
    fi
}

# 获取局域网 IP
get_local_ip() {
    local ip
    # macOS
    if command_exists ipconfig; then
        ip=$(ipconfig getifaddr en0 2>/dev/null)
        if [ -z "$ip" ]; then
            ip=$(ipconfig getifaddr en1 2>/dev/null)
        fi
    fi
    # Linux
    if [ -z "$ip" ] && command_exists hostname; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    # Fallback
    if [ -z "$ip" ]; then
        ip=$(hostname 2>/dev/null)
    fi
    echo "$ip"
}

# 检测端口是否被占用
is_port_used() {
    local port=$1
    if command_exists lsof; then
        lsof -i :$port >/dev/null 2>&1
    elif command_exists ss; then
        ss -tuln | grep -q ":$port "
    else
        return 1
    fi
}

# 查找可用端口
find_available_port() {
    local port=3000
    while is_port_used $port; do
        port=$((port + 1))
    done
    echo $port
}

# 静默读取密码
read_secret() {
    local prompt="$1"
    local var_name="$2"
    echo -n "$prompt"
    trap 'stty echo 2>/dev/null' EXIT INT TERM
    stty -echo 2>/dev/null
    read -r "$var_name"
    stty echo 2>/dev/null
    trap - EXIT INT TERM
    echo ""
}

# 生成随机密钥
generate_secret() {
    if command_exists openssl; then
        openssl rand -base64 32 | tr -d '\n'
    elif [ -r /dev/urandom ]; then
        head -c 32 /dev/urandom | base64 | tr -d '\n'
    else
        date +%s | sha256sum | cut -d' ' -f1 | base64 | head -c 32
    fi
}

# ============================================================
# Step 0: 依赖检测
# ============================================================
check_dependencies() {
    echo ""
    echo "=========================================="
    echo " U-Plus-Lite 部署脚本"
    echo "=========================================="
    echo ""
    echo "正在检测系统依赖..."
    echo ""

    local missing=()
    local need_install=()

    # 检测 Git
    if command_exists git; then
        local git_version
        git_version=$(git --version | sed 's/git version //')
        print_status "ok" "Git: $git_version"
    else
        print_status "fail" "Git: 未安装"
        missing+=("git")
    fi

    # 检测 Node.js
    if command_exists node; then
        local node_version
        node_version=$(node -v)
        local major_version
        major_version=$(echo $node_version | sed 's/v\([0-9]*\)\..*/\1/')
        if [ "$major_version" -ge 18 ]; then
            print_status "ok" "Node.js: $node_version"
        else
            print_status "fail" "Node.js: $node_version (需要 v18+)"
            missing+=("node")
        fi
    else
        print_status "fail" "Node.js: 未安装"
        missing+=("node")
    fi

    # 检测 PM2
    if command_exists pm2; then
        print_status "ok" "PM2: 已安装"
    else
        print_status "fail" "PM2: 未安装"
        need_install+=("pm2")
    fi

    # 如果 Git 缺失，退出
    if [[ " ${missing[*]} " =~ " git " ]]; then
        echo ""
        echo -e "${RED}Git 是必需依赖，请先安装后再运行本脚本${NC}"
        echo ""
        echo "macOS 安装方法："
        echo "  xcode-select --install"
        echo ""
        echo "Linux 安装方法："
        echo "  sudo apt-get install git  # Debian/Ubuntu"
        echo "  sudo yum install git      # CentOS/RHEL"
        echo ""
        exit 1
    fi

    # 如果 Node 缺失，尝试自动安装
    if [[ " ${missing[*]} " =~ " node " ]]; then
        echo ""
        echo -e "${YELLOW}检测到 Node.js 未安装，正在尝试自动安装...${NC}"
        echo ""

        if command_exists brew; then
            brew install node
        elif command_exists apt-get; then
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command_exists yum; then
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            sudo yum install -y nodejs
        else
            echo ""
            echo -e "${RED}无法自动安装 Node.js，请手动安装后重试${NC}"
            echo "下载地址: https://nodejs.org/"
            exit 1
        fi

        if command_exists node; then
            print_status "ok" "Node.js 安装成功: $(node -v)"
        else
            echo -e "${RED}Node.js 安装失败，请手动安装后重试${NC}"
            exit 1
        fi
    fi

    # 如果 PM2 缺失，自动安装
    if [[ " ${need_install[*]} " =~ " pm2 " ]]; then
        echo ""
        echo "正在安装 PM2..."
        npm install -g pm2 --silent
        if command_exists pm2; then
            print_status "ok" "PM2 安装成功"
        else
            print_status "fail" "PM2 安装失败"
            exit 1
        fi
    fi

    echo ""
    echo -e "${GREEN}所有依赖检测通过！${NC}"
}

# ============================================================
# 获取最新版本
# ============================================================
fetch_latest_version() {
    echo ""
    echo "正在检查最新版本..."

    local response
    response=$(curl -fsSL "https://api.github.com/repos/TengShao/u-plus-lite/releases/latest" 2>/dev/null)

    if [ -n "$response" ]; then
        LATEST_VERSION=$(echo "$response" | grep '"tag_name"' | sed 's/.*"v\?\([^"]*\)".*/\1/' | tr -d ' ')
        if [ -z "$LATEST_VERSION" ]; then
            LATEST_VERSION="unknown"
            print_status "warn" "无法解析最新版本号"
        else
            print_status "ok" "最新版本: v$LATEST_VERSION"
        fi
    else
        LATEST_VERSION="unknown"
        print_status "warn" "无法获取最新版本（网络问题）"
    fi
}

# ============================================================
# 检测部署状态
# ============================================================
detect_deployment() {
    echo ""
    echo "=========================================="
    echo " 检测现有部署"
    echo "=========================================="
    echo ""

    if [ -d "$DEFAULT_DIR/.git" ]; then
        DEPLOY_MODE="update"
        DEPLOY_DIR="$DEFAULT_DIR"
        echo "检测到已有部署: $DEPLOY_DIR"
    else
        echo "未检测到现有部署"
        echo ""
        echo "请选择部署模式："
        echo "  1 - 全新部署（克隆最新代码）"
        echo "  2 - 指定已有目录（需为 Git 仓库）"
        echo ""
        echo -n "请选择 [1]: "
        read -r choice
        choice=${choice:-1}

        if [ "$choice" = "1" ]; then
            DEPLOY_MODE="new"
            DEPLOY_DIR="$DEFAULT_DIR"
        else
            echo -n "请输入已有项目路径: "
            read -r custom_path
            custom_path=$(eval echo "$custom_path")

            if [ ! -d "$custom_path/.git" ]; then
                echo -e "${RED}错误：$custom_path 不是 Git 仓库${NC}"
                exit 1
            fi

            DEPLOY_MODE="update"
            DEPLOY_DIR="$custom_path"
        fi
    fi

    PROJECT_ROOT="$DEPLOY_DIR"
    echo "部署目录: $DEPLOY_DIR"
    echo "部署模式: $DEPLOY_MODE"
}

# ============================================================
# 写入内嵌的 seed.ts 和 import.ts
# ============================================================
write_helper_scripts() {
    # seed.ts - 支持命令行参数
    cat > "$PROJECT_ROOT/prisma/seed.ts" << 'SEED_EOF'
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
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
SEED_EOF

    # import.ts - CSV 导入脚本
    cat > "$PROJECT_ROOT/prisma/import.ts" << 'IMPORT_EOF'
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

    echo "辅助脚本已写入"
}

# ============================================================
# CSV 导入
# ============================================================
import_csv_data() {
    echo ""
    echo "=========================================="
    echo " CSV 数据导入"
    echo "=========================================="
    echo ""
    echo "请选择导入方式："
    echo "  1 - 指定 CSV 文件路径"
    echo "  2 - 直接粘贴 CSV 内容"
    echo "  3 - 跳过（稍后通过 Web 端手动添加）"
    echo ""
    echo -n "请选择 [3]: "
    read -r choice
    choice=${choice:-3}

    if [ "$choice" = "1" ]; then
        echo ""
        echo "请输入管线名称文件路径（CSV格式）: "
        echo "  格式：每行一个管线名称，如："
        echo "    UGC研发"
        echo "    UGC运营"
        echo ""
        echo -n "文件路径（直接回车跳过）: "
        read -r pipelines_path

        echo ""
        echo "请输入预算项文件路径（CSV格式）: "
        echo "  格式：管线名称,预算项名称，如："
        echo "    UGC研发,UGC商业化功能"
        echo "    UGC运营,乐园会员体系"
        echo ""
        echo -n "文件路径（直接回车跳过）: "
        read -r budget_path

        local cmd_args=""
        if [ -n "$pipelines_path" ]; then
            cmd_args="$cmd_args --pipelines=$pipelines_path"
        fi
        if [ -n "$budget_path" ]; then
            cmd_args="$cmd_args --budget-items=$budget_path"
        fi

        if [ -n "$cmd_args" ]; then
            echo ""
            echo "正在导入数据..."
            npx tsx "$PROJECT_ROOT/prisma/import.ts" $cmd_args
        else
            echo "未指定文件，跳过导入"
        fi

    elif [ "$choice" = "2" ]; then
        echo ""
        echo "请粘贴管线名称文件内容（每行一个名称，Ctrl+D 结束）: "
        local pipelines_content
        pipelines_content=$(cat)
        echo ""
        echo "请粘贴预算项文件内容（格式：管线名称,预算项名称，Ctrl+D 结束）: "
        local budget_content
        budget_content=$(cat)

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
# 全新部署
# ============================================================
deploy_new() {
    echo ""
    echo "=========================================="
    echo " 开始全新部署"
    echo "=========================================="
    echo ""

    cd "$PROJECT_ROOT"

    # [1/9] Git Clone
    echo "[1/9] 正在克隆代码仓库..."
    if [ -d "$DEPLOY_DIR" ]; then
        echo -e "${YELLOW}警告：$DEPLOY_DIR 目录已存在${NC}"
        echo -n "是否删除并重新克隆？ [y/N]: "
        read -r confirm
        confirm=${confirm:-N}
        if [ "$(echo "$confirm" | tr '[:upper:]' '[:lower:]')" = "y" ]; then
            rm -rf "$DEPLOY_DIR"
            if ! git clone "$REPO_URL" "$DEPLOY_DIR"; then
                print_status "fail" "Git clone 失败"
                exit 1
            fi
        else
            echo "部署取消"
            exit 1
        fi
    else
        if ! git clone "$REPO_URL" "$DEPLOY_DIR"; then
            print_status "fail" "Git clone 失败"
            exit 1
        fi
    fi
    cd "$DEPLOY_DIR"
    write_helper_scripts

    # [2/9] npm install
    echo ""
    echo "[2/9] 正在安装依赖..."
    if ! npm install; then
        print_status "fail" "npm install 失败"
        exit 1
    fi

    # [3/9] Prisma
    echo ""
    echo "[3/9] 正在初始化数据库..."
    npx prisma generate
    npx prisma db push --accept-data-loss

    # [4/9] 创建管理员
    echo ""
    echo "[4/9] 创建管理员账号"
    echo ""

    local admin_name=""
    local admin_password=""
    local admin_password_confirm=""

    read -p "  管理员姓名: " admin_name
    while [ -z "$admin_name" ]; do
        echo "  错误：管理员姓名不能为空"
        read -p "  管理员姓名: " admin_name
    done

    read_secret "  密码（至少8位）: " admin_password
    while [ -z "$admin_password" ]; do
        echo "  错误：密码不能为空"
        read_secret "  密码（至少8位）: " admin_password
    done

    while [ ${#admin_password} -lt 8 ]; do
        echo "  错误：密码至少8位"
        read_secret "  密码（至少8位）: " admin_password
    done

    read_secret "  确认密码: " admin_password_confirm
    while [ "$admin_password" != "$admin_password_confirm" ]; do
        echo "  错误：两次输入的密码不一致"
        read_secret "  密码（至少8位）: " admin_password
        while [ ${#admin_password} -lt 8 ]; do
            echo "  错误：密码至少8位"
            read_secret "  密码（至少8位）: " admin_password
        done
        read_secret "  确认密码: " admin_password_confirm
    done
    while [ ${#admin_password} -lt 8 ]; do
        echo "  错误：密码至少8位"
        read_secret "  密码（至少8位）: " admin_password
    done

    npx tsx "$PROJECT_ROOT/prisma/seed.ts" "$admin_name" "$admin_password"

    # [5/9] 配置 .env
    echo ""
    echo "[5/9] 配置环境变量..."

    local local_ip
    local_ip=$(get_local_ip)
    echo "检测到本机局域网 IP: $local_ip"

    # 端口配置
    if is_port_used 3000; then
        echo ""
        echo -e "${YELLOW}端口 3000 已被占用${NC}"
        echo "  1 - 帮我释放 3000 端口"
        echo "  2 - 查找下一个可用端口（注意：可能影响正在使用的用户）"
        echo ""
        echo -n "请选择 [1]: "
        read -r port_choice
        port_choice=${port_choice:-1}

        if [ "$port_choice" = "1" ]; then
            lsof -ti:3000 | xargs kill
            echo "端口 3000 已释放"
            PORT=3000
        else
            PORT=$(find_available_port)
            echo "使用端口: $PORT"
        fi
    else
        PORT=3000
    fi

    local nextauth_secret
    nextauth_secret=$(generate_secret)

    cat > .env << EOF
DATABASE_URL="file:$DEPLOY_DIR/prisma/prod.db"
NEXTAUTH_SECRET="$nextauth_secret"
NEXTAUTH_URL="http://$local_ip:$PORT"
EOF

    echo ".env 文件已创建"

    # [6/9] Build
    echo ""
    echo "[6/9] 正在构建生产版本..."
    if ! npm run build; then
        print_status "fail" "npm run build 失败"
        exit 1
    fi

    # [7/9] PM2 启动
    echo ""
    echo "[7/9] 配置 PM2 服务..."

    pm2 delete u-plus-lite 2>/dev/null || true
    PORT=$PORT pm2 start npm --name u-plus-lite -- start
    pm2 save

    # [8/9] 写入版本文件
    echo ""
    echo "[8/9] 保存版本信息..."
    echo "v$LATEST_VERSION" > version.txt

    # [9/9] CSV 导入
    echo ""
    echo "[9/9] CSV 数据导入..."
    import_csv_data

    # 自启配置
    echo ""
    echo "是否配置开机自启？[Y/n]: "
    read -r enable_autostart
    enable_autostart=${enable_autostart:-Y}
    if [ "$(echo "$enable_autostart" | tr '[:upper:]' '[:lower:]')" = "y" ]; then
        echo "（可能需要输入本机管理员密码）"
        env PATH="$PATH:/usr/local/bin" pm2 startup 2>/dev/null || true
    fi

    # 显示完成信息
    show_complete "$admin_name"
}

# ============================================================
# 更新部署
# ============================================================
deploy_update() {
    echo ""
    echo "=========================================="
    echo " 更新部署"
    echo "=========================================="
    echo ""

    cd "$PROJECT_ROOT"

    # 读取本地版本
    if [ -f "version.txt" ]; then
        LOCAL_VERSION=$(cat version.txt | tr -d ' \n')
    else
        LOCAL_VERSION="unknown"
    fi

    echo "当前版本: $LOCAL_VERSION"
    echo "最新版本: v$LATEST_VERSION"
    echo ""

    echo "请选择操作："
    echo "  1 - 更新（推荐）"
    echo "  2 - 卸载"
    echo "  3 - 重新安装"
    echo ""
    echo -n "请选择 [1]: "
    read -r update_choice
    update_choice=${update_choice:-1}

    if [ "$update_choice" = "1" ]; then
        do_update
    elif [ "$update_choice" = "2" ]; then
        do_uninstall
    elif [ "$update_choice" = "3" ]; then
        do_uninstall
        DEPLOY_MODE="new"
        DEPLOY_DIR="$DEFAULT_DIR"
        PROJECT_ROOT="$DEPLOY_DIR"
        deploy_new
    else
        echo "无效选择，取消操作"
        exit 1
    fi
}

# ============================================================
# 执行更新
# ============================================================
do_update() {
    echo ""
    echo "正在更新..."

    # 保存旧版本信息用于对比
    local old_package_lock=""
    local old_schema=""
    if [ -f "package-lock.json" ]; then
        old_package_lock=$(md5sum package-lock.json 2>/dev/null || cat package-lock.json | md5)
    fi
    if [ -f "prisma/schema.prisma" ]; then
        old_schema=$(md5sum prisma/schema.prisma 2>/dev/null || cat prisma/schema.prisma | md5)
    fi

    # Git fetch and pull
    echo "正在拉取最新代码..."
    if ! git fetch origin; then
        print_status "fail" "Git fetch 失败"
        exit 1
    fi
    if ! git pull origin master; then
        print_status "fail" "Git pull 失败"
        exit 1
    fi

    # 检查 package-lock.json 变化
    local need_npm_install=false
    if [ -f "package-lock.json" ]; then
        local new_package_lock
        new_package_lock=$(md5sum package-lock.json 2>/dev/null || cat package-lock.json | md5)
        if [ "$old_package_lock" != "$new_package_lock" ]; then
            local lines_diff
            lines_diff=$(diff <(echo "$old_package_lock") <(echo "$new_package_lock") | wc -l)
            if [ "$lines_diff" -gt 5 ]; then
                need_npm_install=true
            fi
        fi
    fi

    # 检查 schema.prisma 变化
    local need_prisma=false
    if [ -f "prisma/schema.prisma" ]; then
        local new_schema
        new_schema=$(md5sum prisma/schema.prisma 2>/dev/null || cat prisma/schema.prisma | md5)
        if [ "$old_schema" != "$new_schema" ]; then
            need_prisma=true
        fi
    fi

    # 智能构建
    echo ""
    if [ "$need_npm_install" = true ]; then
        echo "检测到依赖变化，正在安装依赖..."
        npm install
    else
        echo "依赖无变化，跳过 npm install"
    fi

    if [ "$need_prisma" = true ]; then
        echo "检测到数据库结构变化，正在更新数据库..."
        npx prisma generate
        npx prisma db push --accept-data-loss
    fi

    # 写入辅助脚本
    write_helper_scripts

    # 构建
    echo ""
    echo "正在构建..."
    if ! npm run build; then
        print_status "fail" "npm run build 失败"
        exit 1
    fi

    # 重启 PM2
    echo ""
    echo "正在重启服务..."
    pm2 restart u-plus-lite

    # 更新版本文件
    echo "v$LATEST_VERSION" > version.txt

    echo ""
    print_status "ok" "更新完成"
    show_complete ""
}

# ============================================================
# 执行卸载
# ============================================================
do_uninstall() {
    echo ""
    echo -e "${RED}警告：即将卸载 U-Plus-Lite${NC}"
    echo ""
    echo "此操作将："
    echo "  1. 删除 PM2 服务"
    echo "  2. 删除部署目录: $DEPLOY_DIR"
    echo ""
    echo -n "确认卸载？请输入 YES: "
    read -r confirm

    if [ "$confirm" != "YES" ]; then
        echo "取消卸载操作"
        exit 0
    fi

    echo ""
    echo "正在卸载..."
    pm2 delete u-plus-lite 2>/dev/null || true
    rm -rf "$DEPLOY_DIR"
    print_status "ok" "卸载完成"
}

# ============================================================
# 显示完成信息
# ============================================================
show_complete() {
    local admin_name="$1"
    local local_ip
    local_ip=$(get_local_ip)

    echo ""
    echo "=========================================="
    echo -e " ${GREEN}部署完成！${NC}"
    echo "=========================================="
    echo ""
    echo -e "访问地址: ${GREEN}http://$local_ip:$PORT${NC}"
    echo ""

    if [ -n "$admin_name" ]; then
        echo "管理员账号: $admin_name"
    else
        echo "管理员账号: （沿用之前设置）"
    fi
    echo "管理员密码: （沿用之前设置）"

    echo ""
    echo "常用命令："
    echo "  pm2 status                查看状态"
    echo "  pm2 logs u-plus-lite      查看日志"
    echo "  pm2 restart u-plus-lite   重启服务"
    echo "  pm2 monit                 实时监控"
    echo "=========================================="
}

# ============================================================
# 主流程
# ============================================================
main() {
    check_dependencies
    fetch_latest_version
    detect_deployment

    if [ "$DEPLOY_MODE" = "new" ]; then
        deploy_new
    else
        deploy_update
    fi
}

main "$@"
