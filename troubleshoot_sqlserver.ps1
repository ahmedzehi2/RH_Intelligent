#!/usr/bin/env powershell
# SQL Server Status and Network Troubleshooting

Write-Host "`n$('='*70)" -ForegroundColor Cyan
Write-Host "SQL SERVER TROUBLESHOOTING GUIDE" -ForegroundColor Cyan
Write-Host "$('='*70)`n" -ForegroundColor Cyan

# 1. Check if SQL Server service is running
Write-Host "[1] Checking SQL Server Services..." -ForegroundColor Yellow
$services = Get-Service | Where-Object {$_.Name -like "*SQL*"} | Select-Object Name, Status, DisplayName
if ($services) {
    $services | Format-Table -AutoSize
} else {
    Write-Host "  ⚠️  No SQL Server services found!" -ForegroundColor Red
}

# 2. Check specific SQLEXPRESS service
Write-Host "`n[2] Checking MSSQL`$SQLEXPRESS service..." -ForegroundColor Yellow
$sqlService = Get-Service | Where-Object {$_.Name -eq "MSSQL`$SQLEXPRESS"}
if ($sqlService) {
    Write-Host "  Service Name: $($sqlService.Name)" -ForegroundColor Green
    Write-Host "  Display Name: $($sqlService.DisplayName)" -ForegroundColor Green
    Write-Host "  Status: $($sqlService.Status)" -ForegroundColor $(if($sqlService.Status -eq 'Running') {'Green'} else {'Red'})
    
    if ($sqlService.Status -ne 'Running') {
        Write-Host "`n  💡 To start the service, run:" -ForegroundColor Yellow
        Write-Host "     Start-Service -Name 'MSSQL`$SQLEXPRESS'" -ForegroundColor Cyan
    }
} else {
    Write-Host "  ❌ MSSQL`$SQLEXPRESS service not found!" -ForegroundColor Red
}

# 3. Test TCP connection to localhost
Write-Host "`n[3] Testing TCP connection to localhost:1433..." -ForegroundColor Yellow
$host_ip = "127.0.0.1"
$port = 1433

try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect($host_ip, $port)
    Write-Host "  ✓ TCP connection successful on port 1433" -ForegroundColor Green
    $tcpClient.Close()
} catch {
    Write-Host "  ⚠️  Cannot connect to port 1433: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n$('='*70)`n" -ForegroundColor Cyan
Write-Host "QUICK FIX CHECKLIST:" -ForegroundColor Cyan
Write-Host "  1. Start SQL Server service (if stopped)"
Write-Host "  2. Verify instance name is correct: DESKTOP-MVNE0M6\SQLEXPRESS"
Write-Host "  3. Check SQL Server Configuration Manager > TCP/IP is enabled"
Write-Host "  4. Restart SQL Server Browser service"
Write-Host "  5. Check Windows Firewall allows SQL Server (port 1433)"
Write-Host "`n"
