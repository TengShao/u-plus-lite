#!/bin/bash
set -euo pipefail

REPO_SLUG="TengShao/u-plus-lite"
RELEASE_API_URL="https://api.github.com/repos/${REPO_SLUG}/releases/latest"
DEFAULT_DIR="$HOME/u-plus-lite"
DEPLOY_DIR=""
DEPLOY_MODE=""
PROJECT_ROOT=""
LATEST_VERSION="unknown"
RELEASE_URL=""
PORT=3000
RUNTIME_DIR=""
SCRIPT_SOURCE_ROOT=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

print_status() {
    local kind=$1
    local msg=$2
    if [ "$kind" = "ok" ]; then
        echo -e "${GREEN}[✓]${NC} $msg"
    elif [ "$kind" = "fail" ]; then
        echo -e "${RED}[✗]${NC} $msg"
    else
        echo -e "${YELLOW}[!]${NC} $msg"
    fi
}

get_local_ip() {
    local ip=""
    if command_exists ipconfig; then
        ip=$(ipconfig getifaddr en0 2>/dev/null || true)
        [ -z "$ip" ] && ip=$(ipconfig getifaddr en1 2>/dev/null || true)
    fi
    if [ -z "$ip" ] && command_exists hostname; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    [ -z "$ip" ] && ip=$(hostname 2>/dev/null || echo "127.0.0.1")
    echo "$ip"
}

is_port_used() {
    local port=$1
    if command_exists lsof; then
        lsof -i :"$port" >/dev/null 2>&1
    elif command_exists ss; then
        ss -tuln | grep -q ":$port "
    else
        return 1
    fi
}

find_available_port() {
    local port=3000
    while is_port_used "$port"; do
        port=$((port + 1))
    done
    echo "$port"
}

read_secret() {
    local prompt="$1"
    local var_name="$2"
    printf '%s' "$prompt"
    read -s -r "$var_name"
    printf '\n'
}

resolve_cli_helper() {
    local script_dir
    script_dir="$(cd "$(dirname "$0")" && pwd)"
    if [ -f "$script_dir/interactive/index.cjs" ]; then
        echo "$script_dir/interactive/index.cjs"
    fi
}

cli_helper_available() {
    local helper
    helper="$(resolve_cli_helper)"
    [ -n "$helper" ] && command_exists node && [ -t 0 ] && [ -t 2 ]
}

cli_select() {
    local message="$1"
    local default_value="$2"
    local allow_cancel="$3"
    shift 3

    if cli_helper_available; then
        local helper
        helper="$(resolve_cli_helper)"
        local serialized=""
        local pair
        for pair in "$@"; do
            local value="${pair%%|*}"
            local label="${pair#*|}"
            serialized+="${value}"$'\t'"${label}"$'\n'
        done

        local result
        result="$(CLI_MESSAGE="$message" CLI_DEFAULT="$default_value" CLI_CHOICES="$serialized" node "$helper" select)"
        local status=$?
        if [ $status -eq 0 ]; then
            printf '%s' "$result"
            return 0
        fi
        if [ $status -eq 130 ] && [ "$allow_cancel" = "1" ]; then
            return 130
        fi
    fi

    printf '%s\n' "$message" >&2
    local pair
    for pair in "$@"; do
        local value="${pair%%|*}"
        local label="${pair#*|}"
        printf '  %s - %s\n' "$value" "$label" >&2
    done
    printf '\n' >&2
    if [ "$allow_cancel" = "1" ]; then
        printf '请选择（直接回车选择 %s，输入 q 退出）: ' "$default_value" >&2
    else
        printf '请选择（直接回车选择 %s）: ' "$default_value" >&2
    fi

    local result
    read -r result
    result=${result:-$default_value}
    if [ "$allow_cancel" = "1" ] && { [ "$result" = "q" ] || [ "$result" = "Q" ]; }; then
        return 130
    fi
    printf '%s' "$result"
}

cli_confirm() {
    local message="$1"
    local default_choice="$2"
    cli_select "$message" "$default_choice" "1" "true|是" "false|否"
}

generate_secret() {
    if command_exists openssl; then
        openssl rand -base64 32 | tr -d '\n'
    elif [ -r /dev/urandom ]; then
        head -c 32 /dev/urandom | base64 | tr -d '\n'
    else
        date +%s | shasum -a 256 | awk '{print $1}' | base64 | head -c 32
    fi
}

cleanup_runtime_dir() {
    if [ -n "${RUNTIME_DIR:-}" ] && [ -d "$RUNTIME_DIR" ]; then
        rm -rf "$RUNTIME_DIR"
    fi
}

create_runtime_helpers() {
    local project_dir="$1"
    cleanup_runtime_dir
    RUNTIME_DIR="$(mktemp -d "${TMPDIR:-/tmp}/u-plus-lite-runtime.XXXXXX")"

    cat > "$RUNTIME_DIR/seed.cjs" <<'SEED_EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const resetMode = args.includes('--reset');
  const filteredArgs = args.filter((arg) => arg !== '--reset');
  const [providedName, providedPassword] = filteredArgs;

  if (resetMode) {
    await prisma.user.deleteMany({ where: { role: 'ADMIN' } });
    console.log('已删除所有管理员账号');
  }

  if (providedName && providedPassword) {
    const hashedPassword = await bcrypt.hash(providedPassword, 10);
    await prisma.user.upsert({
      where: { name: providedName },
      update: {},
      create: {
        name: providedName,
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log(`Seed complete: admin user "${providedName}" created`);
    return;
  }

  const hashedPassword = await bcrypt.hash('88888888', 10);
  await prisma.user.upsert({
    where: { name: '邵腾' },
    update: {},
    create: {
      name: '邵腾',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  console.log('Seed complete: admin user "邵腾" created (default)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
SEED_EOF

    cat > "$RUNTIME_DIR/import.cjs" <<'IMPORT_EOF'
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const readline = require('readline');

const prisma = new PrismaClient();

function parseArgs() {
  const args = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg.startsWith('--pipelines=')) args.pipelines = arg.replace('--pipelines=', '');
    if (arg.startsWith('--budget-items=')) args.budgetItems = arg.replace('--budget-items=', '');
  }
  return args;
}

async function readCsvLines(input) {
  if (input === '-') {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    const lines = [];
    for await (const line of rl) lines.push(line);
    return lines;
  }

  if (!fs.existsSync(input)) {
    console.error(`文件不存在: ${input}`);
    process.exit(1);
  }

  return fs.readFileSync(input, 'utf8').split('\n').filter((line) => line.trim());
}

function parsePipelinesCsv(lines) {
  if (lines.length < 2) return [];
  return lines.slice(1).filter((line) => line.trim());
}

function parseBudgetItemsCsv(lines) {
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const firstComma = line.indexOf(',');
    if (firstComma === -1) return { pipeline: '', name: line.trim() };
    return {
      pipeline: line.slice(0, firstComma).trim(),
      name: line.slice(firstComma + 1).split(',')[0].trim(),
    };
  });
}

async function ensureOtherPipeline() {
  const existing = await prisma.pipelineSetting.findUnique({ where: { name: '其他' } });
  if (existing) return existing.id;
  const created = await prisma.pipelineSetting.create({ data: { name: '其他' } });
  console.log('  自动创建"其他"管线');
  return created.id;
}

async function importPipelines(args) {
  if (!args.pipelines) {
    console.log('跳过管线导入（未指定 --pipelines）');
    return;
  }

  const lines = await readCsvLines(args.pipelines);
  const names = parsePipelinesCsv(lines);
  if (names.length === 0) {
    console.log('pipelines.csv 为空，跳过');
    return;
  }

  let created = 0;
  let skipped = 0;
  for (const name of names) {
    if (!name.trim()) continue;
    const existing = await prisma.pipelineSetting.findUnique({ where: { name } });
    if (existing) skipped += 1;
    else {
      await prisma.pipelineSetting.create({ data: { name } });
      created += 1;
    }
  }
  console.log(`管线导入完成：跳过 ${skipped}，已创建 ${created}`);
}

async function importBudgetItems(args) {
  if (!args.budgetItems) {
    console.log('跳过预算项导入（未指定 --budget-items）');
    return;
  }

  const otherPipelineId = await ensureOtherPipeline();
  const lines = await readCsvLines(args.budgetItems);
  const items = parseBudgetItemsCsv(lines);
  if (items.length === 0) {
    console.log('budget_items.csv 为空，跳过');
    return;
  }

  const pipelineMap = new Map();
  const allPipelines = await prisma.pipelineSetting.findMany();
  for (const pipeline of allPipelines) pipelineMap.set(pipeline.name, pipeline.id);

  let created = 0;
  let skipped = 0;
  for (const item of items) {
    if (!item.name.trim()) continue;

    let pipelineId = item.pipeline ? pipelineMap.get(item.pipeline) : undefined;
    if (!pipelineId) {
      if (item.pipeline) {
        const createdPipeline = await prisma.pipelineSetting.create({ data: { name: item.pipeline } });
        pipelineMap.set(item.pipeline, createdPipeline.id);
        pipelineId = createdPipeline.id;
        console.log(`  自动创建管线: ${item.pipeline}`);
      } else {
        pipelineId = otherPipelineId;
      }
    }

    const existing = await prisma.budgetItemSetting.findFirst({
      where: { pipelineId, name: item.name },
    });
    if (existing) skipped += 1;
    else {
      await prisma.budgetItemSetting.create({ data: { pipelineId, name: item.name } });
      created += 1;
    }
  }
  console.log(`预算项导入完成：跳过 ${skipped}，已创建 ${created}`);
}

async function main() {
  const args = parseArgs();
  console.log('');
  await importPipelines(args);
  await importBudgetItems(args);
  console.log('');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
IMPORT_EOF

    export NODE_PATH="${project_dir}/node_modules"
}

run_runtime_seed() {
    local project_dir="$1"
    shift
    create_runtime_helpers "$project_dir"
    NODE_PATH="${project_dir}/node_modules" node "$RUNTIME_DIR/seed.cjs" "$@"
}

run_runtime_import() {
    local project_dir="$1"
    shift
    create_runtime_helpers "$project_dir"
    NODE_PATH="${project_dir}/node_modules" node "$RUNTIME_DIR/import.cjs" "$@"
}

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

    if command_exists curl; then
        print_status "ok" "curl: 已安装"
    else
        print_status "fail" "curl: 未安装"
        missing+=("curl")
    fi

    if command_exists tar; then
        print_status "ok" "tar: 已安装"
    else
        print_status "fail" "tar: 未安装"
        missing+=("tar")
    fi

    if command_exists node; then
        local node_version
        node_version=$(node -v)
        local major_version
        major_version=$(echo "$node_version" | sed 's/v\([0-9]*\)\..*/\1/')
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

    if command_exists pm2; then
        print_status "ok" "PM2: 已安装"
    else
        print_status "fail" "PM2: 未安装"
        need_install+=("pm2")
    fi

    local missing_items="${missing[*]-}"
    local need_install_items="${need_install[*]-}"

    if [[ " ${missing_items} " =~ " curl " ]] || [[ " ${missing_items} " =~ " tar " ]]; then
        echo ""
        echo -e "${RED}缺少必需系统依赖，请先安装后重试${NC}"
        printf '缺少依赖: %s\n' "$missing_items"
        exit 1
    fi

    if [[ " ${missing_items} " =~ " node " ]]; then
        echo ""
        echo -e "${YELLOW}检测到 Node.js 未安装，正在尝试自动安装...${NC}"
        local install_ok=true
        if command_exists brew; then
            brew install node || install_ok=false
        elif command_exists apt-get; then
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs || install_ok=false
        elif command_exists yum; then
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo yum install -y nodejs || install_ok=false
        else
            install_ok=false
        fi

        if [ "$install_ok" = "true" ] && command_exists node; then
            print_status "ok" "Node.js 安装成功: $(node -v)"
        else
            print_status "fail" "无法自动安装 Node.js，请手动安装后重试"
            exit 1
        fi
    fi

    if [[ " ${need_install_items} " =~ " pm2 " ]]; then
        echo ""
        echo "正在安装 PM2..."
        if npm install -g pm2 --silent 2>&1; then
            print_status "ok" "PM2 安装成功"
        else
            print_status "fail" "PM2 安装失败，请手动执行: npm install -g pm2"
            exit 1
        fi
    fi

    echo ""
    echo -e "${GREEN}所有依赖检测通过！${NC}"
}

is_source_repo() {
    local dir="$1"
    [ -d "$dir/.git" ] &&
    [ -f "$dir/package.json" ] &&
    [ -f "$dir/prisma/schema.prisma" ] &&
    [ -d "$dir/src/app" ] &&
    [ -f "$dir/deploy/deploy.sh" ]
}

is_deployment_instance() {
    local dir="$1"
    [ -d "$dir" ] || return 1
    is_source_repo "$dir" && return 1
    [ -f "$dir/package.json" ] || return 1
    [ -d "$dir/prisma" ] || return 1
    [ -f "$dir/.env.local" ] || [ -f "$dir/version.txt" ]
}

fetch_latest_release_info() {
    echo ""
    echo "正在检查最新版本..."

    local response
    response=$(curl -fsSL "$RELEASE_API_URL" 2>/dev/null) || true
    if [ -z "$response" ]; then
        print_status "fail" "无法获取最新版本信息"
        exit 1
    fi

    local parsed
    parsed=$(printf '%s' "$response" | node -e '
let input="";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const data = JSON.parse(input);
  const version = (data.tag_name || "").replace(/^v/, "");
  const asset = (data.assets || []).find(item => item.name === `u-plus-lite-v${version}-macos-linux.tar.gz`);
  if (!version || !asset) process.exit(2);
  console.log(version);
  console.log(asset.browser_download_url || "");
});
') || true

    if [ -z "$parsed" ]; then
        print_status "fail" "最新 release 缺少可用部署包"
        exit 1
    fi

    LATEST_VERSION=$(printf '%s\n' "$parsed" | sed -n '1p')
    RELEASE_URL=$(printf '%s\n' "$parsed" | sed -n '2p')

    if [ -z "$LATEST_VERSION" ] || [ -z "$RELEASE_URL" ]; then
        print_status "fail" "release 解析失败"
        exit 1
    fi

    print_status "ok" "最新版本: v$LATEST_VERSION"
}

current_deployed_version() {
    local dir="$1"
    if [ -f "$dir/version.txt" ]; then
        cat "$dir/version.txt" | tr -d ' \n'
    else
        echo "unknown"
    fi
}

download_release_archive() {
    local url="$1"
    local output="$2"
    curl -fL "$url" -o "$output"
}

extract_release_archive() {
    local archive="$1"
    local destination="$2"
    mkdir -p "$destination"
    tar -xzf "$archive" -C "$destination"
}

sync_release_contents() {
    local source_dir="$1"
    local target_dir="$2"
    mkdir -p "$target_dir"

    if command_exists rsync; then
        rsync -a --delete \
            --exclude '.env.local' \
            --exclude 'version.txt' \
            --exclude 'prisma/prod.db' \
            --exclude 'prisma/dev.db' \
            "$source_dir"/ "$target_dir"/
        return
    fi

    print_status "warn" "未检测到 rsync，将使用非删除式文件覆盖"
    (cd "$source_dir" && tar -cf - .) | (cd "$target_dir" && tar -xf -)
}

install_runtime_dependencies() {
    local project_dir="$1"
    (cd "$project_dir" && npm install --omit=dev)
}

initialize_database() {
    local project_dir="$1"
    (cd "$project_dir" && DATABASE_URL="file:${project_dir}/prisma/prod.db" npx prisma generate)
    (cd "$project_dir" && DATABASE_URL="file:${project_dir}/prisma/prod.db" npx prisma db push --accept-data-loss)
}

write_env_file() {
    local project_dir="$1"
    local port="$2"
    local local_ip
    local_ip=$(get_local_ip)
    local nextauth_secret
    nextauth_secret=$(generate_secret)

    cat > "$project_dir/.env.local" <<EOF
DATABASE_URL="file:${project_dir}/prisma/prod.db"
NEXTAUTH_SECRET="$nextauth_secret"
NEXTAUTH_URL="http://${local_ip}:${port}"
NEXT_PUBLIC_LLM_PROVIDER=ollama
NEXT_PUBLIC_OLLAMA_MODEL=qwen3:4b
EOF
    echo ".env.local 文件已创建"
}

download_and_extract_latest_release() {
    local temp_root="$1"
    local extract_dir="$2"
    local archive="$temp_root/release.tar.gz"
    download_release_archive "$RELEASE_URL" "$archive"
    extract_release_archive "$archive" "$extract_dir"
}

detect_deployment() {
    echo ""
    echo "=========================================="
    echo " 检测现有部署"
    echo "=========================================="
    echo ""

    local script_path
    script_path="$(cd "$(dirname "$0")" && pwd)"
    local script_parent
    script_parent="$(dirname "$script_path")"
    SCRIPT_SOURCE_ROOT="$script_parent"

    if is_source_repo "$script_parent"; then
        print_status "warn" "检测到当前目录是源码仓库，仅作为脚本来源，不作为部署目录"
    fi

    if is_deployment_instance "$DEFAULT_DIR"; then
        DEPLOY_MODE="update"
        DEPLOY_DIR="$DEFAULT_DIR"
        echo "检测到已有部署: $DEPLOY_DIR"
    else
        echo "默认路径 (${DEFAULT_DIR}) 未检测到现有部署"
        echo ""
        local choice
        choice="$(cli_select "请选择部署模式：" "1" "1" "1|全新部署" "2|指定已部署路径")"
        local choice_status=$?
        if [ $choice_status -eq 130 ]; then
            echo "已取消部署"
            exit 0
        fi
        if [ $choice_status -ne 0 ]; then
            echo "部署模式选择失败"
            exit 1
        fi

        if [ "$choice" = "1" ]; then
            DEPLOY_MODE="new"
            echo -n "请输入部署目录路径（直接回车使用 ${DEFAULT_DIR}，输入 q 退出）: "
            read -r custom_path
            if [ "$custom_path" = "q" ] || [ "$custom_path" = "Q" ]; then
                echo "已取消部署"
                exit 0
            fi
            custom_path=${custom_path:-$DEFAULT_DIR}
            custom_path=$(eval echo "$custom_path")
            [[ "$custom_path" != */u-plus-lite ]] && custom_path="$custom_path/u-plus-lite"
            DEPLOY_DIR="$custom_path"
        else
            while true; do
                echo -n "请输入已有部署路径（输入 q 退出）: "
                read -r custom_path
                if [ "$custom_path" = "q" ] || [ "$custom_path" = "Q" ]; then
                    echo "已取消部署"
                    exit 0
                fi
                custom_path=$(eval echo "$custom_path")
                if is_deployment_instance "$custom_path"; then
                    DEPLOY_MODE="update"
                    DEPLOY_DIR="$custom_path"
                    break
                else
                    echo -e "${RED}错误：$custom_path 不是有效的部署目录${NC}"
                fi
            done
        fi
    fi

    PROJECT_ROOT="$DEPLOY_DIR"
    echo "部署目录: $DEPLOY_DIR"
    echo "部署模式: ${DEPLOY_MODE:-update}"
}

import_csv_data() {
    echo ""
    echo "=========================================="
    echo " CSV 数据导入"
    echo "=========================================="
    echo ""

    local choice
    choice="$(cli_select "请选择导入方式：" "3" "1" "1|指定 CSV 文件路径" "2|直接粘贴 CSV 内容" "3|跳过（稍后通过 Web 端手动添加）")"
    local choice_status=$?
    if [ $choice_status -eq 130 ]; then
        echo "已取消部署"
        exit 0
    fi
    if [ $choice_status -ne 0 ]; then
        echo "CSV 导入方式选择失败"
        exit 1
    fi

    if [ "$choice" = "1" ]; then
        echo ""
        echo -n "管线 CSV 文件路径（直接回车跳过，输入 q 退出）: "
        read -r pipelines_path
        [ "$pipelines_path" = "q" ] || [ "$pipelines_path" = "Q" ] && exit 0

        echo -n "预算项 CSV 文件路径（直接回车跳过，输入 q 退出）: "
        read -r budget_path
        [ "$budget_path" = "q" ] || [ "$budget_path" = "Q" ] && exit 0

        local args=()
        [ -n "${pipelines_path:-}" ] && args+=("--pipelines=$pipelines_path")
        [ -n "${budget_path:-}" ] && args+=("--budget-items=$budget_path")
        if [ ${#args[@]} -gt 0 ]; then
            DATABASE_URL="file:$PROJECT_ROOT/prisma/prod.db" run_runtime_import "$PROJECT_ROOT" "${args[@]}"
        else
            echo "未指定文件，跳过导入"
        fi
    elif [ "$choice" = "2" ]; then
        echo "请粘贴管线名称（每行一个，Ctrl+D 结束）:"
        local pipelines_content
        pipelines_content=$(cat)
        echo ""
        echo "请粘贴预算项内容（格式：管线名称,预算项名称，Ctrl+D 结束）:"
        local budget_content
        budget_content=$(cat)

        local args=()
        if [ -n "$pipelines_content" ]; then
            local pipelines_tmp
            pipelines_tmp=$(mktemp)
            {
                echo "name"
                printf '%s\n' "$pipelines_content"
            } > "$pipelines_tmp"
            args+=("--pipelines=$pipelines_tmp")
        fi
        if [ -n "$budget_content" ]; then
            local budget_tmp
            budget_tmp=$(mktemp)
            {
                echo "pipeline,name"
                printf '%s\n' "$budget_content"
            } > "$budget_tmp"
            args+=("--budget-items=$budget_tmp")
        fi
        if [ ${#args[@]} -gt 0 ]; then
            DATABASE_URL="file:$PROJECT_ROOT/prisma/prod.db" run_runtime_import "$PROJECT_ROOT" "${args[@]}"
        else
            echo "未输入内容，跳过导入"
        fi
    else
        echo "跳过导入，管理员可在 Web 端手动添加管线/预算项"
    fi
}

prepare_release_payload() {
    local temp_root="$1"
    local extract_dir="$2"
    rm -rf "$temp_root" "$extract_dir"
    mkdir -p "$temp_root" "$extract_dir"
    download_and_extract_latest_release "$temp_root" "$extract_dir"
}

configure_port() {
    if is_port_used 3000; then
        local choice
        choice="$(cli_select "端口 3000 已被占用，如何处理？" "1" "1" "1|帮我释放 3000 端口" "2|查找下一个可用端口（注意：可能影响正在使用的用户）")"
        local status=$?
        [ $status -eq 130 ] && exit 0
        [ $status -ne 0 ] && exit 1
        if [ "$choice" = "1" ]; then
            lsof -ti:3000 | xargs kill
            PORT=3000
        else
            PORT=$(find_available_port)
        fi
    else
        PORT=3000
    fi
}

deploy_new() {
    echo ""
    echo "=========================================="
    echo " 开始全新部署"
    echo "=========================================="
    echo ""

    fetch_latest_release_info
    local temp_root
    temp_root=$(mktemp -d "${TMPDIR:-/tmp}/u-plus-lite-release.XXXXXX")
    local extract_dir="$temp_root/extracted"
    prepare_release_payload "$temp_root" "$extract_dir"

    if [ -d "$DEPLOY_DIR" ] && [ "$(ls -A "$DEPLOY_DIR" 2>/dev/null)" ]; then
        echo -e "${YELLOW}警告：$DEPLOY_DIR 目录已存在${NC}"
        echo -n "是否删除并重新安装？ [y/N]: "
        read -r confirm
        confirm=${confirm:-N}
        if [ "$(echo "$confirm" | tr '[:upper:]' '[:lower:]')" = "y" ]; then
            rm -rf "$DEPLOY_DIR"
        else
            echo "部署取消"
            exit 1
        fi
    fi

    mkdir -p "$DEPLOY_DIR"
    sync_release_contents "$extract_dir" "$DEPLOY_DIR"
    PROJECT_ROOT="$DEPLOY_DIR"

    echo "[1/8] 已下载并解压 release 包"
    echo "[2/8] 正在安装运行依赖..."
    install_runtime_dependencies "$PROJECT_ROOT"

    echo "[3/8] 正在初始化数据库..."
    initialize_database "$PROJECT_ROOT"

    echo "[4/8] 创建管理员账号"
    local admin_name=""
    local admin_password=""
    local admin_password_confirm=""
    read -p "  管理员姓名（输入 q 退出）: " admin_name
    [ "$admin_name" = "q" ] || [ "$admin_name" = "Q" ] && exit 0
    while [ -z "$admin_name" ]; do
        echo "  错误：管理员姓名不能为空"
        read -p "  管理员姓名（输入 q 退出）: " admin_name
        [ "$admin_name" = "q" ] || [ "$admin_name" = "Q" ] && exit 0
    done

    read_secret "  密码（至少8位，输入 q 退出）: " admin_password
    [ "$admin_password" = "q" ] || [ "$admin_password" = "Q" ] && exit 0
    while [ ${#admin_password} -lt 8 ]; do
        echo "  错误：密码至少8位"
        read_secret "  密码（至少8位，输入 q 退出）: " admin_password
        [ "$admin_password" = "q" ] || [ "$admin_password" = "Q" ] && exit 0
    done
    read_secret "  确认密码: " admin_password_confirm
    while [ "$admin_password" != "$admin_password_confirm" ]; do
        echo "  错误：两次输入的密码不一致"
        read_secret "  密码（至少8位，输入 q 退出）: " admin_password
        [ "$admin_password" = "q" ] || [ "$admin_password" = "Q" ] && exit 0
        read_secret "  确认密码: " admin_password_confirm
    done
    DATABASE_URL="file:$PROJECT_ROOT/prisma/prod.db" run_runtime_seed "$PROJECT_ROOT" "$admin_name" "$admin_password"

    echo "[5/8] 配置环境变量..."
    configure_port
    write_env_file "$PROJECT_ROOT" "$PORT"

    echo "[6/8] 配置 PM2 服务..."
    pm2 delete u-plus-lite 2>/dev/null || true
    (cd "$PROJECT_ROOT" && PORT=$PORT pm2 start npm --name u-plus-lite -- start -- -H 0.0.0.0)
    pm2 save

    echo "[7/8] 保存版本信息..."
    echo "v$LATEST_VERSION" > "$PROJECT_ROOT/version.txt"

    echo "[8/8] CSV 数据导入..."
    import_csv_data

    local enable_autostart
    enable_autostart="$(cli_confirm "是否配置开机自启？" "true")"
    local auto_status=$?
    [ $auto_status -eq 130 ] && exit 0
    if [ "$enable_autostart" = "true" ]; then
        env PATH="$PATH:/usr/local/bin" pm2 startup 2>/dev/null || true
    fi

    rm -rf "$temp_root"
    show_complete "$admin_name"
}

do_update() {
    echo ""
    echo "正在更新..."

    if is_source_repo "$PROJECT_ROOT"; then
        print_status "fail" "当前目录是源码仓库，不能作为部署目录更新"
        exit 1
    fi

    fetch_latest_release_info
    local current_version
    current_version=$(current_deployed_version "$PROJECT_ROOT")
    echo "当前版本: ${current_version:-unknown}"

    local temp_root
    temp_root=$(mktemp -d "${TMPDIR:-/tmp}/u-plus-lite-update.XXXXXX")
    local extract_dir="$temp_root/extracted"
    prepare_release_payload "$temp_root" "$extract_dir"

    sync_release_contents "$extract_dir" "$PROJECT_ROOT"
    install_runtime_dependencies "$PROJECT_ROOT"
    initialize_database "$PROJECT_ROOT"

    local admin_choice
    admin_choice="$(cli_select "是否修改管理员账号密码？" "1" "0" "1|跳过（沿用现有账号）" "2|修改")"
    local admin_status=$?
    [ $admin_status -ne 0 ] && exit 1
    if [ "$admin_choice" = "2" ]; then
        local admin_name=""
        local admin_password=""
        echo -n "  管理员姓名: "
        read -r admin_name
        while [ -z "$admin_name" ]; do
            echo "  错误：管理员姓名不能为空"
            echo -n "  管理员姓名: "
            read -r admin_name
        done
        read_secret "  密码（至少8位）: " admin_password
        while [ ${#admin_password} -lt 8 ]; do
            echo "  错误：密码至少8位"
            read_secret "  密码（至少8位）: " admin_password
        done
        DATABASE_URL="file:$PROJECT_ROOT/prisma/prod.db" run_runtime_seed "$PROJECT_ROOT" --reset "$admin_name" "$admin_password"
        print_status "ok" "管理员账号已更新"
    fi

    echo "v$LATEST_VERSION" > "$PROJECT_ROOT/version.txt"
    (cd "$PROJECT_ROOT" && pm2 restart u-plus-lite)
    rm -rf "$temp_root"
    print_status "ok" "更新完成"
    show_complete ""
}

deploy_update() {
    echo ""
    echo "=========================================="
    echo " 更新部署"
    echo "=========================================="
    echo ""

    local update_choice
    update_choice="$(cli_select "请选择操作：" "1" "1" "1|更新（推荐）" "2|卸载" "3|重新安装")"
    local status=$?
    [ $status -eq 130 ] && exit 0
    [ $status -ne 0 ] && exit 1

    case "$update_choice" in
        1) do_update ;;
        2) do_uninstall ;;
        3)
            local reinstall_dir="$DEPLOY_DIR"
            do_uninstall
            DEPLOY_MODE="new"
            DEPLOY_DIR="$reinstall_dir"
            PROJECT_ROOT="$DEPLOY_DIR"
            deploy_new
            ;;
        *) echo "无效选择"; exit 1 ;;
    esac
}

do_uninstall() {
    echo ""
    echo -e "${RED}警告：即将卸载 U-Plus-Lite${NC}"
    echo ""
    echo "此操作将："
    echo "  1. 删除 PM2 服务"
    echo "  2. 删除部署目录: $DEPLOY_DIR"
    echo ""
    echo -n "确认卸载？（输入 YES 确认）: "
    read -r confirm
    if [ "$(echo "$confirm" | tr '[:lower:]' '[:upper:]')" != "YES" ]; then
        echo "取消卸载操作"
        exit 0
    fi

    pm2 stop u-plus-lite 2>/dev/null || true
    pm2 delete u-plus-lite 2>/dev/null || true
    rm -rf "$DEPLOY_DIR"
    print_status "ok" "卸载完成"
}

show_complete() {
    local admin_name="$1"
    local local_ip
    local_ip=$(get_local_ip)

    echo ""
    echo "=========================================="
    echo -e " ${GREEN}部署完成！${NC}"
    echo "=========================================="
    echo ""
    echo -e "访问地址: ${GREEN}http://${local_ip}:${PORT}${NC}"
    echo ""
    if [ -n "$admin_name" ]; then
        echo "管理员账号: $admin_name"
    else
        echo "管理员账号: （沿用之前设置）"
    fi
    if [ -n "$admin_name" ]; then
        echo "管理员密码: （使用刚刚设置的密码）"
    else
        echo "管理员密码: （沿用之前设置）"
    fi
    echo ""
    echo "常用命令："
    echo "  pm2 status                查看状态"
    echo "  pm2 logs u-plus-lite      查看日志"
    echo "  pm2 restart u-plus-lite   重启服务"
    echo "  pm2 monit                 实时监控"
    echo "=========================================="
}

main() {
    trap cleanup_runtime_dir EXIT
    check_dependencies
    detect_deployment
    if [ "${DEPLOY_MODE:-update}" = "new" ]; then
        deploy_new
    else
        deploy_update
    fi
}

main "$@"
