# U-Plus-Lite 一键部署脚本（Windows PowerShell）
# 使用方式：以管理员身份运行 PowerShell，然后执行本脚本
#   powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$REPO_URL = "https://github.com/TengShao/u-plus-lite.git"
$DEFAULT_DIR = "$env:USERPROFILE\u-plus-lite"
$PROJECT_ROOT = ""
$DEPLOY_MODE = ""
$SELECTED_PORT = 3000

# ============================================================
# 颜色和输出函数
# ============================================================
function Write-Success($msg) { Write-Host "[+] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[X] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Step($msg) { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-Info($msg) { Write-Host "[-] $msg" -ForegroundColor Yellow }
function Write-HostL($msg) { Write-Host $msg }

# ============================================================
# 获取本机局域网 IP（192.168.x.x）
# ============================================================
function Get-LocalIP {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Manual, Dhcp -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -like '192.168.*' } |
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
# 查找可用端口（从 3000 开始）
# ============================================================
function Find-AvailablePort($startPort = 3000) {
    $port = $startPort
    while (Test-PortUsed $port) {
        $port++
    }
    return $port
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
# Step 0: 依赖检测 + 自动安装
# ============================================================
function Test-Dependencies {
    Write-Host ""
    Write-Step "检测系统依赖..."
    Write-Host ""

    # Chocolatey 检测
    $chocoInstalled = Test-Command choco
    if (-not $chocoInstalled) {
        Write-Warn "Chocolatey 未安装，正在安装..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
        if (Test-Command choco) {
            Write-Success "Chocolatey 安装成功"
        } else {
            Write-Fail "Chocolatey 安装失败，请手动安装后重试"
            exit 1
        }
    }

    # Git 检测
    if (Test-Command git) {
        $gitVer = (git --version) -replace "git version ", ""
        Write-Success "Git: $gitVer"
    } else {
        Write-Warn "Git 未安装，正在安装..."
        choco install git -y --params "/GitOnlyNow /NoAutoCrlf"
        if (Test-Command git) {
            Write-Success "Git 安装成功"
        } else {
            Write-Fail "Git 安装失败，请手动安装后重试"
            exit 1
        }
    }

    # Node.js 检测
    if (Test-Command node) {
        $nodeVer = node -v
        Write-Success "Node.js: $nodeVer"
    } else {
        Write-Warn "Node.js 未安装，正在安装..."
        choco install nodejs -y --version=20
        if (Test-Command node) {
            Write-Success "Node.js 安装成功"
        } else {
            Write-Fail "Node.js 安装失败，请手动安装后重试"
            exit 1
        }
    }

    # PM2 检测
    if (Test-Command pm2) {
        $pm2Ver = (pm2 --version)
        Write-Success "PM2: $pm2Ver"
    } else {
        Write-Warn "PM2 未安装，正在安装..."
        npm install -g pm2
        if (Test-Command pm2) {
            Write-Success "PM2 安装成功"
        } else {
            Write-Fail "PM2 安装失败，请手动安装后重试"
            exit 1
        }
    }

    Write-Host ""
    Write-Success "所有依赖检测通过！"
}

# ============================================================
# 获取 GitHub 最新版本
# ============================================================
function Get-LatestVersion {
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/TengShao/u-plus-lite/releases/latest" -TimeoutSec 10
        return $response.tag_name -replace "^v", ""
    } catch {
        return "unknown"
    }
}

# ============================================================
# 获取本地已部署版本
# ============================================================
function Get-LocalVersion($deployDir) {
    $versionFile = Join-Path $deployDir "version.txt"
    if (Test-Path $versionFile) {
        return (Get-Content $versionFile -Raw).Trim()
    }
    # 尝试从 git 读取
    $gitDir = Join-Path $deployDir ".git"
    if (Test-Path $gitDir) {
        Push-Location $deployDir
        try {
            $tag = git describe --tags --abbrev=0 2>$null
            if ($tag) { return $tag -replace "^v", "" }
        } catch {}
        Pop-Location
    }
    return "unknown"
}

# ============================================================
# 检测部署状态
# ============================================================
function Detect-Deployment {
    $gitDir = Join-Path $DEFAULT_DIR ".git"

    if (Test-Path $gitDir) {
        $script:DEPLOY_MODE = "update"
        $script:PROJECT_ROOT = $DEFAULT_DIR
        Write-Host ""
        Write-Warn "检测到已有部署，进入更新模式"
    } else {
        Write-Host ""
        Write-Step "选择部署模式"
        Write-Host ""
        Write-Host "  1 - 全新部署（首次安装）"
        Write-Host "  2 - 自定义路径部署"
        Write-Host ""
        Write-Host -NoNewline "请选择 [1]: "
        $choice = Read-Host

        if ($choice -eq "2") {
            Write-Host -NoNewline "请输入部署目录路径: "
            $customPath = Read-Host
            if (-not [string]::IsNullOrWhiteSpace($customPath)) {
                $script:DEFAULT_DIR = $customPath
                if ((Split-Path $script:DEFAULT_DIR -Leaf) -ne "u-plus-lite") {
                    $script:DEFAULT_DIR = Join-Path $script:DEFAULT_DIR "u-plus-lite"
                }
            }
        } else {
            # 全新部署也提示确认路径
            Write-Host ""
            Write-Host -NoNewline "请输入部署目录路径（直接回车使用 $script:DEFAULT_DIR）: "
            $customPath = Read-Host
            if (-not [string]::IsNullOrWhiteSpace($customPath)) {
                $script:DEFAULT_DIR = $customPath
                if ((Split-Path $script:DEFAULT_DIR -Leaf) -ne "u-plus-lite") {
                    $script:DEFAULT_DIR = Join-Path $script:DEFAULT_DIR "u-plus-lite"
                }
            }
        }

        $script:DEPLOY_MODE = "new"
        $script:PROJECT_ROOT = $DEFAULT_DIR
    }
}

# ============================================================
# 智能构建检测（检查文件变更）
# ============================================================
function Test-SmartBuildNeeded {
    Push-Location $script:PROJECT_ROOT
    try {
        $gitStatus = git status --porcelain
        $packageChanged = $gitStatus -match "package-lock\.json"
        $schemaChanged = $gitStatus -match "schema\.prisma"
        return ($packageChanged -or $schemaChanged)
    } finally {
        Pop-Location
    }
}

# ============================================================
# 导入 CSV 数据
# ============================================================
function Import-CsvData {
    Write-Host ""
    Write-Step "CSV 数据导入"
    Write-Host ""
    Write-Host "  1 - 使用 deploy 目录下的 CSV 文件"
    Write-Host "  2 - 指定自定义路径"
    Write-Host "  3 - 跳过（稍后手动导入）"
    Write-Host ""
    Write-Host -NoNewline "请选择 [3]: "
    $choice = Read-Host

    if ($choice -eq "1") {
        $pipelinesPath = Join-Path $script:PROJECT_ROOT "deploy\pipelines.csv"
        $budgetPath = Join-Path $script:PROJECT_ROOT "deploy\budget_items.csv"

        if (-not (Test-Path $pipelinesPath) -and -not (Test-Path $budgetPath)) {
            Write-Warn "deploy 目录下未找到 CSV 文件，跳过导入"
            return
        }

        Write-Host ""
        Write-Step "正在导入管线和预算项..."
        Set-Location $script:PROJECT_ROOT

        if ((Test-Path $pipelinesPath) -and (Test-Path $budgetPath)) {
            npx tsx prisma/import.ts --pipelines=$pipelinesPath --budget-items=$budgetPath
        } elseif (Test-Path $pipelinesPath) {
            npx tsx prisma/import.ts --pipelines=$pipelinesPath
        } elseif (Test-Path $budgetPath) {
            npx tsx prisma/import.ts --budget-items=$budgetPath
        }
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "CSV 导入失败"
        } else {
            Write-Success "CSV 导入完成"
        }

    } elseif ($choice -eq "2") {
        Write-Host ""
        Write-Host -NoNewline "管线 CSV 路径（留空跳过）: "
        $pipelinesPath = Read-Host
        Write-Host -NoNewline "预算项 CSV 路径（留空跳过）: "
        $budgetPath = Read-Host

        if (-not [string]::IsNullOrWhiteSpace($pipelinesPath) -or -not [string]::IsNullOrWhiteSpace($budgetPath)) {
            Set-Location $script:PROJECT_ROOT
            if (-not [string]::IsNullOrWhiteSpace($pipelinesPath) -and -not [string]::IsNullOrWhiteSpace($budgetPath)) {
                npx tsx prisma/import.ts --pipelines=$pipelinesPath --budget-items=$budgetPath
            } elseif (-not [string]::IsNullOrWhiteSpace($pipelinesPath)) {
                npx tsx prisma/import.ts --pipelines=$pipelinesPath
            } else {
                npx tsx prisma/import.ts --budget-items=$budgetPath
            }
            Write-Success "CSV 导入完成"
        } else {
            Write-Info "跳过导入"
        }
    } else {
        Write-Info "跳过 CSV 导入，管理员可在 Web 端手动添加"
    }
}

# ============================================================
# 全新部署
# ============================================================
function Deploy-New {
    Write-Host ""
    Write-Step "开始全新部署到: $script:PROJECT_ROOT"
    Write-Host ""

    # [1/9] 克隆代码
    Write-Step "[1/9] 克隆代码仓库..."

    if (Test-Path $script:PROJECT_ROOT) {
        Write-Warn "目录已存在，正在清理..."
        Remove-Item -Recurse -Force $script:PROJECT_ROOT
    }

    git clone $REPO_URL $script:PROJECT_ROOT
    Set-Location $script:PROJECT_ROOT

    # [2/9] 安装依赖
    Write-Step "[2/9] 安装项目依赖..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm install 失败"
        exit 1
    }

    # [3/9] Prisma 初始化
    $dbUrl = "file:" + (Join-Path $script:PROJECT_ROOT "prisma\prod.db").Replace("\", "/")
    $env:DATABASE_URL = $dbUrl
    Write-Step "[3/9] 生成 Prisma 客户端..."
    npx prisma generate
    Write-Step "[3/9] 应用数据库迁移..."
    npx prisma db push --accept-data-loss

    # [4/9] 创建管理员
    Write-Step "[4/9] 创建管理员账号"
    Write-Host ""

    $adminName = ""
    $adminPass = ""

    do {
        Write-Host -NoNewline "  管理员姓名: "
        $adminName = Read-Host
        if ([string]::IsNullOrWhiteSpace($adminName)) {
            Write-Warn "  姓名不能为空"
        }
    } while ([string]::IsNullOrWhiteSpace($adminName))

    do {
        $adminPass = Read-Secret "  密码: "
        if ([string]::IsNullOrWhiteSpace($adminPass)) {
            Write-Warn "  密码不能为空"
            continue
        }
        if ($adminPass.Length -lt 8) {
            Write-Warn "  密码至少8位"
            $adminPass = ""
            continue
        }
        $adminPassConfirm = Read-Secret "  确认密码: "
        if ($adminPass -ne $adminPassConfirm) {
            Write-Warn "  两次密码不一致"
            $adminPass = ""
        }
    } while ([string]::IsNullOrWhiteSpace($adminPass))

    # 执行 seed
    Set-Location $script:PROJECT_ROOT
    npx tsx prisma/seed.ts $adminName $adminPass
    Write-Success "  管理员创建成功"

    # [5/9] .env 配置
    Write-Step "[5/9] 配置环境变量..."

    # 端口检测
    if (Test-PortUsed 3000) {
        Write-Warn "端口 3000 被占用"
        Write-Host ""
        Write-Host "  1 - 结束占用端口 3000 的进程"
        Write-Host "  2 - 查找下一个可用端口"
        Write-Host "  3 - 手动输入端口"
        Write-Host ""
        Write-Host -NoNewline "请选择 [1]: "
        $portChoice = Read-Host

        if ($portChoice -eq "2") {
            $script:SELECTED_PORT = Find-AvailablePort
            Write-Host "  将使用端口: $script:SELECTED_PORT"
        } elseif ($portChoice -eq "3") {
            Write-Host -NoNewline "请输入端口号: "
            $script:SELECTED_PORT = [int](Read-Host)
        } else {
            # 默认选项 1: 结束占用端口 3000 的进程
            Get-NetTCPConnection -LocalPort 3000 | Stop-Process -Force
            $script:SELECTED_PORT = 3000
            Write-Host "  端口 3000 已释放，将使用端口: $script:SELECTED_PORT"
        }
    }

    # 生成 .env
    $envPath = Join-Path $script:PROJECT_ROOT ".env"
    $dbUrl = "file:" + (Join-Path $script:PROJECT_ROOT "prisma\prod.db").Replace("\", "/")
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::GetBytes($bytes)
    $nextAuthSecret = [Convert]::ToBase64String($bytes)
    $localIP = Get-LocalIP

    $envContent = "DATABASE_URL=`"$dbUrl`"" + [Environment]::NewLine
    $envContent += "NEXTAUTH_SECRET=`"$nextAuthSecret`"" + [Environment]::NewLine
    $envContent += "NEXTAUTH_URL=`"http://$localIP`:$script:SELECTED_PORT`""

    [System.IO.File]::WriteAllText($envPath, $envContent, [System.Text.Encoding]::UTF8)
    Write-Success "  .env 配置完成"

    # [6/9] 构建
    Write-Step "[6/9] 构建生产版本..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "构建失败"
        exit 1
    }

    # [7/9] PM2 启动
    Write-Step "[7/9] 配置 PM2 并启动服务..."

    # 复制 CSV 文件到项目目录
    $deployDir = Split-Path $script:PROJECT_ROOT -Parent
    $deployDir = Split-Path $deployDir -Leaf
    $srcPipelines = Join-Path (Split-Path $script:PROJECT_ROOT -Parent) "deploy\pipelines.csv"
    $srcBudget = Join-Path (Split-Path $script:PROJECT_ROOT -Parent) "deploy\budget_items.csv"
    $destPipelines = Join-Path $script:PROJECT_ROOT "deploy\pipelines.csv"
    $destBudget = Join-Path $script:PROJECT_ROOT "deploy\budget_items.csv"

    if ((Test-Path $srcPipelines) -and -not (Test-Path $destPipelines)) {
        Copy-Item $srcPipelines $destPipelines -Force
    }
    if ((Test-Path $srcBudget) -and -not (Test-Path $destBudget)) {
        Copy-Item $srcBudget $destBudget -Force
    }

    Set-Location $script:PROJECT_ROOT
    pm2 delete u-plus-lite 2>$null
    $portEnv = "PORT=$script:SELECTED_PORT"
    pm2 start npm --name "u-plus-lite" -- start --env $portEnv
    Start-Sleep -Seconds 3

    $pm2Status = pm2 list | Select-String "u-plus-lite"
    if ($pm2Status -match "online") {
        Write-Success "  服务已启动 (PM2)"
    } else {
        Write-Warn "  服务状态待确认，请运行 pm2 list 检查"
    }

    # [8/9] 写入版本
    Write-Step "[8/9] 记录版本信息..."
    $latestVersion = Get-LatestVersion
    $versionFile = Join-Path $script:PROJECT_ROOT "version.txt"
    [System.IO.File]::WriteAllText($versionFile, $latestVersion, [System.Text.Encoding]::UTF8)
    Write-Success "  版本: $latestVersion"

    # [9/9] CSV 导入
    Write-Step "[9/9] CSV 数据导入"
    Import-CsvData

    # 自动启动询问
    Write-Host ""
    Write-Step "配置 PM2 自动启动"
    Write-Host ""
    Write-Host -NoNewline "  是否设置开机自动启动？[Y/n]: "
    $autostart = Read-Host
    if ($autostart -ne "n" -and $autostart -ne "N") {
        pm2 startup
        pm2 save
        Write-Success "  已配置开机自动启动"
    }

    # 返回管理员信息供 Show-Complete 使用
    $script:DEPLOY_ADMIN_NAME = $adminName
    $script:DEPLOY_ADMIN_PASS = $adminPass
}

# ============================================================
# 更新部署
# ============================================================
function Deploy-Update {
    Write-Host ""
    Write-Step "更新现有部署: $script:PROJECT_ROOT"
    Write-Host ""

    $localVersion = Get-LocalVersion $script:PROJECT_ROOT
    $latestVersion = Get-LatestVersion

    Write-Host "  本地版本: $localVersion"
    Write-Host "  最新版本: $latestVersion"
    Write-Host ""

    # 版本对比
    if ($localVersion -eq $latestVersion) {
        Write-Info "已是最新版本"
    } elseif ($localVersion -ne "unknown" -and $latestVersion -ne "unknown") {
        $localParts = $localVersion -split "\."
        $latestParts = $latestVersion -split "\."
        $needsUpdate = $false
        for ($i = 0; $i -lt [Math]::Min($localParts.Length, $latestParts.Length); $i++) {
            if ([int]$latestParts[$i] -gt [int]$localParts[$i]) {
                $needsUpdate = $true
                break
            }
        }
        if ($needsUpdate) {
            Write-Info "检测到新版本可用"
        }
    }

    Write-Host "  1 - 更新部署"
    Write-Host "  2 - 卸载（删除所有数据）"
    Write-Host "  3 - 重新安装（保留数据库）"
    Write-Host ""
    Write-Host -NoNewline "请选择 [1]: "
    $choice = Read-Host
    if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

    if ($choice -eq "1") {
        # 更新模式
        Write-Step "正在更新代码..."
        Set-Location $script:PROJECT_ROOT
        git fetch origin
        if ($LASTEXITCODE -ne 0) { Write-Warn "git fetch 失败" }
        git stash
        if ($LASTEXITCODE -ne 0) { Write-Warn "git stash 失败" }
        git checkout master
        if ($LASTEXITCODE -ne 0) { Write-Warn "git checkout 失败" }
        git pull origin master
        if ($LASTEXITCODE -ne 0) { Write-Warn "git pull 失败" }
        git stash pop
        if ($LASTEXITCODE -ne 0) { Write-Warn "git stash pop 失败（可能没有暂存的更改）" }

        # 智能构建
        if (Test-SmartBuildNeeded) {
            Write-Step "检测到依赖或 schema 变更，重新安装依赖..."
            npm install
            npx prisma generate
            npx prisma db push --accept-data-loss
            Write-Step "重新构建..."
            npm run build
        } else {
            Write-Info "无重大变更，跳过依赖安装和构建"
        }

        # 重启 PM2
        Write-Step "重启服务..."
        pm2 restart u-plus-lite
        Write-Success "更新完成"

    } elseif ($choice -eq "2") {
        # 卸载
        Write-Host ""
        Write-Host -NoNewline "确认卸载？此操作将删除所有数据，输入 YES 确认: "
        $confirm = Read-Host
        if ($confirm -ne "YES") {
            Write-Info "已取消卸载"
            return
        }

        Write-Step "正在卸载..."
        Set-Location $script:PROJECT_ROOT
        pm2 delete u-plus-lite 2>$null
        pm2 save 2>$null
        Remove-Item -Recurse -Force $script:PROJECT_ROOT
        Write-Success "卸载完成"

    } elseif ($choice -eq "3") {
        # 重新安装
        Write-Host ""
        Write-Warn "重新安装将保留数据库文件"
        Write-Host -NoNewline "确认重新安装？[y/N]: "
        $confirm = Read-Host
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Info "已取消"
            return
        }

        Set-Location $script:PROJECT_ROOT
        git fetch origin
        if ($LASTEXITCODE -ne 0) { Write-Warn "git fetch 失败" }
        git stash
        if ($LASTEXITCODE -ne 0) { Write-Warn "git stash 失败" }
        git checkout master
        if ($LASTEXITCODE -ne 0) { Write-Warn "git checkout 失败" }
        git pull origin master
        if ($LASTEXITCODE -ne 0) { Write-Warn "git pull 失败" }
        git stash pop
        if ($LASTEXITCODE -ne 0) { Write-Warn "git stash pop 失败（可能没有暂存的更改）" }

        # 智能构建
        if (Test-SmartBuildNeeded) {
            npm install
            npx prisma generate
        }

        npm run build
        pm2 restart u-plus-lite
        Write-Success "重新安装完成"
    }
}

# ============================================================
# 完成信息
# ============================================================
function Show-Complete {
    $localIP = Get-LocalIP
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "  部署完成！" -ForegroundColor Green
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "访问地址: http://$localIP`:$script:SELECTED_PORT"
    Write-Host ""

    if ($script:DEPLOY_MODE -eq "new") {
        Write-Host "管理员账号: $script:DEPLOY_ADMIN_NAME"
        Write-Host "管理员密码: $script:DEPLOY_ADMIN_PASS"
        Write-Host ""
    }

    Write-Host "常用命令:"
    Write-Host "  pm2 list              查看服务状态"
    Write-Host "  pm2 restart u-plus-lite  重启服务"
    Write-Host "  pm2 logs u-plus-lite    查看日志"
    Write-Host "  pm2 stop u-plus-lite    停止服务"
    Write-Host ""
    Write-Host "重新运行本脚本可进入更新模式"
    Write-Host "=========================================="
}

# ============================================================
# 主流程
# ============================================================
function Main {
    # 检查管理员权限
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

    Write-Host ""
    Write-Host "=========================================="
    Write-Host "  U-Plus-Lite 部署脚本"
    Write-Host "=========================================="
    Write-Host ""

    if (-not $isAdmin) {
        Write-Warn "建议以管理员身份运行以避免权限问题"
        Write-Host ""
    }

    # 显示最新版本信息
    $latestVer = Get-LatestVersion
    Write-Host "GitHub 最新版本: $latestVer"
    Write-Host "默认部署路径: $DEFAULT_DIR"
    Write-Host ""

    # 依赖检测
    Test-Dependencies

    # 部署模式检测
    Detect-Deployment

    # 显示当前版本
    if ($DEPLOY_MODE -eq "new") {
        Write-Host "当前版本: 全新部署"
    } else {
        $currentVer = Get-LocalVersion $DEFAULT_DIR
        Write-Host "当前版本: $currentVer"
    }
    Write-Host ""

    # 执行部署
    if ($DEPLOY_MODE -eq "new") {
        Deploy-New
    } else {
        Deploy-Update
    }

    # 完成
    Show-Complete
}

# 执行主函数
Main
