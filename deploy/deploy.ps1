# U-Plus-Lite 一键部署脚本（Windows PowerShell）
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$script:REPO_SLUG = "TengShao/u-plus-lite"
$script:RELEASE_API_URL = "https://api.github.com/repos/$($script:REPO_SLUG)/releases/latest"
$script:DEFAULT_DIR = Join-Path $env:USERPROFILE "u-plus-lite"
$script:DEPLOY_DIR = ""
$script:DEPLOY_MODE = ""
$script:PROJECT_ROOT = ""
$script:LATEST_VERSION = "unknown"
$script:RELEASE_URL = ""
$script:PORT = 3000
$script:RUNTIME_DIR = $null
$script:LAST_INTERACTIVE_STATUS = 0

function Write-Success($Message) { Write-Host "[+] $Message" -ForegroundColor Green }
function Write-Fail($Message) { Write-Host "[-] $Message" -ForegroundColor Red }
function Write-Warn($Message) { Write-Host "[!] $Message" -ForegroundColor Yellow }

function Test-Command($Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-LocalIP {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } |
        Select-Object -First 1 -ExpandProperty IPAddress
    if (-not $ip) { $ip = "127.0.0.1" }
    return $ip
}

function Test-PortUsed($Port) {
    return $null -ne (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Find-AvailablePort {
    $port = 3000
    while (Test-PortUsed $port) {
        $port++
    }
    return $port
}

function Read-Secret($Prompt) {
    Write-Host -NoNewline $Prompt
    $secureValue = Read-Host -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        Write-Host ""
    }
}

function Get-InteractiveHelperPath {
    $scriptDir = if ($PSScriptRoot) {
        $PSScriptRoot
    } elseif ($PSCommandPath) {
        Split-Path -Parent $PSCommandPath
    } else {
        $PWD.Path
    }

    $helper = Join-Path $scriptDir "interactive\index.cjs"
    if (Test-Path $helper) { return $helper }
    return $null
}

function Test-InteractiveHelper {
    $helper = Get-InteractiveHelperPath
    return ($null -ne $helper) -and (Test-Command node) -and ($Host.UI.RawUI -ne $null)
}

function Invoke-InteractiveSelect {
    param(
        [string]$Message,
        [string]$DefaultValue,
        [bool]$AllowCancel,
        [string[]]$Choices
    )

    $script:LAST_INTERACTIVE_STATUS = 0

    if (Test-InteractiveHelper) {
        $helper = Get-InteractiveHelperPath
        $serializedChoices = ($Choices | ForEach-Object {
            $parts = $_ -split '\|', 2
            if ($parts.Count -lt 2) { return $_ }
            "$($parts[0])`t$($parts[1])"
        }) -join "`n"

        $previousMessage = $env:CLI_MESSAGE
        $previousDefault = $env:CLI_DEFAULT
        $previousChoices = $env:CLI_CHOICES

        $env:CLI_MESSAGE = $Message
        $env:CLI_DEFAULT = $DefaultValue
        $env:CLI_CHOICES = $serializedChoices

        try {
            $result = & node $helper select
            $status = $LASTEXITCODE
        } finally {
            $env:CLI_MESSAGE = $previousMessage
            $env:CLI_DEFAULT = $previousDefault
            $env:CLI_CHOICES = $previousChoices
        }

        $script:LAST_INTERACTIVE_STATUS = $status
        if ($status -eq 0) { return $result }
        if ($status -eq 130 -and $AllowCancel) { return $null }
    }

    Write-Host $Message
    foreach ($choice in $Choices) {
        $parts = $choice -split '\|', 2
        $value = $parts[0]
        $label = if ($parts.Count -gt 1) { $parts[1] } else { $parts[0] }
        Write-Host "  $value - $label"
    }
    Write-Host ""

    if ($AllowCancel) {
        Write-Host -NoNewline "请选择（直接回车选择 $DefaultValue，输入 q 退出）: "
    } else {
        Write-Host -NoNewline "请选择（直接回车选择 $DefaultValue）: "
    }

    $result = Read-Host
    if ([string]::IsNullOrWhiteSpace($result)) { $result = $DefaultValue }
    if ($AllowCancel -and ($result -eq "q" -or $result -eq "Q")) {
        $script:LAST_INTERACTIVE_STATUS = 130
        return $null
    }

    return $result
}

function Invoke-InteractiveConfirm {
    param(
        [string]$Message,
        [bool]$DefaultValue = $true
    )

    $defaultChoice = if ($DefaultValue) { "true" } else { "false" }
    return Invoke-InteractiveSelect -Message $Message -DefaultValue $defaultChoice -AllowCancel $true -Choices @(
        "true|是",
        "false|否"
    )
}

function New-Secret {
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

function Remove-RuntimeHelpers {
    if ($script:RUNTIME_DIR -and (Test-Path $script:RUNTIME_DIR)) {
        Remove-Item -Recurse -Force $script:RUNTIME_DIR
    }
    $script:RUNTIME_DIR = $null
}

function New-RuntimeHelpers($ProjectDir) {
    Remove-RuntimeHelpers
    $script:RUNTIME_DIR = Join-Path ([System.IO.Path]::GetTempPath()) ("u-plus-lite-runtime-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $script:RUNTIME_DIR | Out-Null

    @'
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
'@ | Set-Content -Path (Join-Path $script:RUNTIME_DIR "seed.cjs") -Encoding UTF8

    @'
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
'@ | Set-Content -Path (Join-Path $script:RUNTIME_DIR "import.cjs") -Encoding UTF8
}

function Invoke-RuntimeSeed {
    param(
        [string]$ProjectDir,
        [string[]]$Arguments
    )

    New-RuntimeHelpers $ProjectDir
    $previousNodePath = $env:NODE_PATH
    try {
        $env:NODE_PATH = Join-Path $ProjectDir "node_modules"
        & node (Join-Path $script:RUNTIME_DIR "seed.cjs") @Arguments
        if ($LASTEXITCODE -ne 0) { throw "管理员脚本执行失败" }
    } finally {
        $env:NODE_PATH = $previousNodePath
    }
}

function Invoke-RuntimeImport {
    param(
        [string]$ProjectDir,
        [string[]]$Arguments
    )

    New-RuntimeHelpers $ProjectDir
    $previousNodePath = $env:NODE_PATH
    try {
        $env:NODE_PATH = Join-Path $ProjectDir "node_modules"
        & node (Join-Path $script:RUNTIME_DIR "import.cjs") @Arguments
        if ($LASTEXITCODE -ne 0) { throw "CSV 导入脚本执行失败" }
    } finally {
        $env:NODE_PATH = $previousNodePath
    }
}

function Test-Dependencies {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host " U-Plus-Lite 部署脚本"
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "正在检测系统依赖..."
    Write-Host ""

    $missing = New-Object System.Collections.Generic.List[string]
    $needInstall = New-Object System.Collections.Generic.List[string]

    if (Test-Command node) {
        $nodeVersion = node -v
        $majorVersion = [int](($nodeVersion -replace '^v', '') -replace '\..*$', '')
        if ($majorVersion -ge 18) {
            Write-Success "Node.js: $nodeVersion"
        } else {
            Write-Fail "Node.js: $nodeVersion (需要 v18+)"
            $missing.Add("node")
        }
    } else {
        Write-Fail "Node.js: 未安装"
        $missing.Add("node")
    }

    Write-Success "Release 下载: 使用系统内置 HTTP 能力"
    Write-Success "压缩解包: 使用系统内置 Expand-Archive"

    if (Test-Command pm2) {
        Write-Success "PM2: 已安装"
    } else {
        Write-Fail "PM2: 未安装"
        $needInstall.Add("pm2")
    }

    if ($missing.Contains("node")) {
        Write-Host ""
        Write-Warn "检测到 Node.js 未安装，正在尝试自动安装..."
        $installOk = $false
        if (Test-Command winget) {
            try {
                winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements | Out-Null
                if (Test-Command node) { $installOk = $true }
            } catch {}
        }
        if (-not $installOk -and (Test-Command choco)) {
            try {
                choco install nodejs -y --version=20 | Out-Null
                if (Test-Command node) { $installOk = $true }
            } catch {}
        }
        if (-not $installOk) {
            Write-Fail "无法自动安装 Node.js，请手动安装后重试"
            exit 1
        }
        Write-Success "Node.js 安装成功: $(node -v)"
    }

    if ($needInstall.Contains("pm2")) {
        Write-Host ""
        Write-Host "正在安装 PM2..."
        try {
            npm install -g pm2 --silent | Out-Null
        } catch {}
        if (-not (Test-Command pm2)) {
            Write-Fail "PM2 安装失败，请手动执行: npm install -g pm2"
            exit 1
        }
        Write-Success "PM2 安装成功"
    }

    Write-Host ""
    Write-Success "所有依赖检测通过！"
}

function Test-SourceRepo($Directory) {
    return (Test-Path (Join-Path $Directory ".git")) -and
        (Test-Path (Join-Path $Directory "package.json")) -and
        (Test-Path (Join-Path $Directory "prisma\schema.prisma")) -and
        (Test-Path (Join-Path $Directory "src\app")) -and
        (Test-Path (Join-Path $Directory "deploy\deploy.ps1"))
}

function Test-DeploymentInstance($Directory) {
    if (-not (Test-Path $Directory)) { return $false }
    if (Test-SourceRepo $Directory) { return $false }
    if (-not (Test-Path (Join-Path $Directory "package.json"))) { return $false }
    if (-not (Test-Path (Join-Path $Directory "prisma"))) { return $false }
    return (Test-Path (Join-Path $Directory ".env.local")) -or (Test-Path (Join-Path $Directory "version.txt"))
}

function Get-LatestReleaseInfo {
    Write-Host ""
    Write-Host "正在检查最新版本..."

    try {
        $response = Invoke-RestMethod -Uri $script:RELEASE_API_URL -TimeoutSec 15
    } catch {
        Write-Fail "无法获取最新版本信息"
        exit 1
    }

    $version = ($response.tag_name -replace '^v', '')
    $assetName = "u-plus-lite-v$version-windows.zip"
    $asset = $response.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1

    if ([string]::IsNullOrWhiteSpace($version) -or $null -eq $asset -or [string]::IsNullOrWhiteSpace($asset.browser_download_url)) {
        Write-Fail "最新 release 缺少可用部署包"
        exit 1
    }

    $script:LATEST_VERSION = $version
    $script:RELEASE_URL = $asset.browser_download_url
    Write-Success "最新版本: v$($script:LATEST_VERSION)"
}

function Get-CurrentDeployedVersion($Directory) {
    $versionFile = Join-Path $Directory "version.txt"
    if (Test-Path $versionFile) {
        return (Get-Content $versionFile -Raw).Trim()
    }
    return "unknown"
}

function Download-ReleaseArchive($Url, $OutputPath) {
    Invoke-WebRequest -Uri $Url -OutFile $OutputPath
}

function Expand-ReleaseArchive($ArchivePath, $Destination) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Expand-Archive -Path $ArchivePath -DestinationPath $Destination -Force
}

function Sync-ReleaseContents($SourceDir, $TargetDir) {
    $preserveDir = Join-Path ([System.IO.Path]::GetTempPath()) ("u-plus-lite-preserve-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $preserveDir | Out-Null

    try {
        if (Test-Path (Join-Path $TargetDir ".env.local")) {
            Copy-Item (Join-Path $TargetDir ".env.local") (Join-Path $preserveDir ".env.local") -Force
        }
        if (Test-Path (Join-Path $TargetDir "version.txt")) {
            Copy-Item (Join-Path $TargetDir "version.txt") (Join-Path $preserveDir "version.txt") -Force
        }
        if (Test-Path (Join-Path $TargetDir "prisma\prod.db")) {
            New-Item -ItemType Directory -Path (Join-Path $preserveDir "prisma") -Force | Out-Null
            Copy-Item (Join-Path $TargetDir "prisma\prod.db") (Join-Path $preserveDir "prisma\prod.db") -Force
        }
        if (Test-Path (Join-Path $TargetDir "prisma\dev.db")) {
            New-Item -ItemType Directory -Path (Join-Path $preserveDir "prisma") -Force | Out-Null
            Copy-Item (Join-Path $TargetDir "prisma\dev.db") (Join-Path $preserveDir "prisma\dev.db") -Force
        }

        if (Test-Path $TargetDir) {
            Get-ChildItem -LiteralPath $TargetDir -Force -ErrorAction SilentlyContinue | ForEach-Object {
                Remove-Item -LiteralPath $_.FullName -Recurse -Force
            }
        } else {
            New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
        }

        Get-ChildItem -LiteralPath $SourceDir -Force | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination $TargetDir -Recurse -Force
        }

        if (Test-Path (Join-Path $preserveDir ".env.local")) {
            Copy-Item (Join-Path $preserveDir ".env.local") (Join-Path $TargetDir ".env.local") -Force
        }
        if (Test-Path (Join-Path $preserveDir "version.txt")) {
            Copy-Item (Join-Path $preserveDir "version.txt") (Join-Path $TargetDir "version.txt") -Force
        }
        if (Test-Path (Join-Path $preserveDir "prisma\prod.db")) {
            New-Item -ItemType Directory -Path (Join-Path $TargetDir "prisma") -Force | Out-Null
            Copy-Item (Join-Path $preserveDir "prisma\prod.db") (Join-Path $TargetDir "prisma\prod.db") -Force
        }
        if (Test-Path (Join-Path $preserveDir "prisma\dev.db")) {
            New-Item -ItemType Directory -Path (Join-Path $TargetDir "prisma") -Force | Out-Null
            Copy-Item (Join-Path $preserveDir "prisma\dev.db") (Join-Path $TargetDir "prisma\dev.db") -Force
        }
    } finally {
        if (Test-Path $preserveDir) {
            Remove-Item -Recurse -Force $preserveDir
        }
    }
}

function Install-RuntimeDependencies($ProjectDir) {
    Push-Location $ProjectDir
    try {
        npm install --omit=dev
        if ($LASTEXITCODE -ne 0) { throw "npm install --omit=dev 失败" }
    } finally {
        Pop-Location
    }
}

function Initialize-Database($ProjectDir) {
    $previousDatabaseUrl = $env:DATABASE_URL
    $env:DATABASE_URL = "file:$($ProjectDir -replace '\\', '/')/prisma/prod.db"
    try {
        Push-Location $ProjectDir
        npx prisma generate
        if ($LASTEXITCODE -ne 0) { throw "prisma generate 失败" }
        npx prisma db push --accept-data-loss
        if ($LASTEXITCODE -ne 0) { throw "prisma db push 失败" }
    } finally {
        Pop-Location
        $env:DATABASE_URL = $previousDatabaseUrl
    }
}

function Write-EnvFile($ProjectDir, $Port) {
    $localIP = Get-LocalIP
    $nextauthSecret = New-Secret
    @"
DATABASE_URL=`"file:$($ProjectDir -replace '\\', '/')/prisma/prod.db`"
NEXTAUTH_SECRET=`"$nextauthSecret`"
NEXTAUTH_URL=`"http://$localIP`:$Port`"
NEXT_PUBLIC_LLM_PROVIDER=ollama
NEXT_PUBLIC_OLLAMA_MODEL=qwen3:4b
"@ | Set-Content -Path (Join-Path $ProjectDir ".env.local") -Encoding UTF8
    Write-Host ".env.local 文件已创建"
}

function Prepare-ReleasePayload($TempRoot, $ExtractDir) {
    if (Test-Path $TempRoot) { Remove-Item -Recurse -Force $TempRoot }
    New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
    $archive = Join-Path $TempRoot "release.zip"
    Download-ReleaseArchive $script:RELEASE_URL $archive
    Expand-ReleaseArchive $archive $ExtractDir
}

function Detect-Deployment {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host " 检测现有部署"
    Write-Host "=========================================="
    Write-Host ""

    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $PSCommandPath }
    $sourceRoot = Split-Path -Parent $scriptDir

    if (Test-SourceRepo $sourceRoot) {
        Write-Warn "检测到当前目录是源码仓库，仅作为脚本来源，不作为部署目录"
    }

    if (Test-DeploymentInstance $script:DEFAULT_DIR) {
        $script:DEPLOY_MODE = "update"
        $script:DEPLOY_DIR = $script:DEFAULT_DIR
        Write-Host "检测到已有部署: $($script:DEPLOY_DIR)"
    } else {
        Write-Host "默认路径 ($($script:DEFAULT_DIR)) 未检测到现有部署"
        Write-Host ""
        $choice = Invoke-InteractiveSelect -Message "请选择部署模式：" -DefaultValue "1" -AllowCancel $true -Choices @(
            "1|全新部署",
            "2|指定已部署路径"
        )
        if ($script:LAST_INTERACTIVE_STATUS -eq 130) {
            Write-Host "已取消部署"
            exit 0
        }
        if ($script:LAST_INTERACTIVE_STATUS -ne 0) {
            Write-Fail "部署模式选择失败"
            exit 1
        }

        if ($choice -eq "1") {
            $script:DEPLOY_MODE = "new"
            Write-Host -NoNewline "请输入部署目录路径（直接回车使用 $($script:DEFAULT_DIR)，输入 q 退出）: "
            $customPath = Read-Host
            if ($customPath -eq "q" -or $customPath -eq "Q") {
                Write-Host "已取消部署"
                exit 0
            }
            if ([string]::IsNullOrWhiteSpace($customPath)) { $customPath = $script:DEFAULT_DIR }
            if (-not $customPath.EndsWith("u-plus-lite")) {
                $customPath = Join-Path $customPath "u-plus-lite"
            }
            $script:DEPLOY_DIR = $customPath
        } else {
            while ($true) {
                Write-Host -NoNewline "请输入已有部署路径（输入 q 退出）: "
                $customPath = Read-Host
                if ($customPath -eq "q" -or $customPath -eq "Q") {
                    Write-Host "已取消部署"
                    exit 0
                }
                if (Test-DeploymentInstance $customPath) {
                    $script:DEPLOY_MODE = "update"
                    $script:DEPLOY_DIR = $customPath
                    break
                }
                Write-Fail "$customPath 不是有效的部署目录"
            }
        }
    }

    $script:PROJECT_ROOT = $script:DEPLOY_DIR
    Write-Host "部署目录: $($script:DEPLOY_DIR)"
    Write-Host "部署模式: $($script:DEPLOY_MODE)"
}

function Read-MultilineInput($Prompt) {
    Write-Host $Prompt
    Write-Host "输入完成后单独输入 EOF 并回车。"
    $lines = New-Object System.Collections.Generic.List[string]
    while ($true) {
        $line = Read-Host
        if ($line -eq "EOF") { break }
        $lines.Add($line)
    }
    return ($lines -join [Environment]::NewLine)
}

function Import-CsvData {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host " CSV 数据导入"
    Write-Host "=========================================="
    Write-Host ""

    $choice = Invoke-InteractiveSelect -Message "请选择导入方式：" -DefaultValue "3" -AllowCancel $true -Choices @(
        "1|指定 CSV 文件路径",
        "2|直接粘贴 CSV 内容",
        "3|跳过（稍后通过 Web 端手动添加）"
    )

    if ($script:LAST_INTERACTIVE_STATUS -eq 130) {
        Write-Host "已取消部署"
        exit 0
    }
    if ($script:LAST_INTERACTIVE_STATUS -ne 0) {
        Write-Fail "CSV 导入方式选择失败"
        exit 1
    }

    if ($choice -eq "3") {
        Write-Host "跳过导入，管理员可在 Web 端手动添加管线/预算项"
        return
    }

    $previousDatabaseUrl = $env:DATABASE_URL
    $env:DATABASE_URL = "file:$($script:PROJECT_ROOT -replace '\\', '/')/prisma/prod.db"
    $tempFiles = New-Object System.Collections.Generic.List[string]
    try {
        $args = New-Object System.Collections.Generic.List[string]
        if ($choice -eq "1") {
            Write-Host -NoNewline "管线 CSV 文件路径（直接回车跳过，输入 q 退出）: "
            $pipelinesPath = Read-Host
            if ($pipelinesPath -eq "q" -or $pipelinesPath -eq "Q") { exit 0 }

            Write-Host -NoNewline "预算项 CSV 文件路径（直接回车跳过，输入 q 退出）: "
            $budgetPath = Read-Host
            if ($budgetPath -eq "q" -or $budgetPath -eq "Q") { exit 0 }

            if (-not [string]::IsNullOrWhiteSpace($pipelinesPath)) {
                $args.Add("--pipelines=$pipelinesPath")
            }
            if (-not [string]::IsNullOrWhiteSpace($budgetPath)) {
                $args.Add("--budget-items=$budgetPath")
            }
        } else {
            $pipelinesContent = Read-MultilineInput "请粘贴管线名称（每行一个）："
            $budgetContent = Read-MultilineInput "请粘贴预算项内容（格式：管线名称,预算项名称）："

            if (-not [string]::IsNullOrWhiteSpace($pipelinesContent)) {
                $pipelinesTmp = Join-Path ([System.IO.Path]::GetTempPath()) ("u-plus-lite-pipelines-" + [guid]::NewGuid().ToString("N") + ".csv")
                "name`n$pipelinesContent" | Set-Content -Path $pipelinesTmp -Encoding UTF8
                $tempFiles.Add($pipelinesTmp)
                $args.Add("--pipelines=$pipelinesTmp")
            }
            if (-not [string]::IsNullOrWhiteSpace($budgetContent)) {
                $budgetTmp = Join-Path ([System.IO.Path]::GetTempPath()) ("u-plus-lite-budget-" + [guid]::NewGuid().ToString("N") + ".csv")
                "pipeline,name`n$budgetContent" | Set-Content -Path $budgetTmp -Encoding UTF8
                $tempFiles.Add($budgetTmp)
                $args.Add("--budget-items=$budgetTmp")
            }
        }

        if ($args.Count -gt 0) {
            Invoke-RuntimeImport -ProjectDir $script:PROJECT_ROOT -Arguments $args
        } else {
            Write-Host "未输入 CSV 内容，跳过导入"
        }
    } finally {
        foreach ($file in $tempFiles) {
            if (Test-Path $file) { Remove-Item -Force $file }
        }
        $env:DATABASE_URL = $previousDatabaseUrl
    }
}

function Configure-Port {
    if (Test-PortUsed 3000) {
        $choice = Invoke-InteractiveSelect -Message "端口 3000 已被占用，如何处理？" -DefaultValue "1" -AllowCancel $true -Choices @(
            "1|帮我释放 3000 端口",
            "2|查找下一个可用端口（注意：可能影响正在使用的用户）"
        )
        if ($script:LAST_INTERACTIVE_STATUS -eq 130) { exit 0 }
        if ($script:LAST_INTERACTIVE_STATUS -ne 0) {
            Write-Fail "端口处理方式选择失败"
            exit 1
        }

        if ($choice -eq "1") {
            Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
                Select-Object -ExpandProperty OwningProcess -Unique |
                ForEach-Object {
                    try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
                }
            $script:PORT = 3000
        } else {
            $script:PORT = Find-AvailablePort
        }
    } else {
        $script:PORT = 3000
    }
}

function Deploy-New {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host " 开始全新部署"
    Write-Host "=========================================="
    Write-Host ""

    Get-LatestReleaseInfo
    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("u-plus-lite-release-" + [guid]::NewGuid().ToString("N"))
    $extractDir = Join-Path $tempRoot "extracted"

    try {
        Prepare-ReleasePayload $tempRoot $extractDir

        if ((Test-Path $script:DEPLOY_DIR) -and (Get-ChildItem -LiteralPath $script:DEPLOY_DIR -Force -ErrorAction SilentlyContinue | Select-Object -First 1)) {
            Write-Warn "$($script:DEPLOY_DIR) 目录已存在"
            Write-Host -NoNewline "是否删除并重新安装？ [y/N]: "
            $confirm = Read-Host
            if (($confirm.ToLower()) -ne "y") {
                Write-Host "部署取消"
                exit 1
            }
            Remove-Item -Recurse -Force $script:DEPLOY_DIR
        }

        New-Item -ItemType Directory -Path $script:DEPLOY_DIR -Force | Out-Null
        Sync-ReleaseContents $extractDir $script:DEPLOY_DIR
        $script:PROJECT_ROOT = $script:DEPLOY_DIR

        Write-Host "[1/8] 已下载并解压 release 包"
        Write-Host "[2/8] 正在安装运行依赖..."
        Install-RuntimeDependencies $script:PROJECT_ROOT

        Write-Host "[3/8] 正在初始化数据库..."
        Initialize-Database $script:PROJECT_ROOT

        Write-Host "[4/8] 创建管理员账号"
        do {
            Write-Host -NoNewline "  管理员姓名（输入 q 退出）: "
            $adminName = Read-Host
            if ($adminName -eq "q" -or $adminName -eq "Q") { exit 0 }
        } while ([string]::IsNullOrWhiteSpace($adminName))

        do {
            $adminPass = Read-Secret "  密码（至少8位，输入 q 退出）: "
            if ($adminPass -eq "q" -or $adminPass -eq "Q") { exit 0 }
            if ($adminPass.Length -lt 8) {
                Write-Host "  错误：密码至少8位" -ForegroundColor Red
                $adminPass = ""
                continue
            }
            $adminPassConfirm = Read-Secret "  确认密码: "
            if ($adminPass -ne $adminPassConfirm) {
                Write-Host "  错误：两次输入的密码不一致" -ForegroundColor Red
                $adminPass = ""
            }
        } while ([string]::IsNullOrWhiteSpace($adminPass))

        $previousDatabaseUrl = $env:DATABASE_URL
        $env:DATABASE_URL = "file:$($script:PROJECT_ROOT -replace '\\', '/')/prisma/prod.db"
        try {
            Invoke-RuntimeSeed -ProjectDir $script:PROJECT_ROOT -Arguments @($adminName, $adminPass)
        } finally {
            $env:DATABASE_URL = $previousDatabaseUrl
        }

        Write-Host "[5/8] 配置环境变量..."
        Configure-Port
        Write-EnvFile $script:PROJECT_ROOT $script:PORT

        Write-Host "[6/8] 配置 PM2 服务..."
        $previousPort = $env:PORT
        try {
            pm2 delete u-plus-lite 2>$null | Out-Null
            Push-Location $script:PROJECT_ROOT
            $env:PORT = $script:PORT
            pm2 start npm --name u-plus-lite -- start -- -H 0.0.0.0
            if ($LASTEXITCODE -ne 0) { throw "PM2 启动失败" }
            pm2 save | Out-Null
        } finally {
            Pop-Location
            $env:PORT = $previousPort
        }

        Write-Host "[7/8] 保存版本信息..."
        "v$($script:LATEST_VERSION)" | Set-Content -Path (Join-Path $script:PROJECT_ROOT "version.txt") -Encoding UTF8

        Write-Host "[8/8] CSV 数据导入..."
        Import-CsvData

        $enableAutostart = Invoke-InteractiveConfirm -Message "是否配置开机自启？" -DefaultValue $true
        if ($script:LAST_INTERACTIVE_STATUS -eq 130) { exit 0 }
        if ($enableAutostart -eq "true") {
            pm2 startup 2>$null | Out-Null
        }

        Show-Complete $adminName
    } finally {
        if (Test-Path $tempRoot) { Remove-Item -Recurse -Force $tempRoot }
    }
}

function Invoke-UpdateAction {
    Write-Host ""
    Write-Host "正在更新..."

    if (Test-SourceRepo $script:PROJECT_ROOT) {
        Write-Fail "当前目录是源码仓库，不能作为部署目录更新"
        exit 1
    }

    Get-LatestReleaseInfo
    $currentVersion = Get-CurrentDeployedVersion $script:PROJECT_ROOT
    Write-Host "当前版本: $currentVersion"

    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("u-plus-lite-update-" + [guid]::NewGuid().ToString("N"))
    $extractDir = Join-Path $tempRoot "extracted"

    try {
        Prepare-ReleasePayload $tempRoot $extractDir
        Sync-ReleaseContents $extractDir $script:PROJECT_ROOT
        Install-RuntimeDependencies $script:PROJECT_ROOT
        Initialize-Database $script:PROJECT_ROOT

        $adminChoice = Invoke-InteractiveSelect -Message "是否修改管理员账号密码？" -DefaultValue "1" -AllowCancel $false -Choices @(
            "1|跳过（沿用现有账号）",
            "2|修改"
        )
        if ($script:LAST_INTERACTIVE_STATUS -ne 0) {
            Write-Fail "管理员密码操作选择失败"
            exit 1
        }

        if ($adminChoice -eq "2") {
            do {
                Write-Host -NoNewline "  管理员姓名: "
                $adminName = Read-Host
            } while ([string]::IsNullOrWhiteSpace($adminName))

            do {
                $adminPass = Read-Secret "  密码（至少8位）: "
                if ($adminPass.Length -lt 8) {
                    Write-Host "  错误：密码至少8位" -ForegroundColor Red
                    $adminPass = ""
                    continue
                }
                $adminPassConfirm = Read-Secret "  确认密码: "
                if ($adminPass -ne $adminPassConfirm) {
                    Write-Host "  错误：两次输入的密码不一致" -ForegroundColor Red
                    $adminPass = ""
                }
            } while ([string]::IsNullOrWhiteSpace($adminPass))

            $previousDatabaseUrl = $env:DATABASE_URL
            $env:DATABASE_URL = "file:$($script:PROJECT_ROOT -replace '\\', '/')/prisma/prod.db"
            try {
                Invoke-RuntimeSeed -ProjectDir $script:PROJECT_ROOT -Arguments @("--reset", $adminName, $adminPass)
            } finally {
                $env:DATABASE_URL = $previousDatabaseUrl
            }
            Write-Success "管理员账号已更新"
        }

        "v$($script:LATEST_VERSION)" | Set-Content -Path (Join-Path $script:PROJECT_ROOT "version.txt") -Encoding UTF8
        Push-Location $script:PROJECT_ROOT
        try {
            pm2 restart u-plus-lite | Out-Null
        } finally {
            Pop-Location
        }
        Write-Success "更新完成"
        Show-Complete ""
    } finally {
        if (Test-Path $tempRoot) { Remove-Item -Recurse -Force $tempRoot }
    }
}

function Invoke-Uninstall {
    Write-Host ""
    Write-Host "警告：即将卸载 U-Plus-Lite" -ForegroundColor Red
    Write-Host ""
    Write-Host "此操作将："
    Write-Host "  1. 删除 PM2 服务"
    Write-Host "  2. 删除部署目录: $($script:DEPLOY_DIR)"
    Write-Host ""
    Write-Host -NoNewline "确认卸载？（输入 YES 确认）: "
    $confirm = Read-Host

    if ($confirm.ToUpper() -ne "YES") {
        Write-Host "取消卸载操作"
        exit 0
    }

    pm2 stop u-plus-lite 2>$null | Out-Null
    pm2 delete u-plus-lite 2>$null | Out-Null
    Start-Sleep -Seconds 2
    if (Test-Path $script:DEPLOY_DIR) {
        Remove-Item -Recurse -Force $script:DEPLOY_DIR
    }
    Write-Success "卸载完成"
}

function Deploy-Update {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host " 更新部署"
    Write-Host "=========================================="
    Write-Host ""

    $choice = Invoke-InteractiveSelect -Message "请选择操作：" -DefaultValue "1" -AllowCancel $true -Choices @(
        "1|更新（推荐）",
        "2|卸载",
        "3|重新安装"
    )

    if ($script:LAST_INTERACTIVE_STATUS -eq 130) { exit 0 }
    if ($script:LAST_INTERACTIVE_STATUS -ne 0) { exit 1 }

    switch ($choice) {
        "1" { Invoke-UpdateAction }
        "2" { Invoke-Uninstall }
        "3" {
            $reinstallDir = $script:DEPLOY_DIR
            Invoke-Uninstall
            $script:DEPLOY_MODE = "new"
            $script:DEPLOY_DIR = $reinstallDir
            $script:PROJECT_ROOT = $script:DEPLOY_DIR
            Deploy-New
        }
        default {
            Write-Fail "无效选择"
            exit 1
        }
    }
}

function Show-Complete($AdminName) {
    $localIP = Get-LocalIP

    Write-Host ""
    Write-Host "=========================================="
    Write-Host " 部署完成！" -ForegroundColor Green
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "访问地址: http://$localIP`:$($script:PORT)"
    Write-Host ""
    if (-not [string]::IsNullOrWhiteSpace($AdminName)) {
        Write-Host "管理员账号: $AdminName"
        Write-Host "管理员密码: （使用刚刚设置的密码）"
    } else {
        Write-Host "管理员账号: （沿用之前设置）"
        Write-Host "管理员密码: （沿用之前设置）"
    }
    Write-Host ""
    Write-Host "常用命令："
    Write-Host "  pm2 status                查看状态"
    Write-Host "  pm2 logs u-plus-lite      查看日志"
    Write-Host "  pm2 restart u-plus-lite   重启服务"
    Write-Host "  pm2 monit                 实时监控"
    Write-Host "=========================================="
}

function Main {
    try {
        Test-Dependencies
        Detect-Deployment

        if ($script:DEPLOY_MODE -eq "new") {
            Deploy-New
        } else {
            Deploy-Update
        }
    } finally {
        Remove-RuntimeHelpers
    }
}

Main
