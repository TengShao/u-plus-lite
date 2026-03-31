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
        Write-Host "是否自动安装？ [Y/n]: " -NoNewline
        $response = Read-Host
        if ([string]::IsNullOrEmpty($response)) { $response = "Y" }
        $response = $response.ToUpper()

        if ($response -ne "Y") {
            Write-Host ""
            Write-Host "部署取消。请先手动安装缺少的依赖后，重新运行脚本。" -ForegroundColor Red
            Write-Host ""
            Write-Host "安装指引："
            Write-Host "  下载 Node.js: https://nodejs.org/"
            Write-Host "  下载 Git: https://git-scm.com/download/win"
            exit 1
        }

        Write-Host ""
        Write-Host "正在安装依赖..."
        Write-Host ""

        # 安装 Git
        if ($missingDeps -contains "git") {
            Write-Host "正在安装 Git..."
            $gitInstaller = "$env:TEMP\git-installer.exe"
            Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.45.1.windows.1/Git-2.45.1-64-bit.exe" -OutFile $gitInstaller
            Start-Process -Wait -FilePath $gitInstaller -ArgumentList "/S", "/NOLICENSE"
            Write-Status "ok" "Git 安装完成"
            # 刷新 PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        }

        # 安装 Node.js
        if ($missingDeps -contains "node") {
            Write-Host "正在安装 Node.js..."
            $nodeInstaller = "$env:TEMP\node-installer.msi"
            $nodeVersion = "v22.12.0"
            $nodeUrl = "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-x64.msi"
            Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller
            Start-Process -Wait -FilePath "msiexec.exe" -ArgumentList "/i `"$nodeInstaller`" /quiet"
            Write-Status "ok" "Node.js 安装完成"
            # 刷新 PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        }

        Write-Host ""
        Write-Host "所有依赖检测通过，继续部署..."
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
        Set-Location $script:DEPLOY_DIR
        $script:UPDATE_MODE = $true
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

        Write-Host "[1/7] 正在克隆代码仓库..."
        git clone $REPO_URL $script:DEPLOY_DIR
        Set-Location $script:DEPLOY_DIR
        $script:UPDATE_MODE = $false

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
    }
}

# ============================================================
# Step 3: 安装依赖
# ============================================================
function Install-Deps {
    Write-Host "[2/7] 安装项目依赖..."
    npm install
}

# ============================================================
# Step 4: Prisma 初始化
# ============================================================
function Initialize-Prisma {
    Write-Host "[3/7] 生成 Prisma 客户端..."
    npx prisma generate

    Write-Host "[4/7] 应用数据库迁移..."
    npx prisma migrate deploy
}

# ============================================================
# Step 5: 创建管理员（仅首次）
# ============================================================
function Initialize-Admin {
    if ($script:UPDATE_MODE) {
        Write-Host "[5/7] 跳过管理员创建（更新模式）..."
        return
    }

    Write-Host "[5/7] 创建管理员账号..."
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

    npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts $script:ADMIN_NAME $script:ADMIN_PASSWORD
}

# ============================================================
# Step 6: 构建并启动
# ============================================================
function Start-Service {
    Write-Host "[6/7] 构建生产版本..."
    npm run build

    Write-Host "[7/7] 启动 PM2 服务..."

    # 安装/更新 PM2
    npm install -g pm2 --silent 2>$null

    # 停止旧实例
    pm2 delete u-plus-lite 2>$null

    # 启动服务
    $script:PORT = Find-AvailablePort
    Write-Host "使用端口：$script:PORT"

    $env:PORT = $script:PORT
    pm2 start npm -- start --name u-plus-lite
    pm2 save

    # 自启配置
    Write-Host ""
    Write-Host "配置开机自启..."
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
}

# ============================================================
# Step 7: 配置 NEXTAUTH_URL
# ============================================================
function Set-NextAuthUrl {
    Write-Host "[配置] 更新 NEXTAUTH_URL..."

    $localIP = Get-LocalIP

    if (Test-Path ".env") {
        $content = Get-Content ".env" -Raw
        $content = $content -replace 'NEXTAUTH_URL=.*', "NEXTAUTH_URL=`"http://$localIP`:$script:PORT`""
        Set-Content ".env" -Value $content
        Write-Host "NEXTAUTH_URL 已更新为 http://$localIP`:$script:PORT"
    }
}

# ============================================================
# Step 8: CSV import (optional)
# ============================================================
function Import-CsvData {
    # 确保从项目根目录执行
    Set-Location $ProjectRoot

    Write-Host ""
    Write-Host "[8/8] 是否导入预算项和管线数据？" -ForegroundColor Cyan
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
            Invoke-Expression "npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' prisma/import.ts $cmdArgs"
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

        if (-not [string]::IsNullOrEmpty($pipelinesContent)) {
            $pipelinesContent | npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/import.ts --pipelines=-
        }
        if (-not [string]::IsNullOrEmpty($budgetContent)) {
            $budgetContent | npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/import.ts --budget-items=-
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
    Start-Service       # Step 6: 构建并启动
    Set-NextAuthUrl     # Step 7: 配置 NEXTAUTH_URL
    Import-CsvData      # Step 8: CSV import
    Show-Complete       # 完成
}

Main
