# ADR 0002 — Acesso a dados pelo cliente, com Security Rules como autorização

**Data:** 2026-08-28
**Estado:** aceito

## Contexto

Havia duas formas de acessar o Firestore: pelo cliente, com Security Rules
decidindo o acesso, ou por uma camada de servidor usando o Admin SDK, que
ignora as regras.

O produto exige que nenhum service account esteja no repositório e que o
desenvolvimento não toque em recursos reais.

## Decisão

Todo acesso a dados acontece no cliente. As Firestore Security Rules **são** a
camada de autorização.

Nenhum Admin SDK em runtime. A única exceção é `scripts/seed.ts`, que roda
contra emuladores e recusa executar se o projeto não começar com `demo-`.

## Consequências

**Boas.** Um único lugar decide quem acessa o quê, e esse lugar tem 45 testes
automatizados. Não existe caminho privilegiado que possa contornar as regras
por engano. Nenhuma credencial de produção precisa existir no repositório ou na
máquina de quem desenvolve. Atualizações em tempo real vêm de graça, via
`onSnapshot`.

E, principalmente: as regras deixam de ser uma segunda linha de defesa
opcional. Se estiverem erradas, o produto está errado — o que garante que sejam
tratadas com a seriedade devida.

**Ruins.** Toda leitura precisa ser expressável como uma query que as regras
aceitem, e isso restringe o modelo de dados. Agregações do lado do servidor não
são possíveis; o cliente carrega os documentos e deriva (ver
[`ADR 0004`](0004-forecast-engine-is-pure.md) e a seção "Carregamento e
derivação" de `ARCHITECTURE.md`).

Operações que exigirem privilégio — cobrança, exclusão em massa — precisarão de
Cloud Functions. Nenhuma é necessária hoje, e nenhuma será adicionada por
conveniência.
