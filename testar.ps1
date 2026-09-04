# Conta comigo - Inicializador de Testes Local (PowerShell)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "   CONTA COMIGO - AMBIENTE COMPLETO DE TESTES E DESENVOLVIMENTO   " -ForegroundColor Green
Write-Host "=================================================================`n" -ForegroundColor Cyan

Write-Host "[1/3] Iniciando Firebase Emulators (Auth: 9099, Firestore: 8080)" -ForegroundColor Yellow
Write-Host "[2/3] Aguardando prontidão e executando Seed automático" -ForegroundColor Yellow
Write-Host "[3/3] Iniciando Servidor Next.js (http://localhost:3000)`n" -ForegroundColor Yellow

Write-Host "-> Aplicativo:    http://localhost:3000" -ForegroundColor White
Write-Host "-> Painel Emula:  http://127.0.0.1:4000`n" -ForegroundColor DarkGray
Write-Host "Dica: Para encerrar tudo de uma vez, pressione Ctrl+C`n" -ForegroundColor Gray

Write-Host "[0/3] Liberando portas ocupadas (3000, 8080, 9099)..." -ForegroundColor DarkYellow
node scripts/kill-emulators.mjs 2>$null

npm run dev:all
