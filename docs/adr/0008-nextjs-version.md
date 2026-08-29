# ADR 0008 — Next.js 15.5, e não a versão mais recente

**Data:** 2026-08-28
**Estado:** aceito

## Contexto

No momento da implementação, a `latest` do Next.js no npm era **16.3.3**.

O requisito do projeto é usar uma versão que esteja **oficialmente na faixa
suportada pelo Firebase App Hosting**, e não simplesmente a mais nova.

Três fontes foram consultadas:

1. A tabela de versões suportadas em
   `firebase.google.com/docs/app-hosting/frameworks-tooling` lista a linha
   **15.x como `active`**. A 16.x não consta.
2. O adaptador `@apphosting/adapter-nextjs@14.0.21` bloqueia deploys de versões
   vulneráveis ao CVE-2025-55182. A faixa segura é
   `>=16.1.0 || ~16.0.7 || ~15.5.7 || ~15.4.8 || ~15.3.6 || ~15.2.6 || ~15.1.9 || ~15.0.5 || <14.3.0-canary.77`.
3. A dist-tag `backport` do Next.js aponta para `15.5.24`, indicando que a
   linha 15.5 continua recebendo correções.

## Decisão

**Next.js 15.5.24**, com React 19.1.0 e Node 22+.

Satisfaz as três fontes: está na linha documentada como suportada, satisfaz
`~15.5.7` da faixa segura do adaptador, e é a mais recente da sua linha.

Adicionalmente, um `override` de npm força `postcss@^8.5.26` — o postcss que o
Next 15.5 traz tem vulnerabilidades conhecidas, e `npm audit fix --force`
"resolveria" o problema subindo para o Next 16, que é justamente o que esta
decisão evita. O override resolve sem sair da faixa suportada.

Resultado: `npm audit` reporta zero vulnerabilidades.

## Consequências

**Boas.** O deploy no App Hosting não será bloqueado por versão não suportada
nem pelo CVE. Nenhuma vulnerabilidade conhecida nas dependências.

**Ruins.** Recursos exclusivos do Next 16 não estão disponíveis. Nenhum era
necessário: App Router, Turbopack, Server Components e a API de metadata já
existem na 15.5.

## Quando revisitar

Quando a tabela oficial do App Hosting listar a 16.x como suportada. A
migração deve ser feita como uma mudança isolada, com `npm run verify` e um
teste de build antes e depois.
