# One-time per-PC setup for Claude Code + this project.
# Run:  powershell -ExecutionPolicy Bypass -File setup-pc.ps1
# Idempotent — safe to re-run after updates to .claude\setup\global-CLAUDE.md.

$ErrorActionPreference = "Stop"
$projectDir = $PSScriptRoot

# 1. Global CLAUDE.md lives per-user and does not sync between PCs — this script is how it travels.
$claudeDir = Join-Path $HOME ".claude"
if (-not (Test-Path $claudeDir)) { New-Item -ItemType Directory -Path $claudeDir | Out-Null }
Copy-Item (Join-Path $projectDir ".claude\setup\global-CLAUDE.md") (Join-Path $claudeDir "CLAUDE.md") -Force
Write-Host "Installed global CLAUDE.md -> $(Join-Path $claudeDir 'CLAUDE.md')"

# 2. 'crm' launcher: opens Claude Code in this project so its CLAUDE.md, skills and permissions load.
if (-not (Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force | Out-Null }
$marker = "# crm-launcher (added by setup-pc.ps1)"
$profileText = Get-Content $PROFILE -Raw
if ($null -eq $profileText) { $profileText = "" }
if ($profileText.IndexOf($marker) -lt 0) {
    $fn = @"

$marker
function crm {
    Set-Location "$projectDir"
    claude @args
}
"@
    Add-Content -Path $PROFILE -Value $fn
    Write-Host "Added 'crm' command to PowerShell profile ($PROFILE)"
} else {
    Write-Host "'crm' command already in profile - skipped"
}

Write-Host ""
Write-Host "Done. Open a NEW PowerShell window and type: crm"
