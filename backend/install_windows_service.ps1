# ==============================================================================
# TheSSBuddy Enterprise WMS — 1-Click Windows Service & LAN Deployment Script
# ==============================================================================

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " 🚀 INSTALLING THESSBUDDY ENTERPRISE WMS AS AUTOMATIC WINDOWS SERVICE " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$serviceName = "TheSSBuddyWMS"
$serviceDisplayName = "TheSSBuddy Enterprise WMS Server"
$serviceDesc = "Runs TheSSBuddy WMS Node.js Backend & Database Auto-Sync Engine on LAN"
$scriptPath = Join-Path $PSScriptRoot "src\server.js"
$nodePath = (Get-Command node).Source

if (-not $nodePath) {
    Write-Host "❌ Error: Node.js is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

Write-Host "Checking if Windows Service '$serviceName' already exists..." -ForegroundColor Yellow
$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($existing) {
    Write-Host "Stopping existing service '$serviceName'..." -ForegroundColor Yellow
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 2
}

# Create Windows Service using sc.exe or PowerShell
$binPath = "`"$nodePath`" `"$scriptPath`""

Write-Host "Registering Windows Service: $serviceDisplayName..." -ForegroundColor Green
sc.exe create $serviceName binPath= $binPath start= auto DisplayName= "$serviceDisplayName" | Out-Null
sc.exe description $serviceName "$serviceDesc" | Out-Null

Write-Host "Starting Windows Service: $serviceName..." -ForegroundColor Green
Start-Service -Name $serviceName -ErrorAction SilentlyContinue

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -Type Unicast | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }).IPAddress | Select-Object -First 1

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host " ✅ THESSBUDDY WMS IS NOW INSTALLED AS AN AUTOMATIC WINDOWS SERVICE! " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host " 🌐 Localhost Access: http://localhost:5173" -ForegroundColor White
Write-Host " 📡 LAN Network Access: http://${lanIp}:5173" -ForegroundColor Yellow
Write-Host " 🔌 Backend API Server: http://${lanIp}:5000" -ForegroundColor Yellow
Write-Host " 🔄 Auto-Start Mode: Automatic on Windows Boot" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Green
