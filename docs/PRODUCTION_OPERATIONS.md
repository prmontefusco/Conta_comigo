# Operação de produção

Este documento separa o que o repositório consegue validar sozinho do que
precisa ser ligado no console do Firebase ou Google Cloud antes de atender
famílias reais.

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
