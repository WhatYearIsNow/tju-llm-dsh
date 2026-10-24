<#
.SYNOPSIS
    Verify Tianjin University LLM (tju-llm) connectivity
.DESCRIPTION
    Reads API Key from credential file and sends a test request to the TJU LLM API.
.EXAMPLE
    .\verify.ps1
#>

[CmdletBinding()]
param()

# --- Enable modern TLS ---
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

# --- Color output helpers ---
function Write-Status { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warning-Custom { param($msg) Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Error-Custom { param($msg) Write-Host "[X] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "  -> $msg" -ForegroundColor Cyan }

# --- Path definitions ---
$homeDir = $env:USERPROFILE
$dshHome = Join-Path $homeDir ".dsh"
$credsFile = Join-Path $dshHome ".credentials.yaml"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TJU LLM Connectivity Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Check credential file ---
if (-not (Test-Path $credsFile)) {
    Write-Error-Custom "Credential file not found: $credsFile"
    Write-Info "Please run .\setup.ps1 first."
    exit 1
}
Write-Status "Credential file found"

# --- 2. Read API Key ---
$credsContent = Get-Content $credsFile -Raw
$tjuKeyMatch = $credsContent | Select-String -Pattern '(?m)^\s*TJU_LLM_API_KEY\s*:\s*(.+)$'
if (-not $tjuKeyMatch) {
    Write-Error-Custom "TJU_LLM_API_KEY not found in credential file"
    Write-Info "Please run .\setup.ps1 to reconfigure."
    exit 1
}

# Extract key value (not displayed)
$apiKey = $tjuKeyMatch.Matches[0].Groups[1].Value.Trim()
Write-Info "API Key loaded (length: $($apiKey.Length) chars)"

# --- 3. Send test request ---
Write-Info "Connecting to TJU LLM API..."

$body = @{
    model = "tju-llm"
    messages = @(
        @{
            role = "user"
            content = "Please reply with exactly two Chinese characters: liantong"
        }
    )
}

$bodyJson = $body | ConvertTo-Json -Depth 5
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)

try {
    $response = Invoke-RestMethod `
        -Uri "https://ai.tju.edu.cn/api/v3/chat/completions" `
        -Method Post `
        -Headers @{
            "Content-Type" = "application/json; charset=utf-8"
            "Authorization" = "Bearer $apiKey"
        } `
        -Body $bodyBytes `
        -TimeoutSec 30

    $model = $response.model
    $content = $response.choices[0].message.content

    Write-Status "Connectivity test PASSED!"
    Write-Host ""
    Write-Host "  Model: $model" -ForegroundColor Green
    Write-Host "  Reply: $content" -ForegroundColor Green
    Write-Host ""
    Write-Host "TJU LLM is ready to use!" -ForegroundColor Green
    exit 0
}
catch [System.Exception] {
    Write-Error-Custom "Connectivity test FAILED!"
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red

    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Host "Details: $errorBody" -ForegroundColor Red
        }
        catch {
            Write-Host "Could not read error response body" -ForegroundColor Red
        }
    }

    Write-Host ""
    Write-Host "Possible causes:" -ForegroundColor Yellow
    Write-Host "  1. API Key is incorrect or expired" -ForegroundColor Yellow
    Write-Host "  2. Network issue (verify you can reach ai.tju.edu.cn)" -ForegroundColor Yellow
    Write-Host "  3. TJU LLM platform is under maintenance" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Solutions:" -ForegroundColor Yellow
    Write-Host "  - Check API Key: https://ai.tju.edu.cn" -ForegroundColor Yellow
    Write-Host "  - Check network: open https://ai.tju.edu.cn in browser" -ForegroundColor Yellow
    Write-Host "  - See FAQ.md for more help" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
