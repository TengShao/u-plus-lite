# U-Plus-Lite 一键部署脚本（Windows PowerShell）
# 使用方式：以管理员身份运行 PowerShell，然后执行本脚本
#   powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$REPO_URL = "https://github.com/TengShao/u-plus-lite.git"
$DEFAULT_DIR = "$env:USERPROFILE\u-plus-lite"
$DEPLOY_DIR = ""
$DEPLOY_MODE = ""  # "new" or "update"
$PROJECT_ROOT = ""
$LATEST_VERSION = "unknown"
$LOCAL_VERSION = "unknown"
$PORT = 3000

# ============================================================
# 颜色和输出函数
# ============================================================
function Write-Success($msg) { Write-Host "[+] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[-] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }


# ============================================================
# 检测命令是否存在
# ============================================================
function Test-Command($cmd) {
    return $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

# ============================================================
# 获取本机局域网 IP
# ============================================================
function Get-LocalIP {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } |
        Select-Object -First 1 -ExpandProperty IPAddress
    if (-not $ip) { $ip = "127.0.0.1" }
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
# 查找可用端口
# ============================================================
function Find-AvailablePort {
    $port = 3000
    while (Test-PortUsed $port) {
        $port++
    }
    return $port
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
# 生成随机密钥
# ============================================================
function New-Secret {
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

# ============================================================
# Step 0: 依赖检测
# ============================================================
function Test-Dependencies {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host " U-Plus-Lite 部署脚本"
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "正在检测系统依赖..."
    Write-Host ""

    $missing = @()
    $needInstall = @()

    # 检测 Git
    if (Test-Command git) {
        $gitVer = (git --version) -replace "git version ", ""
        Write-Success "Git: $gitVer"
    } else {
        Write-Fail "Git: 未安装"
        $missing += "git"
    }

    # 检测 Node.js
    if (Test-Command node) {
        $nodeVer = node -v
        $majorVer = [int]($nodeVer -replace "^v", "" -replace "\..*", "")
        if ($majorVer -ge 18) {
            Write-Success "Node.js: $nodeVer"
        } else {
            Write-Fail "Node.js: $nodeVer (需要 v18+)"
            $missing += "node"
        }
    } else {
        Write-Fail "Node.js: 未安装"
        $missing += "node"
    }

    # 检测 PM2
    if (Test-Command pm2) {
        Write-Success "PM2: 已安装"
    } else {
        Write-Fail "PM2: 未安装"
        $needInstall += "pm2"
    }

    # Git 缺失，尝试自动安装
    if ($missing -contains "git") {
        Write-Host ""
        Write-Warn "检测到 Git 未安装，正在尝试自动安装..."
        $installOk = $false
        if (Test-Command winget) {
            try {
                winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
                if (Test-Command git) { $installOk = $true }
            } catch {}
        }
        if (-not $installOk -and (Test-Command choco)) {
            try {
                choco install git -y --params "/GitOnlyNow /NoAutoCrlf"
                if (Test-Command git) { $installOk = $true }
            } catch {}
        }
        if ($installOk) {
            Write-Success "Git 安装成功"
            $missing = $missing | Where-Object { $_ -ne "git" }
        } else {
            Write-Fail "无法自动安装 Git，请手动安装后重试"
            Write-Host "下载地址: https://git-scm.com/download/win"
            exit 1
        }
    }

    # Node 缺失，尝试自动安装
    if ($missing -contains "node") {
        Write-Host ""
        Write-Warn "检测到 Node.js 未安装，正在尝试自动安装..."
        $installOk = $false
        if (Test-Command winget) {
            try {
                winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
                if (Test-Command node) { $installOk = $true }
            } catch {}
        }
        if (-not $installOk -and (Test-Command choco)) {
            try {
                choco install nodejs -y --version=20
                if (Test-Command node) { $installOk = $true }
            } catch {}
        }
        if ($installOk) {
            Write-Success "Node.js 安装成功: $(node -v)"
            $missing = $missing | Where-Object { $_ -ne "node" }
        } else {
            Write-Fail "无法自动安装 Node.js，请手动安装后重试"
            Write-Host "下载地址: https://nodejs.org/"
            exit 1
        }
    }

    # PM2 缺失，自动安装
    if ($needInstall -contains "pm2") {
        Write-Host ""
        Write-Host "正在安装 PM2..."
        $pm2Ok = $false
        try {
            npm install -g pm2 --silent 2>&1 | Out-Null
            if (Test-Command pm2) { $pm2Ok = $true }
        } catch {}
        if (-not $pm2Ok) {
            # 尝试以管理员方式重新安装
            Write-Warn "PM2 安装失败，可能需要管理员权限"
            Write-Host "请以管理员身份运行 PowerShell 后重试，或手动执行: npm install -g pm2"
            exit 1
        }
        Write-Success "PM2 安装成功"
    }

    Write-Host ""
    Write-Success "所有依赖检测通过！"
}

# ============================================================
# 获取最新版本
# ============================================================
function Get-LatestVersion {
    Write-Host ""
    Write-Host "正在检查最新版本..."

    $response = $null
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/TengShao/u-plus-lite/releases/latest" -TimeoutSec 10
    } catch {}

    if ($response -and $response.tag_name) {
        $script:LATEST_VERSION = $response.tag_name -replace "^v", ""
        Write-Success "最新版本: v$script:LATEST_VERSION"
    } else {
        # API 失败时从 git remote 获取
        try {
            $tag = git ls-remote --tags origin 2>$null |
                ForEach-Object { $_.Split("`t")[1] } |
                Where-Object { $_ -match '^refs/tags/v[0-9]' } |
                ForEach-Object { $_ -replace 'refs/tags/v', '' -replace '\^\{\}', '' } |
                Sort-Object { [version]$_ } -ErrorAction SilentlyContinue |
                Select-Object -Last 1
            if ($tag) {
                $script:LATEST_VERSION = $tag
                Write-Success "最新版本: v$script:LATEST_VERSION"
            }
        } catch {}
    }

    # 显示当前项目版本（仅当已有部署时）
    if (Test-Path (Join-Path $DEFAULT_DIR ".git")) {
        $verFile = Join-Path $DEFAULT_DIR "version.txt"
        if (Test-Path $verFile) {
            $script:LOCAL_VERSION = (Get-Content $verFile -Raw).Trim()
        } else {
            try {
                Push-Location $DEFAULT_DIR
                $tag = git describe --tags --abbrev=0 2>$null
                if ($tag) { $script:LOCAL_VERSION = $tag -replace "\^\{\}", "" -replace "^v", "" }
            } catch {}
            finally { Pop-Location }
        }
        Write-Host "当前版本: $script:LOCAL_VERSION"
    }
}

# ============================================================
# 检测部署状态
# ============================================================
function Detect-Deployment {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host " 检测现有部署"
    Write-Host "=========================================="
    Write-Host ""

    # 自动检测：参考重新部署的逻辑
    $scriptPath = if ($PSScriptRoot) {
        $PSScriptRoot
    } elseif ($PSCommandPath) {
        Split-Path -Parent $PSCommandPath
    } elseif ($MyInvocation.MyCommand.Path) {
        Split-Path -Parent $MyInvocation.MyCommand.Path
    } else {
        $PWD.Path
    }
    $scriptParent = Split-Path -Parent $scriptPath

    if (Test-Path (Join-Path $scriptParent ".git")) {
        # 脚本在项目的 deploy/ 子目录中（如 u-plus-lite/deploy/）
        $script:DEPLOY_MODE = "update"
        $script:DEPLOY_DIR = $scriptParent
        Write-Host "自动检测到项目目录: $script:DEPLOY_DIR"
    } elseif (Test-Path (Join-Path $scriptParent "u-plus-lite\.git")) {
        # 脚本在项目的兄弟目录中（如 Downloads/deploy/，项目在 Downloads/u-plus-lite/）
        $script:DEPLOY_MODE = "update"
        $script:DEPLOY_DIR = Join-Path $scriptParent "u-plus-lite"
        Write-Host "自动检测到项目目录: $script:DEPLOY_DIR"
    } elseif (Test-Path (Join-Path $DEFAULT_DIR ".git")) {
        $script:DEPLOY_MODE = "update"
        $script:DEPLOY_DIR = $DEFAULT_DIR
        Write-Host "检测到已有部署: $script:DEPLOY_DIR"
    } else {
        Write-Host "默认路径 ($DEFAULT_DIR) 未检测到现有部署"
        Write-Host ""
        Write-Host "请选择部署模式："
        Write-Host "  1 - 全新部署"
        Write-Host "  2 - 指定已部署路径"
        Write-Host ""
        Write-Host -NoNewline "请选择（直接回车选择 1，输入 q 退出）: "
        $choice = Read-Host
        if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

        if ($choice -eq "q" -or $choice -eq "Q") {
            Write-Host "已取消部署"
            exit 0
        }

        if ($choice -eq "1") {
            Write-Host ""
            Write-Host -NoNewline "请输入部署目录路径（直接回车使用 $DEFAULT_DIR，输入 q 退出）: "
            $customPath = Read-Host

            if ($customPath -eq "q" -or $customPath -eq "Q") {
                Write-Host "已取消部署"
                exit 0
            }

            if ([string]::IsNullOrWhiteSpace($customPath)) {
                $customPath = $DEFAULT_DIR
            }
            # 展开环境变量
            $customPath = [System.Environment]::ExpandEnvironmentVariables($customPath)
            # 确保路径以 u-plus-lite 结尾
            if (-not $customPath.EndsWith("u-plus-lite")) {
                $customPath = Join-Path $customPath "u-plus-lite"
            }

            # 检查输入路径是否已是 git 仓库，如果是改为更新模式
            if (Test-Path (Join-Path $customPath ".git")) {
                $script:DEPLOY_MODE = "update"
                $script:DEPLOY_DIR = $customPath
                Write-Host "检测到已有部署，进入更新模式: $script:DEPLOY_DIR"
            } else {
                $script:DEPLOY_MODE = "new"
                $script:DEPLOY_DIR = $customPath
            }
        } else {
            while ($true) {
                Write-Host -NoNewline "请输入已有项目路径（输入 q 退出）: "
                $customPath = Read-Host

                if ($customPath -eq "q" -or $customPath -eq "Q") {
                    Write-Host "已取消部署"
                    exit 0
                }

                $customPath = [System.Environment]::ExpandEnvironmentVariables($customPath)

                # 检查指定路径是否是 git 仓库
                if (Test-Path (Join-Path $customPath ".git")) {
                    $script:DEPLOY_MODE = "update"
                    $script:DEPLOY_DIR = $customPath
                    break
                # 检查是否有 u-plus-lite 子文件夹
                } elseif (Test-Path (Join-Path $customPath "u-plus-lite\.git")) {
                    $script:DEPLOY_MODE = "update"
                    $script:DEPLOY_DIR = Join-Path $customPath "u-plus-lite"
                    break
                } else {
                    Write-Host -ForegroundColor Red "错误：$customPath 不是 Git 仓库"
                }
            }
        }
    }

    $script:PROJECT_ROOT = $script:DEPLOY_DIR
    Write-Host "部署目录: $script:DEPLOY_DIR"
    Write-Host "部署模式: $script:DEPLOY_MODE"
}

# ============================================================
# 写入内嵌的 seed.ts 和 import.ts
# ============================================================
function Write-HelperScripts {
    $seedDir = Join-Path $script:PROJECT_ROOT "prisma"
    if (-not (Test-Path $seedDir)) {
        New-Item -ItemType Directory -Path $seedDir -Force | Out-Null
    }

    # seed.ts
    $seedContent = @'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const resetMode = args.includes('--reset')

  if (resetMode) {
    // 删除所有管理员
    await prisma.user.deleteMany({ where: { role: 'ADMIN' } })
    console.log('已删除所有管理员账号')
  }

  const providedName = args[0]
  const providedPassword = args[1]

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
'@
    [System.IO.File]::WriteAllText((Join-Path $seedDir "seed.ts"), $seedContent, [System.Text.Encoding]::UTF8)

    # import.ts
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
  .finally(() => prisma.$disconnect())
'@
    [System.IO.File]::WriteAllText((Join-Path $seedDir "import.ts"), $importContent, [System.Text.Encoding]::UTF8)

    Write-Host "辅助脚本已写入"
}

# ============================================================
# CSV 导入
# ============================================================
function Import-CsvData {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host " CSV 数据导入"
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "请选择导入方式："
    Write-Host "  1 - 指定 CSV 文件路径"
    Write-Host "  2 - 直接粘贴 CSV 内容"
    Write-Host "  3 - 跳过（稍后通过 Web 端手动添加）"
    Write-Host ""
    Write-Host -NoNewline "请选择（直接回车选择 3，输入 q 退出）: "
    $choice = Read-Host
    if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "3" }

    if ($choice -eq "q" -or $choice -eq "Q") {
        Write-Host "已取消部署"
        exit 0
    }

    if ($choice -eq "1") {
        Write-Host ""
        Write-Host "请输入管线名称文件路径（CSV格式）: "
        Write-Host "  格式：每行一个管线名称，如："
        Write-Host "    UGC研发"
        Write-Host "    UGC运营"
        Write-Host ""
        Write-Host -NoNewline "文件路径（直接回车跳过，输入 q 退出）: "
        $pipelinesPath = Read-Host

        if ($pipelinesPath -eq "q" -or $pipelinesPath -eq "Q") {
            Write-Host "已取消部署"
            exit 0
        }

        Write-Host ""
        Write-Host "请输入预算项文件路径（CSV格式）: "
        Write-Host "  格式：管线名称,预算项名称，如："
        Write-Host "    UGC研发,UGC商业化功能"
        Write-Host "    UGC运营,乐园会员体系"
        Write-Host ""
        Write-Host -NoNewline "文件路径（直接回车跳过，输入 q 退出）: "
        $budgetPath = Read-Host

        if ($budgetPath -eq "q" -or $budgetPath -eq "Q") {
            Write-Host "已取消部署"
            exit 0
        }

        $cmdArgs = @()
        if (-not [string]::IsNullOrWhiteSpace($pipelinesPath)) {
            $cmdArgs += "--pipelines=$pipelinesPath"
        }
        if (-not [string]::IsNullOrWhiteSpace($budgetPath)) {
            $cmdArgs += "--budget-items=$budgetPath"
        }

        if ($cmdArgs.Count -gt 0) {
            Write-Host ""
            Write-Host "正在导入数据..."
            $env:DATABASE_URL = "file:$($script:PROJECT_ROOT -replace '\\', '/')/prisma/prod.db"
            npx tsx "$script:PROJECT_ROOT/prisma/import.ts" @cmdArgs
        } else {
            Write-Host "未指定文件，跳过导入"
        }

    } elseif ($choice -eq "2") {
        Write-Host ""
        Write-Host "请粘贴管线名称内容（每行一个名称，输入空行后按回车结束）: "
        $pipelinesContent = @()
        while ($true) {
            $line = Read-Host
            if ([string]::IsNullOrWhiteSpace($line)) { break }
            $pipelinesContent += $line
        }

        Write-Host ""
        Write-Host "请粘贴预算项内容（格式：管线名称,预算项名称，输入空行后按回车结束）: "
        $budgetContent = @()
        while ($true) {
            $line = Read-Host
            if ([string]::IsNullOrWhiteSpace($line)) { break }
            $budgetContent += $line
        }

        if ($pipelinesContent.Count -gt 0) {
            $pipelinesTmp = [System.IO.Path]::GetTempFileName()
            # 添加 CSV header
            $csvLines = @("pipeline") + $pipelinesContent
            [System.IO.File]::WriteAllLines($pipelinesTmp, $csvLines, [System.Text.Encoding]::UTF8)
            $env:DATABASE_URL = "file:$($script:PROJECT_ROOT -replace '\\', '/')/prisma/prod.db"
            npx tsx "$script:PROJECT_ROOT/prisma/import.ts" "--pipelines=$pipelinesTmp"
            Remove-Item -Force $pipelinesTmp -ErrorAction SilentlyContinue
        }

        if ($budgetContent.Count -gt 0) {
            $budgetTmp = [System.IO.Path]::GetTempFileName()
            # 添加 CSV header
            $csvLines = @("pipeline,item_name") + $budgetContent
            [System.IO.File]::WriteAllLines($budgetTmp, $csvLines, [System.Text.Encoding]::UTF8)
            $env:DATABASE_URL = "file:$($script:PROJECT_ROOT -replace '\\', '/')/prisma/prod.db"
            npx tsx "$script:PROJECT_ROOT/prisma/import.ts" "--budget-items=$budgetTmp"
            Remove-Item -Force $budgetTmp -ErrorAction SilentlyContinue
        }

        if ($pipelinesContent.Count -eq 0 -and $budgetContent.Count -eq 0) {
            Write-Host "未输入内容，跳过导入"
        }
    } else {
        Write-Host "跳过导入，管理员可在 Web 端手动添加管线/预算项"
    }
}

# ============================================================
# 全新部署
# ============================================================
function Deploy-New {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host " 开始全新部署"
    Write-Host "=========================================="
    Write-Host ""

    # [1/9] Git Clone
    Write-Host "[1/9] 正在克隆代码仓库..."
    if (Test-Path $script:DEPLOY_DIR) {
        Write-Warn "警告：$script:DEPLOY_DIR 目录已存在"
        Write-Host -NoNewline "是否删除并重新克隆？ [y/N]: "
        $confirm = Read-Host
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            Remove-Item -Recurse -Force $script:DEPLOY_DIR
            git clone $REPO_URL $script:DEPLOY_DIR
            if ($LASTEXITCODE -ne 0) {
                Write-Fail "Git clone 失败"
                exit 1
            }
        } else {
            Write-Host "部署取消"
            exit 1
        }
    } else {
        git clone $REPO_URL $script:DEPLOY_DIR
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Git clone 失败"
            exit 1
        }
    }
    Set-Location $script:DEPLOY_DIR
    Write-HelperScripts

    # [2/9] npm install
    Write-Host ""
    Write-Host "[2/9] 正在安装依赖..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm install 失败"
        exit 1
    }

    # [3/9] Prisma
    Write-Host ""
    Write-Host "[3/9] 正在初始化数据库..."
    $env:DATABASE_URL = "file:$($script:DEPLOY_DIR -replace '\\', '/')/prisma/prod.db"
    npx prisma generate
    npx prisma db push --accept-data-loss

    # [4/9] 创建管理员
    Write-Host ""
    Write-Host "[4/9] 创建管理员账号"
    Write-Host ""

    do {
        Write-Host -NoNewline "  管理员姓名（输入 q 退出）: "
        $adminName = Read-Host
        if ($adminName -eq "q" -or $adminName -eq "Q") {
            Write-Host "已取消部署"
            exit 0
        }
        if ([string]::IsNullOrWhiteSpace($adminName)) {
            Write-Host -ForegroundColor Red "  错误：管理员姓名不能为空"
        }
    } while ([string]::IsNullOrWhiteSpace($adminName))

    do {
        $adminPass = Read-Secret "  密码（至少8位，输入 q 退出）: "
        if ($adminPass -eq "q" -or $adminPass -eq "Q") {
            Write-Host "已取消部署"
            exit 0
        }
        if ([string]::IsNullOrWhiteSpace($adminPass)) {
            Write-Host -ForegroundColor Red "  错误：密码不能为空"
            continue
        }
        if ($adminPass.Length -lt 8) {
            Write-Host -ForegroundColor Red "  错误：密码至少8位"
            continue
        }
        $adminPassConfirm = Read-Secret "  确认密码: "
        if ($adminPass -ne $adminPassConfirm) {
            Write-Host -ForegroundColor Red "  错误：两次输入的密码不一致"
            $adminPass = ""
        }
    } while ([string]::IsNullOrWhiteSpace($adminPass))

    $env:DATABASE_URL = "file:$($script:DEPLOY_DIR -replace '\\', '/')/prisma/prod.db"
    npx tsx "$script:PROJECT_ROOT/prisma/seed.ts" $adminName $adminPass

    # [5/9] 配置 .env
    Write-Host ""
    Write-Host "[5/9] 配置环境变量..."

    $localIP = Get-LocalIP
    Write-Host "检测到本机局域网 IP: $localIP"

    # 端口配置
    if (Test-PortUsed 3000) {
        Write-Host ""
        Write-Warn "端口 3000 已被占用"
        Write-Host "  1 - 帮我释放 3000 端口"
        Write-Host "  2 - 查找下一个可用端口（注意：可能影响正在使用的用户）"
        Write-Host ""
        Write-Host -NoNewline "请选择（直接回车选择 1，输入 q 退出）: "
        $portChoice = Read-Host
        if ([string]::IsNullOrWhiteSpace($portChoice)) { $portChoice = "1" }

        if ($portChoice -eq "q" -or $portChoice -eq "Q") {
            Write-Host "已取消部署"
            exit 0
        }

        if ($portChoice -eq "1") {
            Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
                ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
            Write-Host "端口 3000 已释放"
            $script:PORT = 3000
        } else {
            $script:PORT = Find-AvailablePort
            Write-Host "使用端口: $script:PORT"
        }
    } else {
        $script:PORT = 3000
    }

    $nextAuthSecret = New-Secret
    $dbUrl = "file:$($script:DEPLOY_DIR -replace '\\', '/')/prisma/prod.db"

    $envContent = "DATABASE_URL=`"$dbUrl`"" + [Environment]::NewLine
    $envContent += "NEXTAUTH_SECRET=`"$nextAuthSecret`"" + [Environment]::NewLine
    $envContent += "NEXTAUTH_URL=`"http://$localIP`:$script:PORT`"" + [Environment]::NewLine
    $envContent += "NEXT_PUBLIC_LLM_PROVIDER=ollama" + [Environment]::NewLine
    $envContent += "NEXT_PUBLIC_OLLAMA_MODEL=qwen3:4b"

    $envPath = Join-Path $script:DEPLOY_DIR ".env.local"
    [System.IO.File]::WriteAllText($envPath, $envContent, [System.Text.Encoding]::UTF8)
    Write-Host ".env.local 文件已创建"

    # [6/9] Build
    Write-Host ""
    Write-Host "[6/9] 正在构建生产版本..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm run build 失败"
        exit 1
    }

    # [7/9] PM2 启动
    Write-Host ""
    Write-Host "[7/9] 配置 PM2 服务..."

    pm2 delete u-plus-lite 2>$null
    $env:PORT = "$script:PORT"
    pm2 start npm --name "u-plus-lite" -- start -- -H 0.0.0.0
    pm2 save

    # [8/9] 写入版本文件
    Write-Host ""
    Write-Host "[8/9] 保存版本信息..."
    "v$script:LATEST_VERSION" | Set-Content -Path (Join-Path $script:DEPLOY_DIR "version.txt") -Encoding UTF8

    # [9/9] CSV 导入
    Write-Host ""
    Write-Host "[9/9] CSV 数据导入..."
    Import-CsvData

    # 自启配置
    Write-Host ""
    Write-Host -NoNewline "是否配置开机自启？[Y/n]（输入 q 退出）: "
    $enableAutostart = Read-Host
    if ([string]::IsNullOrWhiteSpace($enableAutostart)) { $enableAutostart = "Y" }

    if ($enableAutostart -eq "q" -or $enableAutostart -eq "Q") {
        Write-Host "已取消部署"
        exit 0
    }

    if ($enableAutostart -eq "y" -or $enableAutostart -eq "Y") {
        pm2 startup 2>$null
        pm2 save
    }

    # 显示完成信息
    Show-Complete $adminName
}

# ============================================================
# 更新部署
# ============================================================
function Deploy-Update {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host " 更新部署"
    Write-Host "=========================================="
    Write-Host ""

    Set-Location $script:PROJECT_ROOT

    Write-Host ""
    Write-Host "请选择操作："
    Write-Host "  1 - 更新（推荐）"
    Write-Host "  2 - 卸载"
    Write-Host "  3 - 重新安装"
    Write-Host ""
    Write-Host -NoNewline "请选择（直接回车选择 1，输入 q 退出）: "
    $updateChoice = Read-Host
    if ([string]::IsNullOrWhiteSpace($updateChoice)) { $updateChoice = "1" }

    if ($updateChoice -eq "q" -or $updateChoice -eq "Q") {
        Write-Host "已取消部署"
        exit 0
    }

    if ($updateChoice -eq "1") {
        Invoke-Update
    } elseif ($updateChoice -eq "2") {
        Invoke-Uninstall
    } elseif ($updateChoice -eq "3") {
        Invoke-Uninstall
        Set-Location $env:TEMP
        $script:DEPLOY_MODE = "new"
        $script:DEPLOY_DIR = $DEFAULT_DIR
        $script:PROJECT_ROOT = $DEFAULT_DIR
        Deploy-New
    } else {
        Write-Host "无效选择，取消操作"
        exit 1
    }
}

# ============================================================
# 执行更新
# ============================================================
function Invoke-Update {
    Write-Host ""
    Write-Host "正在更新..."

    # 迁移 .env → .env.local（兼容旧部署）
    $envFile = Join-Path $script:PROJECT_ROOT ".env"
    $envLocalFile = Join-Path $script:PROJECT_ROOT ".env.local"
    if ((Test-Path $envFile) -and -not (Test-Path $envLocalFile)) {
        Move-Item $envFile $envLocalFile
        Write-Host "已将 .env 迁移为 .env.local"
    } elseif ((Test-Path $envFile) -and (Test-Path $envLocalFile)) {
        Remove-Item $envFile -Force
        Write-Host "已删除 .env（使用 .env.local）"
    }

    # 保存旧版本信息用于对比
    $oldPackageLock = ""
    $oldSchema = ""
    $pkgFile = Join-Path $script:PROJECT_ROOT "package-lock.json"
    $schemaFile = Join-Path $script:PROJECT_ROOT "prisma\schema.prisma"
    if (Test-Path $pkgFile) {
        $oldPackageLock = (Get-FileHash $pkgFile -Algorithm MD5).Hash
    }
    if (Test-Path $schemaFile) {
        $oldSchema = (Get-FileHash $schemaFile -Algorithm MD5).Hash
    }

    # Git fetch and pull
    Write-Host "正在拉取最新代码..."
    git fetch origin
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Git fetch 失败"
        exit 1
    }
    $pullOutput = git pull origin master 2>&1
    if ($pullOutput -match "Already up to date") {
        Write-Host "已经是最新的。"
    } else {
        Write-Host $pullOutput
    }

    # 检查 package-lock.json 变化
    $needNpmInstall = $false
    if (Test-Path $pkgFile) {
        $newPackageLock = (Get-FileHash $pkgFile -Algorithm MD5).Hash
        if ($oldPackageLock -ne $newPackageLock) {
            $needNpmInstall = $true
        }
    }

    # 检查 schema.prisma 变化
    $needPrisma = $false
    if (Test-Path $schemaFile) {
        $newSchema = (Get-FileHash $schemaFile -Algorithm MD5).Hash
        if ($oldSchema -ne $newSchema) {
            $needPrisma = $true
        }
    }

    # 智能构建
    Write-Host ""
    if ($needNpmInstall) {
        Write-Host "检测到依赖变化，正在安装依赖..."
        npm install
    } else {
        Write-Host "依赖无变化，跳过 npm install"
    }

    if ($needPrisma) {
        Write-Host "检测到数据库结构变化，正在更新数据库..."
        npx prisma generate
        npx prisma db push --accept-data-loss
    }

    # 修改管理员密码
    Write-Host ""
    Write-Host "是否修改管理员账号密码？"
    Write-Host "  1 - 跳过（沿用现有账号）"
    Write-Host "  2 - 修改"
    Write-Host ""
    Write-Host -NoNewline "请选择（直接回车选择 1）: "
    $adminChoice = Read-Host
    if ([string]::IsNullOrWhiteSpace($adminChoice)) { $adminChoice = "1" }

    if ($adminChoice -eq "2") {
        Write-Host ""
        Write-Host -NoNewline "  管理员姓名: "
        $adminName = Read-Host
        while ([string]::IsNullOrWhiteSpace($adminName)) {
            Write-Host -ForegroundColor Red "  错误：管理员姓名不能为空"
            Write-Host -NoNewline "  管理员姓名: "
            $adminName = Read-Host
        }

        do {
            $adminPass = Read-Secret "  密码（至少8位）: "
            if ([string]::IsNullOrWhiteSpace($adminPass)) {
                Write-Host -ForegroundColor Red "  错误：密码不能为空"
                continue
            }
            if ($adminPass.Length -lt 8) {
                Write-Host -ForegroundColor Red "  错误：密码至少8位"
                continue
            }
            $adminPassConfirm = Read-Secret "  确认密码: "
            if ($adminPass -ne $adminPassConfirm) {
                Write-Host -ForegroundColor Red "  错误：两次输入的密码不一致"
                $adminPass = ""
            }
        } while ([string]::IsNullOrWhiteSpace($adminPass))

        $env:DATABASE_URL = "file:$($script:PROJECT_ROOT -replace '\\', '/')/prisma/prod.db"
        npx tsx "$script:PROJECT_ROOT/prisma/seed.ts" --reset $adminName $adminPass
        Write-Success "管理员账号已更新"
    }

    # 写入辅助脚本
    Write-HelperScripts

    # 构建
    Write-Host ""
    Write-Host "正在构建..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm run build 失败"
        exit 1
    }

    # 重启 PM2
    Write-Host ""
    Write-Host "正在重启服务..."
    pm2 restart u-plus-lite

    # 更新版本文件
    "v$script:LATEST_VERSION" | Set-Content -Path (Join-Path $script:PROJECT_ROOT "version.txt") -Encoding UTF8

    Write-Host ""
    Write-Success "更新完成"
    Show-Complete ""
}

# ============================================================
# 执行卸载
# ============================================================
function Invoke-Uninstall {
    Write-Host ""
    Write-Host -ForegroundColor Red "警告：即将卸载 U-Plus-Lite"
    Write-Host ""
    Write-Host "此操作将："
    Write-Host "  1. 删除 PM2 服务"
    Write-Host "  2. 删除部署目录: $script:DEPLOY_DIR"
    Write-Host ""
    Write-Host -NoNewline "确认卸载？（输入 YES 确认）: "
    $confirm = Read-Host

    if ($confirm -ne "YES") {
        Write-Host "取消卸载操作"
        exit 0
    }

    Write-Host ""
    Write-Host "正在卸载..."
    pm2 delete u-plus-lite 2>$null
    if (Test-Path $script:DEPLOY_DIR) {
        Remove-Item -Recurse -Force $script:DEPLOY_DIR
    }
    Write-Success "卸载完成"
}

# ============================================================
# 显示完成信息
# ============================================================
function Show-Complete($adminName) {
    $localIP = Get-LocalIP

    Write-Host ""
    Write-Host "=========================================="
    Write-Host "  部署完成！" -ForegroundColor Green
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "访问地址: http://$localIP`:$script:PORT"
    Write-Host ""

    if (-not [string]::IsNullOrWhiteSpace($adminName)) {
        Write-Host "管理员账号: $adminName"
    } else {
        Write-Host "管理员账号: （沿用之前设置）"
    }
    Write-Host "管理员密码: （沿用之前设置）"

    Write-Host ""
    Write-Host "常用命令："
    Write-Host "  pm2 status                查看状态"
    Write-Host "  pm2 logs u-plus-lite      查看日志"
    Write-Host "  pm2 restart u-plus-lite   重启服务"
    Write-Host "  pm2 monit                 实时监控"
    Write-Host "=========================================="
}

# ============================================================
# 主流程
# ============================================================
function Main {
    Test-Dependencies
    Get-LatestVersion
    Detect-Deployment

    if ($script:DEPLOY_MODE -eq "new") {
        Deploy-New
    } else {
        Deploy-Update
    }
}

# 执行主函数
Main
