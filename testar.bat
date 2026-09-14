@echo off
chcp 65001 >nul
title Conta comigo - Ambiente de Testes
cls
echo =================================================================
echo   CONTA COMIGO - AMBIENTE COMPLETO DE DESENVOLVIMENTO E TESTE
echo =================================================================
echo.
echo [1/4] Liberando portas antigas...
echo [2/4] Iniciando Firebase Emulators (Auth :9099 / Firestore :8080)...
echo [3/4] Gerando dados e usuario de teste...
echo [4/4] Iniciando Servidor Next.js (http://localhost:3000)...
echo.
echo -^> Aplicativo:   http://localhost:3000
echo -^> Emuladores:   http://127.0.0.1:4000
echo -^> Login teste:  teste@contacomigo.local / Teste1234!
echo.
echo Pressione Ctrl+C para encerrar todos os servicos juntos.
echo =================================================================
echo.

npm run app
