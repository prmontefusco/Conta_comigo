# Operação de produção

Este documento separa o que o repositório consegue validar sozinho do que
precisa ser ligado no console do Firebase ou Google Cloud antes de atender
famílias reais.

## O que o push NÃO leva junto

O backend do App Hosting está conectado ao repositório: **um push para `main`
dispara um rollout**. Isso vale para o código do Next.js e para nada mais.

**As Security Rules não sobem com o push.** `firestore.rules` é publicado por um
comando separado:

```bash
npx firebase deploy --only firestore:rules --project prod
```

Isso não é detalhe de configuração, é a ordem de uma implantação. Quando uma
versão do aplicativo passa a ler uma coleção nova, subir o código antes das
regras deixa a produção num estado pior que o anterior: a assinatura falha com
`permission-denied`, e o `FinanceProvider` mostra **"Você não tem acesso a estes
dados"** em cima de toda tela do aplicativo — não só na tela nova. Para um
público que já está ansioso com dinheiro, é a pior frase possível, e ela aparece
para quem não fez nada de errado.

A regra prática: **regras primeiro, código depois.** Uma regra publicada antes
do código que a usa não quebra nada — ela apenas permite algo que ninguém ainda
pede. O contrário quebra.

O mesmo vale para `firestore.indexes.json`.

## Estado dos itens de console — setembro de 2026

Conferido contra `apphosting.yaml` e `next.config.ts`. Nenhum destes é código:
todos dependem de alguém ligar algo num console.

| Item                              | Estado atual                                                   |
| --------------------------------- | -------------------------------------------------------------- |
| Backup do Firestore (PITR/export) | ✖ **inexistente** — o mais grave da lista                      |
| Revisão de segurança independente | ✖ pendente                                                     |
| App Check                         | ✖ `NEXT_PUBLIC_APPCHECK_SITE_KEY` ainda é `REPLACE_WITH_...`   |
| Assinatura paga                   | ✖ `ASAAS_API_KEY` e `PAYMENT_WEBHOOK_SECRET` comentados → 503  |
| Consultoria com IA                | ⚠ `GEMINI_API_KEY` comentada → cai no motor local, em silêncio |
| CSP                               | ⚠ `Report-Only`; só `frame-ancestors` é obrigatório            |
| Alerta de taxa de erro            | ✖ pendente — os logs já saem estruturados, falta a métrica     |
| Rate limiting na criação de conta | ✖ pendente — exige Cloud Functions                             |
| Indexação por buscadores          | ✔ desligada de propósito (`NEXT_PUBLIC_ALLOW_INDEXING=false`)  |
| Performance em aparelho real      | ✖ nunca medida — 417 kB de First Load JS na área autenticada   |

**Backup é o único que eu trataria como impeditivo antes de qualquer família
real cadastrar dados.** Todo o resto degrada de forma recuperável; perda de
dados digitados à mão ao longo de meses, não. Enquanto o ambiente servir apenas
para validação com os usuários de seed, o risco é outro — e é por isso que a
distinção entre "no ar para testar" e "no ar para atender" precisa ficar escrita.

## Antes do primeiro deploy

1. Rodar a verificação local:

   ```bash
   npm run format:check
   npm run typecheck
   npm run lint
   npm run test
   npm run test:rules
   npm run test:e2e
   npm run build
   npm run audit:prod
   ```

2. Pedir revisão de segurança independente das Security Rules e das rotas em
   `src/app/api/**`.

3. Habilitar o provedor Google no Firebase Auth e cadastrar o domínio final em
   **Authorized domains**.

4. Configurar App Check:

   - criar a chave reCAPTCHA;
   - definir `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`;
   - exigir App Check para Firestore no console.

5. Configurar backup do Firestore:

   - habilitar Point-in-time recovery;
   - criar exportação agendada para Cloud Storage;
   - testar restauração em um projeto separado.

6. Configurar limpeza de rate limits:

   - criar política de TTL para a coleção `rateLimits`;
   - campo TTL: `expiresAt`.

7. Configurar observabilidade:

   - confirmar que logs de produção chegam estruturados ao Cloud Logging;
   - criar métrica baseada em log para `severity >= ERROR`;
   - criar alerta de taxa de erro.

8. Configurar limites de custo:

   - alerta de orçamento no projeto Google Cloud;
   - alerta de orçamento na chave/provedor do modelo de IA.

9. Medir performance em ambiente real:

   - Lighthouse em mobile;
   - Core Web Vitals depois de tráfego inicial;
   - revisar o First Load JS da área autenticada se usuários reais estiverem
     em dispositivos modestos ou conexão limitada.

10. Tornar a CSP obrigatória somente depois de observar a política em produção
    sem violações relevantes.

## Dependências

`npm run audit:prod` precisa retornar zero vulnerabilidades. A auditoria sem
`--omit=dev` pode apontar vulnerabilidades em ferramentas de desenvolvimento,
principalmente `firebase-tools`, que não entra no bundle de produção.

Não use `npm audit fix --force` sem revisar o plano de mudança: ele pode
trocar o Firebase CLI por uma versão antiga e quebrar emuladores ou deploy.

## Regra de deploy

Nenhum deploy deve acontecer sem autorização explícita e sem a verificação local
completa. Dados financeiros de famílias reais tornam backup, alertas e revisão
de segurança parte do produto, não uma etapa administrativa opcional.
