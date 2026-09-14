# Conta comigo - Inicializador de Testes Local (PowerShell)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "   CONTA COMIGO - AMBIENTE COMPLETO DE TESTES E DESENVOLVIMENTO   " -ForegroundColor Green
Write-Host "=================================================================`n" -ForegroundColor Cyan

Write-Host "[1/4] Liberando portas antigas" -ForegroundColor Yellow
Write-Host "[2/4] Iniciando Firebase Emulators (Auth: 9099, Firestore: 8080)" -ForegroundColor Yellow
Write-Host "[3/4] Gerando dados e usuário de teste" -ForegroundColor Yellow
Write-Host "[4/4] Iniciando Servidor Next.js (http://localhost:3000)`n" -ForegroundColor Yellow

Write-Host "-> Aplicativo:    http://localhost:3000" -ForegroundColor White
Write-Host "-> Painel Emula:  http://127.0.0.1:4000`n" -ForegroundColor DarkGray
Write-Host "-> Login teste:   teste@contacomigo.local / Teste1234!`n" -ForegroundColor White
Write-Host "Dica: Para encerrar tudo de uma vez, pressione Ctrl+C`n" -ForegroundColor Gray

npm run app
