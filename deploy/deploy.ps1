# U-Plus-Lite 一键部署脚本（Windows PowerShell）
# 使用方式：以管理员身份运行 PowerShell，然后执行本脚本

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$REPO_URL = "https://github.com/TengShao/u-plus-lite.git"
$DEFAULT_DIR = "$HOME\u-plus-lite"
$DEPLOY_DIR = ""
$UPDATE_MODE = $false
$PROJECT_ROOT = ""

# ============================================================
# 颜色和输出函数
# ============================================================
function Write-Step($msg) { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[+] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[X] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "[-] $msg" -ForegroundColor Yellow }

# ============================================================
# 获取本机局域网 IP
# ============================================================
function Get-LocalIP {
    $ip = (Get-NetIPAddress -InterfaceAlias "Wi-Fi" -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress
    if (-not $ip) {
        $ip = (Get-NetIPAddress -InterfaceAlias "以太网" -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress
    }
    if (-not $ip) {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -notmatch "^127" } | Select-Object -First 1).IPAddress
    }
    return $ip
}

# ============================================================
# 检测端口是否被占用
# ============================================================
function Test-PortUsed($port) {
    $result = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    return $null -ne $result
}

# ============================================================
# 检测命令是否存在
# ============================================================
function Test-Command($cmd) {
    return $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

# ============================================================
# 读取密码（不回显）
# ============================================================
function Read-Secret($prompt) {
    Write-Host -NoNewline "$prompt"
    $pass = Read-Host -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass)
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    Write-Host ""
    return $plain
}

# ============================================================
# Step 0: 依赖检测
# ============================================================
function Check-Dependencies {
    Write-Host ""
    Write-Host "正在检测系统依赖..." -ForegroundColor Cyan
    Write-Host ""

    $missing = @()

    if (Test-Command git) {
        $gitVer = (git --version) -replace "git version ", ""
        Write-Success "Git: 已安装 ($gitVer)"
    } else {
        Write-Fail "Git: 未安装"
        $missing += "git"
        Write-Info "安装指引: https://git-scm.com/download/win"
    }

    if (Test-Command node) {
        $nodeVer = node -v
        $major = [int]($nodeVer -replace "v", "" -split "\.")[0]
        if ($major -ge 18) {
            Write-Success "Node.js: $nodeVer"
        } else {
            Write-Fail "Node.js: $nodeVer (需要 v18+)"
            $missing += "node"
        }
    } else {
        Write-Fail "Node.js: 未安装"
        $missing += "node"
        Write-Info "安装指引: https://nodejs.org/"
    }

    if ($missing.Count -gt 0) {
        Write-Host ""
        Write-Host "请先安装缺少的依赖后，重新运行本脚本。" -ForegroundColor Yellow
        exit 1
    }

    Write-Host ""
    Write-Success "所有依赖检测通过！"
}

# ============================================================
# Step 1: 路径配置
# ============================================================
function Set-DeployPath {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host " U-Plus-Lite 部署脚本"
    Write-Host "=========================================="
    Write-Host ""
    Write-Host -NoNewline "部署路径 [默认: ~\u-plus-lite]: "
    $input = Read-Host
    $script:DEPLOY_DIR = if ([string]::IsNullOrWhiteSpace($input)) { $DEFAULT_DIR } else { $input }
    $script:DEPLOY_DIR = [System.Environment]::ExpandEnvironmentVariables($script:DEPLOY_DIR)

    if ((Split-Path $script:DEPLOY_DIR -Leaf) -ne "u-plus-lite") {
        $script:DEPLOY_DIR = Join-Path $script:DEPLOY_DIR "u-plus-lite"
    }
}

# ============================================================
# Step 2: 克隆或更新代码
# ============================================================
function Initialize-Code {
    Write-Host ""

    $gitDir = Join-Path $script:DEPLOY_DIR ".git"

    if (Test-Path $gitDir) {
        Write-Info "检测到已有代码，进入更新模式..."
        Write-Host ""
        Write-Host "即将更新现有部署：$script:DEPLOY_DIR"
        Write-Host -NoNewline "是否继续？[Y: 更新，其他: 取消]: "
        $confirm = Read-Host
        if ($confirm -ne "Y" -and $confirm -ne "y") {
            Write-Host "已取消。"
            exit 0
        }
        Set-Location $script:DEPLOY_DIR
        $script:UPDATE_MODE = $true
        $script:PROJECT_ROOT = $script:DEPLOY_DIR

        # 拉取最新代码
        Write-Host "正在拉取最新代码..."
        git fetch origin
        git checkout master
        git pull origin master

        $nextDir = Join-Path $script:DEPLOY_DIR ".next"
        if (Test-Path $nextDir) {
            Write-Info "清理旧的构建缓存..."
            Remove-Item -Recurse -Force $nextDir
        }

        $destScripts = Join-Path $script:DEPLOY_DIR "scripts"
        if (-not (Test-Path $destScripts)) { New-Item -ItemType Directory -Path $destScripts | Out-Null }
        Copy-Item -Force $PSCommandPath (Join-Path $destScripts "deploy.ps1")

    } else {
        if (Test-Path $script:DEPLOY_DIR) {
            Write-Warning "$script:DEPLOY_DIR 目录已存在，但不是 U-Plus-Lite 项目"
            Write-Host -NoNewline "是否删除并重新克隆？[y/N]: "
            $response = Read-Host
            if ($response -eq "y" -or $response -eq "Y") {
                Remove-Item -Recurse -Force $script:DEPLOY_DIR
            } else {
                Write-Host "部署取消。"
                exit 1
            }
        }

        Write-Step "[1/7] 正在克隆代码仓库..."
        git clone $REPO_URL $script:DEPLOY_DIR
        Set-Location $script:DEPLOY_DIR
        $script:PROJECT_ROOT = $script:DEPLOY_DIR

        $scriptsDir = Join-Path $script:DEPLOY_DIR "scripts"
        if (-not (Test-Path $scriptsDir)) { New-Item -ItemType Directory -Path $scriptsDir | Out-Null }
        Copy-Item -Force $PSCommandPath (Join-Path $scriptsDir "deploy.ps1")

        # 写入 seed.ts
        $seedContent = "import { PrismaClient } from '@prisma/client'" + [Environment]::NewLine
        $seedContent += "import bcrypt from 'bcryptjs'" + [Environment]::NewLine
        $seedContent += "" + [Environment]::NewLine
        $seedContent += "const prisma = new PrismaClient()" + [Environment]::NewLine
        $seedContent += "" + [Environment]::NewLine
        $seedContent += "async function main() {" + [Environment]::NewLine
        $seedContent += "  const providedName = process.argv[2]" + [Environment]::NewLine
        $seedContent += "  const providedPassword = process.argv[3]" + [Environment]::NewLine
        $seedContent += "" + [Environment]::NewLine
        $seedContent += "  if (providedName && providedPassword) {" + [Environment]::NewLine
        $seedContent += "    const hashedPassword = await bcrypt.hash(providedPassword, 10)" + [Environment]::NewLine
        $seedContent += "    await prisma.user.upsert({" + [Environment]::NewLine
        $seedContent += "      where: { name: providedName }," + [Environment]::NewLine
        $seedContent += "      update: {}," + [Environment]::NewLine
        $seedContent += "      create: {" + [Environment]::NewLine
        $seedContent += "        name: providedName," + [Environment]::NewLine
        $seedContent += "        password: hashedPassword," + [Environment]::NewLine
        $seedContent += "        role: 'ADMIN'," + [Environment]::NewLine
        $seedContent += "      }," + [Environment]::NewLine
        $seedContent += "    })" + [Environment]::NewLine
        $seedContent += "    console.log('Seed complete: admin user `' + providedName + `' created')" + [Environment]::NewLine
        $seedContent += "  } else {" + [Environment]::NewLine
        $seedContent += "    const hashedPassword = await bcrypt.hash('88888888', 10)" + [Environment]::NewLine
        $seedContent += "    await prisma.user.upsert({" + [Environment]::NewLine
        $seedContent += "      where: { name: '邵腾' }," + [Environment]::NewLine
        $seedContent += "      update: {}," + [Environment]::NewLine
        $seedContent += "      create: {" + [Environment]::NewLine
        $seedContent += "        name: '邵腾'," + [Environment]::NewLine
        $seedContent += "        password: hashedPassword," + [Environment]::NewLine
        $seedContent += "        role: 'ADMIN'," + [Environment]::NewLine
        $seedContent += "      }," + [Environment]::NewLine
        $seedContent += "    })" + [Environment]::NewLine
        $seedContent += "    console.log('Seed complete: admin user 邵腾 created (default)')" + [Environment]::NewLine
        $seedContent += "  }" + [Environment]::NewLine
        $seedContent += "  console.log('Seed complete: admin user created')" + [Environment]::NewLine
        $seedContent += "}" + [Environment]::NewLine
        $seedContent += "" + [Environment]::NewLine
        $seedContent += "main()" + [Environment]::NewLine
        $seedContent += "  .catch((e) => { console.error(e); process.exit(1) })" + [Environment]::NewLine
        $seedContent += "  .finally(() => prisma.`$disconnect())" + [Environment]::NewLine
        $seedPath = Join-Path $script:DEPLOY_DIR "prisma\seed.ts"
        [System.IO.File]::WriteAllText($seedPath, $seedContent, [System.Text.Encoding]::UTF8)
        Write-Info "seed.ts 已更新为支持命令行参数的版本"

        # 写入 import.ts
        $importContent = "import { PrismaClient } from '@prisma/client'" + [Environment]::NewLine
        $importContent += "import * as fs from 'fs'" + [Environment]::NewLine
        $importContent += "import * as readline from 'readline'" + [Environment]::NewLine
        $importContent += "" + [Environment]::NewLine
        $importContent += "const prisma = new PrismaClient()" + [Environment]::NewLine
        $importContent += "" + [Environment]::NewLine
        $importContent += "type CliArgs = { pipelines?: string; budgetItems?: string }" + [Environment]::NewLine
        $importContent += "" + [Environment]::NewLine
        $importContent += "function parseArgs(): CliArgs {" + [Environment]::NewLine
        $importContent += "  const args: CliArgs = {}" + [Environment]::NewLine
        $importContent += "  for (let i = 2; i < process.argv.length; i++) {" + [Environment]::NewLine
        $importContent += "    const arg = process.argv[i]" + [Environment]::NewLine
        $importContent += "    if (arg.startsWith('--pipelines=')) args.pipelines = arg.replace('--pipelines=', '')" + [Environment]::NewLine
        $importContent += "    if (arg.startsWith('--budget-items=')) args.budgetItems = arg.replace('--budget-items=', '')" + [Environment]::NewLine
        $importContent += "  }" + [Environment]::NewLine
        $importContent += "  return args" + [Environment]::NewLine
        $importContent += "}" + [Environment]::NewLine
        $importContent += "" + [Environment]::NewLine
        $importContent += "async function readCsvLines(input: string): Promise<string[]> {" + [Environment]::NewLine
        $importContent += "  if (!fs.existsSync(input)) { console.error('文件不存在: ' + input); process.exit(1) }" + [Environment]::NewLine
        $importContent += "  return fs.readFileSync(input, 'utf8').split('\n').filter((l) => l.trim())" + [Environment]::NewLine
        $importContent += "}" + [Environment]::NewLine
        $importContent += "" + [Environment]::NewLine
        $importContent += "function parsePipelinesCsv(lines: string[]): string[] {" + [Environment]::NewLine
        $importContent += "  if (lines.length < 2) return []" + [Environment]::NewLine
        $importContent += "  return lines.slice(1).filter((l) => l.trim())" + [Environment]::NewLine
        $importContent += "}" + [Environment]::NewLine
        $importContent += "" + [Environment]::NewLine
        $importContent += "function parseBudgetItemsCsv(lines: string[]): Array<{ pipeline: string; name: string }> {" + [Environment]::NewLine
        $importContent += "  if (lines.length < 2) return []" + [Environment]::NewLine
        $importContent += "  return lines.slice(1).map((line) => {" + [Environment]::NewLine
        $importContent += "    const firstComma = line.indexOf(',')" + [Environment]::NewLine
        $importContent += "    if (firstComma === -1) return { pipeline: '', name: line.trim() }" + [Environment]::NewLine
        $importContent += "    return { pipeline: line.slice(0, firstComma).trim(), name: line.slice(firstComma + 1).split(',')[0].trim() }" + [Environment]::NewLine
        $importContent += "  })" + [Environment]::NewLine
        $importContent += "}" + [Environment]::NewLine
        $importContent += "" + [Environment]::NewLine
        $importContent += "async function ensureOtherPipeline(): Promise<number> {" + [Environment]::NewLine
        $importContent += "  const existing = await prisma.pipelineSetting.findUnique({ where: { name: '其他' } })" + [Environment]::NewLine
        $importContent += "  if (existing) return existing.id" + [Environment]::NewLine
        $importContent += "  const created = await prisma.pipelineSetting.create({ data: { name: '其他' } })" + [Environment]::NewLine
        $importContent += "  console.log('  自动创建其他管线')" + [Environment]::NewLine
        $importContent += "  return created.id" + [Environment]::NewLine
        $importContent += "}" + [Environment]::NewLine
        $importContent += "" + [Environment]::NewLine
        $importContent += "async function importPipelines(args: CliArgs) {" + [Environment]::NewLine
        $importContent += "  if (!args.pipelines) { console.log('跳过管线导入（未指定 --pipelines）'); return }" + [Environment]::NewLine
        $importContent += "  const lines = await readCsvLines(args.pipelines)" + [Environment]::NewLine
        $importContent += "  const names = parsePipelinesCsv(lines)" + [Environment]::NewLine
        $importContent += "  if (names.length === 0) { console.log('pipelines.csv 为空，跳过'); return }" + [Environment]::NewLine
        $importContent += "  let created = 0, skipped = 0" + [Environment]::NewLine
        $importContent += "  for (const name of names) { if (!name.trim()) continue; const existing = await prisma.pipelineSetting.findUnique({ where: { name } }); if (existing) { skipped++ } else { await prisma.pipelineSetting.create({ data: { name } }); created++ } }" + [Environment]::NewLine
        $importContent += "  console.log('管线导入完成：跳过 ' + skipped + '，已创建 ' + created)" + [Environment]::NewLine
        $importContent += "}" + [Environment]::NewLine
        $importContent += "" + [Environment]::NewLine
        $importContent += "async function importBudgetItems(args: CliArgs) {" + [Environment]::NewLine
        $importContent += "  if (!args.budgetItems) { console.log('跳过预算项导入（未指定 --budget-items）'); return }" + [Environment]::NewLine
        $importContent += "  const otherPipelineId = await ensureOtherPipeline()" + [Environment]::NewLine
        $importContent += "  const lines = await readCsvLines(args.budgetItems)" + [Environment]::NewLine
        $importContent += "  const items = parseBudgetItemsCsv(lines)" + [Environment]::NewLine
        $importContent += "  if (items.length === 0) { console.log('budget_items.csv 为空，跳过'); return }" + [Environment]::NewLine
        $importContent += "  let created = 0, skipped = 0" + [Environment]::NewLine
        $importContent += "  const pipelineMap = new Map<string, number>()" + [Environment]::NewLine
        $importContent += "  const allPipelines = await prisma.pipelineSetting.findMany()" + [Environment]::NewLine
        $importContent += "  for (const p of allPipelines) pipelineMap.set(p.name, p.id)" + [Environment]::NewLine
        $importContent += "  for (const item of items) {" + [Environment]::NewLine
        $importContent += "    if (!item.name.trim()) continue" + [Environment]::NewLine
        $importContent += "    let pipelineId = item.pipeline ? pipelineMap.get(item.pipeline) : undefined" + [Environment]::NewLine
        $importContent += "    if (!pipelineId) { if (item.pipeline) { const cp = await prisma.pipelineSetting.create({ data: { name: item.pipeline } }); pipelineMap.set(item.pipeline, cp.id); pipelineId = cp.id; console.log('  自动创建管线: ' + item.pipeline) } else { pipelineId = otherPipelineId } }" + [Environment]::NewLine
        $importContent += "    const existing = await prisma.budgetItemSetting.findFirst({ where: { pipelineId, name: item.name } })" + [Environment]::NewLine
        $importContent += "    if (existing) { skipped++ } else { await prisma.budgetItemSetting.create({ data: { pipelineId, name: item.name } }); created++ }" + [Environment]::NewLine
        $importContent += "  }" + [Environment]::NewLine
        $importContent += "  console.log('预算项导入完成：跳过 ' + skipped + '，已创建 ' + created)" + [Environment]::NewLine
        $importContent += "}" + [Environment]::NewLine
        $importContent += "" + [Environment]::NewLine
        $importContent += "async function main() {" + [Environment]::NewLine
        $importContent += "  const args = parseArgs()" + [Environment]::NewLine
        $importContent += "  console.log('')" + [Environment]::NewLine
        $importContent += "  await importPipelines(args)" + [Environment]::NewLine
        $importContent += "  await importBudgetItems(args)" + [Environment]::NewLine
        $importContent += "  console.log('')" + [Environment]::NewLine
        $importContent += "}" + [Environment]::NewLine
        $importContent += "" + [Environment]::NewLine
        $importContent += "main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.`$disconnect())" + [Environment]::NewLine
        $importPath = Join-Path $script:DEPLOY_DIR "prisma\import.ts"
        [System.IO.File]::WriteAllText($importPath, $importContent, [System.Text.Encoding]::UTF8)
        Write-Info "import.ts 已写入"

        # 创建 .env 文件
        $envPath = Join-Path $script:DEPLOY_DIR ".env"
        if (-not (Test-Path $envPath)) {
            $dbUrl = "file:" + $script:DEPLOY_DIR + "\prisma\prod.db"
            $envContent = "DATABASE_URL=`"" + $dbUrl + "`"" + [Environment]::NewLine
            $envContent += "NEXTAUTH_SECRET=`"u-minus-dev-secret-change-in-production`"" + [Environment]::NewLine
            $envContent += "NEXTAUTH_URL=`"http://localhost:3000`""
            [System.IO.File]::WriteAllText($envPath, $envContent, [System.Text.Encoding]::UTF8)
            Write-Info ".env 文件已创建"
        }
    }
}

# ============================================================
# Step 3: 安装依赖
# ============================================================
function Install-Deps {
    Write-Step "[2/7] 安装项目依赖..."
    npm install
}

# ============================================================
# Step 4: Prisma 初始化
# ============================================================
function Initialize-Prisma {
    Write-Step "[3/7] 生成 Prisma 客户端..."
    npx prisma generate

    Write-Step "[4/7] 应用数据库迁移..."
    npx prisma db push --accept-data-loss
}

# ============================================================
# Step 5: 创建管理员
# ============================================================
function Initialize-Admin {
    Write-Step "[5/7] 检查管理员账号..."

    $dbPath = Join-Path $script:PROJECT_ROOT "prisma\prod.db"
    $hasAdmin = $false
    if (Test-Path $dbPath) {
        try {
            $result = & sqlite3 $dbPath "SELECT COUNT(*) FROM User WHERE role='ADMIN';" 2>$null
            if ($result -and [int]$result -gt 0) {
                $hasAdmin = $true
            }
        } catch {}
    }

    if ($hasAdmin) {
        Write-Info "  已存在管理员账号，跳过创建..."
        return
    }

    Write-Host ""
    Write-Host "首次部署，创建管理员账号"
    Write-Host ""

    do {
        Write-Host -NoNewline "  管理员姓名: "
        $adminName = Read-Host
        if ([string]::IsNullOrWhiteSpace($adminName)) {
            Write-Host "  错误：管理员姓名不能为空"
        }
    } while ([string]::IsNullOrWhiteSpace($adminName))

    do {
        $adminPass = Read-Secret "  密码: "
        if ([string]::IsNullOrWhiteSpace($adminPass)) {
            Write-Host "  错误：密码不能为空"
            continue
        }
        if ($adminPass.Length -lt 8) {
            Write-Host "  错误：密码至少8位"
            $adminPass = ""
            continue
        }
        $adminPassConfirm = Read-Secret "  确认密码: "
        if ($adminPass -ne $adminPassConfirm) {
            Write-Host "  错误：两次输入的密码不一致"
            $adminPass = ""
        }
    } while ([string]::IsNullOrWhiteSpace($adminPass))

    Set-Location $script:PROJECT_ROOT
    npx tsx prisma/seed.ts $adminName $adminPass
}

# ============================================================
# Step 6: 配置 NEXTAUTH_URL
# ============================================================
function Configure-NextAuth {
    Write-Step "[配置] 更新 NEXTAUTH_URL..."

    $localIP = Get-LocalIP
    $port = 3000

    if (Test-PortUsed $port) {
        Write-Fail "端口 $port 被占用，请先关闭占用端口的进程后重试"
        Write-Host "占用 $port 端口的进程："
        Get-NetTCPConnection -LocalPort $port | ForEach-Object { Write-Host "  PID: $($_.OwningProcess)" }
        exit 1
    }
    Write-Info "使用端口：$port"

    $envPath = Join-Path $script:PROJECT_ROOT ".env"
    if (Test-Path $envPath) {
        $envContent = Get-Content $envPath -Raw
        $envContent = $envContent -replace 'NEXTAUTH_URL=.*', "NEXTAUTH_URL=`"http://$localIP`:$port`""
        Set-Content -Path $envPath -Value $envContent -Encoding UTF8
        Write-Success "NEXTAUTH_URL 已更新为 http://$localIP`:$port"
    }
}

# ============================================================
# Step 7: 构建并启动
# ============================================================
function Build-And-Start {
    Write-Step "[6/7] 构建生产版本..."
    npm run build

    Write-Step "[7/7] 启动服务..."

    $env:PORT = 3000
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d $script:PROJECT_ROOT && npm start" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Write-Info "服务已在后台启动"
}

# ============================================================
# Step 8: CSV 导入（可选）
# ============================================================
function Import-CsvData {
    Write-Host ""
    Write-Host "[8/8] 是否导入预算项和管线数据？"
    Write-Host ""
    Write-Host "  1 - 指定 CSV 文件路径"
    Write-Host "  2 - 跳过（稍后通过 Web 端手动添加）"
    Write-Host ""
    Write-Host -NoNewline "请选择 [直接回车跳过]: "
    $choice = Read-Host

    if ($choice -eq "1") {
        Write-Host ""
        Write-Host -NoNewline "请输入管线名称 CSV 文件路径: "
        $pipelinesPath = Read-Host
        Write-Host -NoNewline "请输入预算项 CSV 文件路径: "
        $budgetPath = Read-Host

        Set-Location $script:PROJECT_ROOT

        if (-not [string]::IsNullOrWhiteSpace($pipelinesPath) -and -not [string]::IsNullOrWhiteSpace($budgetPath)) {
            Write-Step "正在导入管线和预算项..."
            npx tsx prisma/import.ts --pipelines=$pipelinesPath --budget-items=$budgetPath
        } elseif (-not [string]::IsNullOrWhiteSpace($pipelinesPath)) {
            Write-Step "正在导入管线..."
            npx tsx prisma/import.ts --pipelines=$pipelinesPath
        } elseif (-not [string]::IsNullOrWhiteSpace($budgetPath)) {
            Write-Step "正在导入预算项..."
            npx tsx prisma/import.ts --budget-items=$budgetPath
        } else {
            Write-Info "未指定文件，跳过导入"
        }
    } else {
        Write-Info "跳过导入，管理员可在 Web 端手动添加管线/预算项"
    }
}

# ============================================================
# 完成
# ============================================================
function Show-Complete {
    $localIP = Get-LocalIP
    Write-Host ""
    Write-Host "=========================================="
    Write-Host " 部署完成！" -ForegroundColor Green
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "局域网访问地址：http://$localIP`:3000"
    Write-Host ""
    Write-Host "管理员账号：$adminName"
    Write-Host "管理员密码：$adminPass"
    Write-Host ""
    Write-Host "常用命令："
    Write-Host "  重启服务：重新运行本脚本，选择更新模式"
    Write-Host "  停止服务：在任务管理器中结束 node 进程"
    Write-Host "=========================================="
}

# ============================================================
# 主流程
# ============================================================
$adminName = ""
$adminPass = ""

Check-Dependencies
Set-DeployPath
Initialize-Code
Install-Deps
Initialize-Prisma
Initialize-Admin
Configure-NextAuth
Build-And-Start
Import-CsvData
Show-Complete
