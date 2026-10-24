<#
.SYNOPSIS
    一键配置天大智算（tju-llm）接入 DeepSeek Harness
.DESCRIPTION
    自动创建/更新 DSH 配置文件，添加天大智算 provider 路由。
    需要用户输入 API Key 后写入凭据文件。
.EXAMPLE
    .\setup.ps1
#>

[CmdletBinding()]
param()

# --- 颜色输出 ---
function Write-Status { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warning-Custom { param($msg) Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Error-Custom { param($msg) Write-Host "[X] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "  -> $msg" -ForegroundColor Cyan }

# --- 路径定义 ---
$home = $env:USERPROFILE
$dshHome = Join-Path $home ".dsh"
$settingsFile = Join-Path $dshHome "settings.yaml"
$credsFile = Join-Path $dshHome ".credentials.yaml"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  天大智算接入 DeepSeek Harness 配置工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. 检测 DSH 是否安装 ---
Write-Info "检测 DSH 是否安装..."
$dshPath = Get-Command dsh -ErrorAction SilentlyContinue
if (-not $dshPath) {
    Write-Error-Custom "未检测到 DSH！请先安装 DeepSeek Harness。"
    Write-Info "安装命令：npm install -g @deepseek-ai/dsh"
    exit 1
}
Write-Status "DSH 已安装：$($dshPath.Source)"

# --- 2. 检测 DSH 主目录 ---
Write-Info "DSH 主目录：$dshHome"
if (-not (Test-Path $dshHome)) {
    Write-Warning-Custom "DSH 主目录不存在，正在创建..."
    New-Item -ItemType Directory -Path $dshHome -Force | Out-Null
    Write-Status "已创建 $dshHome"
}

# --- 3. 检查配置是否已存在 ---
$tjuAlreadyConfigured = $false
if (Test-Path $settingsFile) {
    $settingsContent = Get-Content $settingsFile -Raw
    if ($settingsContent -match 'tju-llm') {
        $tjuAlreadyConfigured = $true
        Write-Warning-Custom "settings.yaml 中已存在 tju-llm 配置，将跳过写入。"
    }
}

# --- 4. 写入 settings.yaml ---
if (-not $tjuAlreadyConfigured) {
    Write-Info "写入 settings.yaml..."
    
    $newConfig = @'
llm-pi-ai:
  providers:
    tju-llm:
      displayName: 天大智算
      apiKeyEnv: TJU_LLM_API_KEY
      api: openai-completions
      baseURL: https://ai.tju.edu.cn/api/v3
      models:
        - id: tju-llm
          name: 天大 tju-llm
          contextWindow: 131072
          maxTokens: 8192
'@

    if (Test-Path $settingsFile) {
        # 文件已存在，追加配置
        $existingContent = Get-Content $settingsFile -Raw
        
        # 检查是否已有 llm-pi-ai 段
        if ($existingContent -match 'llm-pi-ai:') {
            # 已有 llm-pi-ai 段，需要找到 providers 段并追加 tju-llm
            # 在 google: 或最后一个 provider 后面追加
            $tjuBlock = @"
    tju-llm:
      displayName: 天大智算
      apiKeyEnv: TJU_LLM_API_KEY
      api: openai-completions
      baseURL: https://ai.tju.edu.cn/api/v3
      models:
        - id: tju-llm
          name: 天大 tju-llm
          contextWindow: 131072
          maxTokens: 8192
"@
            # 在 llm-pi-ai.providers 的最后一个 provider 前插入
            # 找到 providers: 段，在它的子项中插入
            $lines = $existingContent -split "`n"
            $inserted = $false
            $newLines = @()
            $inProviders = $false
            $lastProviderIndent = 0
            
            for ($i = 0; $i -lt $lines.Count; $i++) {
                $line = $lines[$i]
                
                # 检测进入 llm-pi-ai.providers
                if ($line -match '^\s*llm-pi-ai:') {
                    $inProviders = $true
                    $newLines += $line
                    continue
                }
                
                if ($inProviders -and $line -match '^\s+providers:') {
                    $newLines += $line
                    continue
                }
                
                # 检测 provider 项（4空格缩进 + 名称 + 冒号）
                if ($inProviders -and $line -match '^    [a-zA-Z][a-zA-Z0-9_-]*:\s*$') {
                    # 这是最后一个 provider，在它后面插入
                    $newLines += $line
                    $newLines += $tjuBlock
                    $inserted = $true
                    $inProviders = $false
                    continue
                }
                
                # 检测退出 llm-pi-ai 段（缩进回到0或2空格）
                if ($inProviders -and $line -match '^[^ ]' -and $line -ne '') {
                    $inProviders = $false
                }
                
                $newLines += $line
            }
            
            if (-not $inserted) {
                # 没找到合适的插入位置，追加到末尾
                $newLines += ""
                $newLines += $tjuBlock
            }
            
            $newContent = $newLines -join "`n"
            Set-Content -Path $settingsFile -Value $newContent -Encoding UTF8
        }
        else {
            # 没有 llm-pi-ai 段，追加到文件末尾
            $existingContent += "`n$newConfig"
            Set-Content -Path $settingsFile -Value $existingContent -Encoding UTF8
        }
    }
    else {
        # 文件不存在，创建新文件
        Set-Content -Path $settingsFile -Value $newConfig -Encoding UTF8
    }
    
    Write-Status "settings.yaml 已更新"
}
else {
    Write-Status "settings.yaml 已有 tju-llm 配置，跳过。"
}

# --- 5. 提示用户输入 API Key ---
Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "  请输入天大智算 API Key" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host ""

# 检查凭据是否已有
$tjuKeyInCreds = $false
if (Test-Path $credsFile) {
    $credsContent = Get-Content $credsFile -Raw
    if ($credsContent -match '(?m)^\s*TJU_LLM_API_KEY\s*:\s*\S') {
        $tjuKeyInCreds = $true
        Write-Warning-Custom "凭据文件中已存在 TJU_LLM_API_KEY。"
    }
}

if (-not $tjuKeyInCreds) {
    # 读取 API Key（不显示输入）
    $secureKey = Read-Host "请输入 API Key（输入时不显示）"
    
    if ($secureKey.Length -eq 0) {
        Write-Error-Custom "API Key 不能为空！"
        exit 1
    }
    
    # 写入凭据文件
    Write-Info "写入凭据文件..."
    
    if (Test-Path $credsFile) {
        $credsContent = Get-Content $credsFile -Raw
        # 追加新 key
        $newCredsLine = "TJU_LLM_API_KEY: $secureKey"
        $credsContent += "`n$newCredsLine"
        Set-Content -Path $credsFile -Value $credsContent -Encoding UTF8
    }
    else {
        # 创建新凭据文件
        $newCredsContent = "TJU_LLM_API_KEY: $secureKey"
        Set-Content -Path $credsFile -Value $newCredsContent -Encoding UTF8
    }
    
    Write-Status "API Key 已保存到凭据文件"
}
else {
    Write-Status "凭据文件中已有 API Key，跳过。"
}

# --- 6. 完成 ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  配置完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "下一步：" -ForegroundColor Cyan
Write-Host "  1. 运行 .\verify.ps1 验证连通性"
Write-Host "  2. 刷新 DSH Web GUI（http://127.0.0.1:3080）"
Write-Host "  3. 在模型选择器中选中「天大智算」"
Write-Host ""
