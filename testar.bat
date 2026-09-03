@echo off
chcp 65001 >nul
title Conta comigo - Ambiente de Testes
cls
echo =================================================================
echo   CONTA COMIGO - AMBIENTE COMPLETO DE DESENVOLVIMENTO E TESTE
echo =================================================================
echo.
echo [1/3] Iniciando Firebase Emulators (Auth :9099 / Firestore :8080)...
echo [2/3] Aguardando portas e gerando dados de teste (Seed)...
echo [3/3] Iniciando Servidor Next.js (http://localhost:3000)...
echo.
echo -> Aplicativo:   http://localhost:3000
echo -> Emuladores:   http://127.0.0.1:4000
echo.
echo Pressione Ctrl+C para encerrar todos os servicos juntos.
echo =================================================================
echo.

npm run dev:all
