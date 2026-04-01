# ============================================================
# U-Plus-Lite 一键部署脚本（Windows 服务器用）
# 使用方式：
#   irm https://raw.githubusercontent.com/TengShao/u-plus-lite/master/scripts/deploy.ps1 | iex
# ============================================================

$ErrorActionPreference = "Stop"

# 自动切换到脚本所在的项目根目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

$REPO_URL = "https://github.com/TengShao/u-plus-lite.git"
$DEFAULT_DIR = "$env:USERPROFILE\u-plus-lite"
$DEPLOY_DIR = ""
$UPDATE_MODE = $false
$PORT = 0

# 获取局域网 IP (Windows)
function Get-LocalIP {
    $adapters = Get-NetAdapter | Where-Object { $_.Status -eq "Up" -and $_.InterfaceDescription -notmatch "VPN|Bluetooth|Loopback" }
    foreach ($adapter in $adapters) {
        $ip = ($adapter | Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress
        if ($ip -and $ip -like "192.168.*") {
            return $ip
        }
    }
    # Fallback: 任意 192.168.x.x
    $allIP = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like "192.168.*" }
    return ($allIP | Select-Object -First 1).IPAddress
}

# 检测端口是否被占用 (Windows)
function Test-PortUsed {
    param([int]$Port)
    $used = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -ne $used
}

# 查找可用端口
function Find-AvailablePort {
    $port = 3000
    while (Test-PortUsed -Port $port) {
        $port++
    }
    return $port
}

# 检测命令是否存在
function Test-Command {
    param([string]$Cmd)
    $null -ne (Get-Command $Cmd -ErrorAction SilentlyContinue)
}

# 打印带颜色的状态
function Write-Status {
    param([string]$Ok, [string]$Msg)
    if ($Ok -eq "ok") {
        Write-Host "[✓] $Msg" -ForegroundColor Green
    } elseif ($Ok -eq "fail") {
        Write-Host "[✗] $Msg" -ForegroundColor Red
    } else {
        Write-Host "[-] $Msg" -ForegroundColor Yellow
    }
}

# ============================================================
# Step 0: 依赖检测
# ============================================================
function Test-Dependencies {
    Write-Host ""
    Write-Host "正在检测系统依赖..."
    Write-Host ""

    $missingDeps = @()
    $depInfo = ""

    # 检测 Git
    if (Test-Command "git") {
        $gitVersion = (git --version) -replace "git version ", ""
        Write-Status "ok" "Git: 已安装 ($gitVersion)"
    } else {
        Write-Status "fail" "Git: 未安装"
        $missingDeps += "git"
        $depInfo += "  - Git: 未安装\n"
    }

    # 检测 Node.js
    if (Test-Command "node") {
        $nodeVersion = node --version
        $majorVersion = [int]($nodeVersion -replace "v", "" -replace "\..*", "")
        if ($majorVersion -ge 18) {
            Write-Status "ok" "Node.js: $nodeVersion"
        } else {
            Write-Status "fail" "Node.js: $nodeVersion (需要 v18+)"
            $missingDeps += "node"
            $depInfo += "  - Node.js: $nodeVersion (需要 v18+)\n"
        }
    } else {
        Write-Status "fail" "Node.js: 未安装"
        $missingDeps += "node"
        $depInfo += "  - Node.js: 未安装（需要 v18+）\n"
    }

    # 如果有缺失依赖，提示安装
    if ($missingDeps.Count -gt 0) {
        Write-Host ""
        Write-Host "检测到缺少以下依赖：" -ForegroundColor Yellow
        Write-Host $depInfo
        Write-Host ""
        Write-Host "部署取消。请先手动安装缺少的依赖后，重新运行脚本。" -ForegroundColor Red
        Write-Host ""
        Write-Host "安装指引："
        Write-Host "  下载 Node.js: https://nodejs.org/"
        Write-Host "  下载 Git: https://git-scm.com/download/win"
        exit 1
    } else {
        Write-Host ""
        Write-Host "所有依赖检测通过！" -ForegroundColor Green
    }
}

# ============================================================
# Step 1: 路径配置
# ============================================================
function Set-DeployPath {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host " U-Plus-Lite 部署脚本 (Windows)" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "部署路径 [默认: $DEFAULT_DIR]: " -NoNewline
    $script:DEPLOY_DIR = Read-Host
    if ([string]::IsNullOrEmpty($script:DEPLOY_DIR)) {
        $script:DEPLOY_DIR = $DEFAULT_DIR
    }
    # 展开环境变量
    $script:DEPLOY_DIR = [System.Environment]::ExpandEnvironmentVariables($script:DEPLOY_DIR)
}

# ============================================================
# Step 2: 检测/克隆代码
# ============================================================
function Initialize-Code {
    Write-Host ""

    if (Test-Path "$script:DEPLOY_DIR\.git") {
        # 已有代码，走更新流程
        Write-Host "检测到已有代码，进入更新模式..."
        Write-Host ""
        Write-Host "即将更新现有部署：$script:DEPLOY_DIR"
        Write-Host "是否继续？[Y: 更新，其他: 取消并退出] " -NoNewline
        $confirm = Read-Host
        if ([string]::IsNullOrEmpty($confirm)) { $confirm = "Y" }
        if ($confirm.ToLower() -ne "y") {
            Write-Host "已取消更新。请使用其他部署路径重新运行脚本。"
            exit 0
        }
        Set-Location $script:DEPLOY_DIR
        $script:UPDATE_MODE = $true

        # 清理旧的构建缓存
        if (Test-Path ".next") {
            Write-Host "清理旧的构建缓存..."
            Remove-Item -Recurse -Force ".next"
        }
        # 用本地正确版本覆盖
        Copy-Item "$ScriptDir\deploy.ps1" "$script:DEPLOY_DIR\scripts\deploy.ps1" -Force
        Write-Host "部署脚本已更新为最新版本"
    } else {
        # 首次部署
        if (Test-Path $script:DEPLOY_DIR) {
            Write-Host "警告：$script:DEPLOY_DIR 目录已存在，但不是 U-Plus-Lite 项目目录" -ForegroundColor Yellow
            Write-Host "是否删除并重新克隆？ [y/N]: " -NoNewline
            $response = Read-Host
            if ([string]::IsNullOrEmpty($response)) { $response = "N" }
            if ($response.ToLower() -ne "y") {
                Write-Host "部署取消。"
                exit 1
            }
            Remove-Item -Recurse -Force $script:DEPLOY_DIR
        }

        Write-Host "[1/9] 正在克隆代码仓库..."
        git clone $REPO_URL $script:DEPLOY_DIR
        Set-Location $script:DEPLOY_DIR
        $script:UPDATE_MODE = $false

        # 用本地正确版本覆盖
        Copy-Item "$ScriptDir\deploy.ps1" "$script:DEPLOY_DIR\scripts\deploy.ps1" -Force

        # 替换 seed.ts 为支持命令行参数的版本
        $seedContent = @'
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
  .finally(() => prisma.`$disconnect())
'@
        Set-Content -Path "prisma\seed.ts" -Value $seedContent -Encoding UTF8
        Write-Host "seed.ts 已更新为支持命令行参数的版本"

        # 写入 import.ts（因为该文件未推送到 GitHub，需要内嵌）
        $importContent = @'
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
  .finally(() => prisma.`$disconnect())
'@
        Set-Content -Path "prisma\import.ts" -Value $importContent -Encoding UTF8
        Write-Host "import.ts 已写入"

        # 创建 .env 文件（如果不存在，git clone 不会复制 .gitignore 中的文件）
        if (-not (Test-Path ".env")) {
            $deployDirEscaped = $script:DEPLOY_DIR -replace '\\', '\\\\'
            @"
DATABASE_URL="file:$deployDirEscaped\\prisma\\prod.db"
NEXTAUTH_SECRET="u-minus-dev-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
"@ | Set-Content ".env" -Encoding UTF8
            Write-Host ".env 文件已创建"
        }
    }
}

# ============================================================
# Step 3: 安装依赖
# ============================================================
function Install-Deps {
    Write-Host "[2/9] 安装项目依赖..."
    npm install
}

# ============================================================
# Step 4: Prisma 初始化
# ============================================================
function Initialize-Prisma {
    Write-Host "[3/9] 生成 Prisma 客户端..."
    npx prisma generate

    Write-Host "[4/9] 应用数据库迁移..."
    npx prisma db push --accept-data-loss
}

# ============================================================
# Step 5: 创建管理员（仅首次）
# ============================================================
function Initialize-Admin {
    if ($script:UPDATE_MODE) {
        Write-Host "[5/9] 跳过管理员创建（更新模式）..."
        return
    }

    Write-Host "[5/9] 创建管理员账号..."
    Write-Host ""
    Write-Host "首次部署，创建管理员账号"
    Write-Host ""

    do {
        Write-Host "  管理员姓名: " -NoNewline
        $script:ADMIN_NAME = Read-Host
        if ([string]::IsNullOrEmpty($script:ADMIN_NAME)) {
            Write-Host "  错误：管理员姓名不能为空" -ForegroundColor Red
        }
    } while ([string]::IsNullOrEmpty($script:ADMIN_NAME))

    do {
        $securePass = Read-Host "  密码: " -AsSecureString
        $script:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass))
        if ([string]::IsNullOrEmpty($script:ADMIN_PASSWORD)) {
            Write-Host "  错误：密码不能为空" -ForegroundColor Red
        } elseif ($script:ADMIN_PASSWORD.Length -lt 8) {
            Write-Host "  错误：密码至少8位" -ForegroundColor Red
            $script:ADMIN_PASSWORD = ""
        }
    } while ([string]::IsNullOrEmpty($script:ADMIN_PASSWORD))

    do {
        $securePassConfirm = Read-Host "  确认密码: " -AsSecureString
        $confirmPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassConfirm))
        if ($script:ADMIN_PASSWORD -ne $confirmPassword) {
            Write-Host "  错误：两次输入的密码不一致" -ForegroundColor Red
            # 重新输入密码
            do {
                $securePass = Read-Host "  密码: " -AsSecureString
                $script:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass))
                if ([string]::IsNullOrEmpty($script:ADMIN_PASSWORD)) {
                    Write-Host "  错误：密码不能为空" -ForegroundColor Red
                } elseif ($script:ADMIN_PASSWORD.Length -lt 8) {
                    Write-Host "  错误：密码至少8位" -ForegroundColor Red
                    $script:ADMIN_PASSWORD = ""
                }
            } while ([string]::IsNullOrEmpty($script:ADMIN_PASSWORD))
        }
    } while ($script:ADMIN_PASSWORD -ne $confirmPassword)

    npx tsx "prisma\seed.ts" $script:ADMIN_NAME $script:ADMIN_PASSWORD
}

# ============================================================
# Step 6: 配置 NEXTAUTH_URL（必须在 build 前）
# ============================================================
function Set-NextAuthUrl {
    Write-Host "[6/9] 配置 NEXTAUTH_URL..."

    $localIP = Get-LocalIP

    # 更新模式下优先使用上次配置的端口，避免链接变化
    if ($script:UPDATE_MODE -and (Test-Path ".env")) {
        $existingUrl = Select-String -Path ".env" -Pattern "^NEXTAUTH_URL=" | ForEach-Object { $_ -replace 'NEXTAUTH_URL=', '' -replace '"', '' }
        if ($existingUrl -match ':\d+$') {
            $existingPort = $existingUrl -replace '.*:', ''
            if (-not (Test-PortUsed -Port $existingPort)) {
                $script:PORT = $existingPort
                Write-Host "保留原有端口：$script:PORT"
            }
        }
    }

    # 如果没有保留端口，强制使用 3000
    if ($script:PORT -eq 0) {
        if (Test-PortUsed -Port 3000) {
            Write-Host ""
            Write-Host "[错误] 端口 3000 被占用，请先关闭占用端口的进程后再部署" -ForegroundColor Red
            Write-Host ""
            Write-Host "占用 3000 端口的进程：" -ForegroundColor Yellow
            $connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
            foreach ($conn in $connections) {
                $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                Write-Host "  PID: $($conn.OwningProcess)  命令: $($proc.ProcessName)" -ForegroundColor DarkGray
            }
            Write-Host ""
            Write-Host "快速解决方法（复制执行）：" -ForegroundColor Yellow
            Write-Host "  Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force" -ForegroundColor Green
            Write-Host ""
            exit 1
        }
        $script:PORT = 3000
    }
    Write-Host "使用端口：$script:PORT"

    if (Test-Path ".env") {
        $content = Get-Content ".env" -Raw
        $content = $content -replace 'NEXTAUTH_URL=.*', "NEXTAUTH_URL=`"http://$localIP`:$script:PORT`""
        Set-Content ".env" -Value $content
        Write-Host "NEXTAUTH_URL 已更新为 http://$localIP`:$script:PORT"
    }

    # 开机自启配置
    Write-Host ""
    Write-Host "是否配置开机自启？[Y/n] " -NoNewline
    $enableAutostart = Read-Host
    if ([string]::IsNullOrEmpty($enableAutostart)) { $enableAutostart = "Y" }
    if ($enableAutostart.ToLower() -eq "y") {
        Write-Host "（需要以管理员身份运行 PowerShell）"
        $pm2Startup = pm2 startup 2>$null
        Write-Host ""
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host " 开机自启配置（只需执行一次）" -ForegroundColor Yellow
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "请复制下方命令，以管理员身份运行 PowerShell："
        Write-Host ""
        Write-Host $pm2Startup -ForegroundColor Green
        Write-Host ""
        Write-Host "执行方法："
        Write-Host "1. 右键点击 PowerShell 图标"
        Write-Host "2. 选择 '以管理员身份运行'"
        Write-Host "3. 粘贴并回车执行"
        Write-Host "=========================================="
    } else {
        Write-Host "已跳过开机自启配置"
    }
}

# ============================================================
# Step 7: 构建并启动
# ============================================================
function Start-Service {
    Write-Host "[7/9] 构建生产版本..."
    npm run build

    Write-Host "[8/9] 启动 PM2 服务..."

    # 安装/更新 PM2
    npm install -g pm2 --silent 2>$null

    # 停止旧实例
    pm2 delete u-plus-lite 2>$null

    # 启动服务
    $env:PORT = $script:PORT
    pm2 start npm -- start --name u-plus-lite
    pm2 save
}

# ============================================================
# Step 8: CSV import (optional)
# ============================================================
function Import-CsvData {
    # 确保从项目根目录执行
    Set-Location $script:DEPLOY_DIR

    Write-Host ""
    Write-Host "[9/9] 是否导入预算项和管线数据？" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  1 - 指定 CSV 文件路径"
    Write-Host "  2 - 直接粘贴 CSV 内容"
    Write-Host "  3 - 跳过（稍后通过 Web 端手动添加）"
    Write-Host ""
    Write-Host "请选择（直接回车跳过）: " -NoNewline
    $choice = Read-Host
    if ([string]::IsNullOrEmpty($choice)) { $choice = "3" }

    if ($choice -eq "1") {
        Write-Host ""
        Write-Host "请输入管线名称文件路径（CSV格式，直接回车跳过）: " -NoNewline
        Write-Host "  格式示例：每行一个管线名称，如：UGC研发、UGC运营、玩法" -ForegroundColor DarkGray
        $pipelinesPath = Read-Host
        Write-Host ""
        Write-Host "请输入预算项文件路径（CSV格式，直接回车跳过）: " -NoNewline
        Write-Host "  格式示例：管线名称,预算项名称，如：UGC研发,UGC商业化功能" -ForegroundColor DarkGray
        $budgetPath = Read-Host

        $cmdArgs = ""
        if (-not [string]::IsNullOrEmpty($pipelinesPath)) {
            $cmdArgs += " --pipelines=$pipelinesPath"
        }
        if (-not [string]::IsNullOrEmpty($budgetPath)) {
            $cmdArgs += " --budget-items=$budgetPath"
        }

        if (-not [string]::IsNullOrEmpty($cmdArgs)) {
            Invoke-Expression "npx tsx prisma/import.ts $cmdArgs"
        } else {
            Write-Host "未指定文件，跳过导入"
        }

    } elseif ($choice -eq "2") {
        Write-Host ""
        Write-Host "请粘贴管线名称文件内容（每行一个名称，回车后空行结束）: " -NoNewline
        Write-Host "  格式示例：UGC研发、UGC运营、玩法" -ForegroundColor DarkGray
        $pipelinesContent = @()
        $input | ForEach-Object { $pipelinesContent += $_ }
        $pipelinesContent = $pipelinesContent -join "`n"
        Write-Host ""
        Write-Host "请粘贴预算项文件内容（格式：管线名称,预算项名称，回车后空行结束）: " -NoNewline
        Write-Host "  格式示例：UGC研发,UGC商业化功能" -ForegroundColor DarkGray
        $budgetContent = @()
        $input | ForEach-Object { $budgetContent += $_ }
        $budgetContent = $budgetContent -join "`n"

        # 使用临时文件传递内容（避免 stdin pipe 与 tsx ESM 加载冲突）
        if (-not [string]::IsNullOrEmpty($pipelinesContent)) {
            $pipelinesTmp = [System.IO.Path]::GetTempFileName() + ".csv"
            $pipelinesContent | Set-Content $pipelinesTmp -Encoding UTF8
            Invoke-Expression "npx tsx prisma/import.ts --pipelines=`"$pipelinesTmp`""
            Remove-Item $pipelinesTmp -Force
        }
        if (-not [string]::IsNullOrEmpty($budgetContent)) {
            $budgetTmp = [System.IO.Path]::GetTempFileName() + ".csv"
            $budgetContent | Set-Content $budgetTmp -Encoding UTF8
            Invoke-Expression "npx tsx prisma/import.ts --budget-items=`"$budgetTmp`""
            Remove-Item $budgetTmp -Force
        }
    } else {
        Write-Host "跳过导入，管理员可在 Web 端手动添加管线/预算项"
    }
}

# ============================================================
# 完成
# ============================================================
function Show-Complete {
    $localIP = Get-LocalIP

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host " 部署完成！" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "局域网访问地址：http://$localIP`:$script:PORT"
    Write-Host ""

    if (-not $script:UPDATE_MODE) {
        Write-Host "管理员账号：$script:ADMIN_NAME"
        Write-Host "管理员密码：******"
    }

    Write-Host ""
    Write-Host "常用命令："
    Write-Host "  pm2 status              查看状态"
    Write-Host "  pm2 logs u-plus-lite   查看日志"
    Write-Host "  pm2 restart u-plus-lite 重启"
    Write-Host "=========================================="
}

# ============================================================
# 主流程
# ============================================================
function Main {
    Test-Dependencies   # Step 0: 依赖检测
    Set-DeployPath      # Step 1: 路径配置
    Initialize-Code     # Step 2: 克隆/更新代码
    Install-Deps        # Step 3: 安装依赖
    Initialize-Prisma   # Step 4: Prisma
    Initialize-Admin    # Step 5: 管理员
    Set-NextAuthUrl     # Step 6: 配置 NEXTAUTH_URL（必须在 build 前）
    Start-Service       # Step 7: 构建并启动
    Import-CsvData      # Step 8: CSV 导入
    Show-Complete       # 完成
}

Main
