# Segurança

Dados financeiros estão entre os mais sensíveis que um produto pode guardar. As
Security Rules são código de produção e têm testes como qualquer outro código
de produção.

**Nenhuma funcionalidade é considerada pronta se a regra correspondente não
tiver teste.** Hoje: 45 testes em `tests/rules/household-isolation.test.ts`,
executados por `npm run test:rules`.

## Modelo

Todo acesso a **dados financeiros** acontece no cliente. As Security Rules
**são** a camada de autorização, não uma segunda linha de defesa.

Existe **uma** exceção, e ela é deliberada e delimitada: a superfície de
pagamentos sob `src/app/api/` e `src/modules/billing/`, que usa o Admin SDK e
portanto ignora as regras. Ela existe porque uma chave de pagamento não pode
estar no navegador e porque quem paga não pode declarar que pagou. Nenhum dado
financeiro do household passa por ali.

Continua não havendo arquivo de service account no repositório: no App Hosting
o backend recebe identidade em runtime, e localmente o Admin SDK fala com os
emuladores.

Ver [`adr/0002-client-side-data-access.md`](adr/0002-client-side-data-access.md)
e [`adr/0009-server-side-payments.md`](adr/0009-server-side-payments.md).

## Os três princípios das regras

**1. Negar por padrão.** Nada é legível ou gravável sem uma regra que autorize.
O bloco `match /{document=**} { allow read, write: if false; }` está lá para
tornar a intenção explícita — o Firestore já nega por omissão.

Uma observação sobre o que _não_ está no arquivo: não há um catch-all dentro de
`households/{householdId}`. Em Firestore, regras se combinam com OU — um
`allow ... if false` não retira uma permissão, apenas parece tranquilizador.
Qualquer subcoleção não declarada já está negada porque nada a permite.

**2. O household é o único limite.** Alcançar qualquer documento financeiro
exige uma membership ativa:

```
function isMember(householdId) {
  return isSignedIn()
    && exists(memberPath(householdId))
    && get(memberPath(householdId)).data.status == 'ACTIVE';
}
```

Saber um `householdId` não dá nada a ninguém.

**3. Um documento não pode mentir sobre onde mora.** Toda criação exige
`request.resource.data.householdId == householdId` do caminho, e toda
atualização exige que ele não mude. Sem isso, um cliente poderia gravar em A um
documento que se declara de B.

## Papéis

| Papel    | Lê  | Escreve | Administra | Exclui o grupo |
| -------- | --- | ------- | ---------- | -------------- |
| `VIEWER` | ✔   | —       | —          | —              |
| `MEMBER` | ✔   | ✔       | —          | —              |
| `ADMIN`  | ✔   | ✔       | ✔          | —              |
| `OWNER`  | ✔   | ✔       | ✔          | ✔              |

Contas e cartões só podem ser **excluídos** por ADMIN ou OWNER: apagá-los
orfanaria movimentações. A aplicação arquiva em vez de excluir.

## Escalada de privilégio

As regras impedem explicitamente:

- promover a si mesmo (`!(memberUid == request.auth.uid && role mudou)`);
- alterar o papel do OWNER (`resource.data.role != 'OWNER'`);
- remover o OWNER;
- criar a si mesmo como membro de um household alheio;
- adicionar um membro que não esteja em `memberUids` — o que força um admin a
  atualizar o documento do household primeiro, mantendo array e subcoleção em
  sincronia.

Cada um desses tem teste.

## O bootstrap do household

Um household é criado em **dois writes sequenciais**, não num batch.

O motivo é uma característica do Firestore: as regras avaliam um batch contra o
estado _anterior_ a ele. Uma regra que protege `members/{uid}` não enxergaria o
household sendo criado ao lado, então precisaria confiar em quem se declara
OWNER — e isso permitiria a qualquer pessoa se inserir como OWNER de um
household existente.

Com writes sequenciais:

1. `households/{id}` — exige `ownerUid == auth.uid` e `memberUids == [auth.uid]`;
2. `households/{id}/members/{uid}` — a regra verifica com `get()` que o
   household existe e que quem chama é seu `ownerUid`.

Se o segundo passo falhar, resta um household sem membros. Ninguém consegue
lê-lo, ele não custa nada, e a próxima tentativa recomeça.

## Validação de formato nas regras

As regras verificam o que é barato e crítico:

- valores monetários são inteiros (`value.amount is int`);
- `amount` de transação nunca é negativo — a direção vem do `kind`;
- dias de fechamento e vencimento de cartão entre 1 e 31;
- parcelas de cartão entre 1 e 120; de dívida, entre 1 e 600;
- documentos limitados a 60 campos.

Validação completa fica nos schemas Zod. As regras cobrem o que precisa valer
mesmo se o cliente for adversário.

## Enumeração de contas

`users/{uid}` não pode ser listada por ninguém, incluindo o próprio usuário.

As mensagens de autenticação nunca revelam se um e-mail existe. "Este e-mail já
está em uso" vira "Não foi possível criar a conta com esses dados". A
redefinição de senha responde a mesma coisa existindo a conta ou não.

Ver `src/modules/auth/ui/auth-errors.ts`.

## Ambiente local

Localmente o projeto é `demo-conta-comigo`. Um id que começa com `demo-` faz o
Emulator Suite recusar qualquer chamada a serviços reais do Google Cloud.

Além disso, `assertUsableFirebaseConfig()` recusa iniciar em desenvolvimento
apontando para um projeto real sem emuladores.

Nenhuma credencial de produção está neste repositório. `.gitignore` bloqueia
`*service-account*.json`, `*-key.json`, `*.pem` e `.env.local`.

## Observabilidade

Logs incluem: código de erro, nome da coleção, id do documento, campo que
falhou validação.

Logs **nunca** incluem: valores monetários, saldos, descrições de transações,
tokens, credenciais ou dados pessoais.

`FirestoreDocumentError` foi escrita com essa restrição: a mensagem carrega
nomes de campos e nunca conteúdo.

## Privacidade e publicidade

Nenhum dado financeiro chega a qualquer serviço de publicidade: saldo, renda,
dívida, despesas, categorias, nomes de contas, dados familiares, informações de
cartão, valores de parcelas ou comportamento financeiro individual.

O componente `AdSlot` não recebe nenhuma prop financeira — não há o que vazar.
Ver [`ADSENSE.md`](ADSENSE.md).

## LGPD

| Direito                    | Estado                                                          |
| -------------------------- | --------------------------------------------------------------- |
| Acesso aos dados           | ✔ a aplicação é a visualização                                  |
| Correção                   | ✔ edição em todas as telas                                      |
| Exportação                 | ✔ `/app/meus-dados`, JSON com tudo o que a pessoa pode ler      |
| Exclusão de conta          | ✔ `/app/meus-dados`, com reautenticação e plano explícito       |
| Minimização                | ✔ não coletamos dados bancários de acesso nem números de cartão |
| Transparência              | ✔ `/privacidade`                                                |
| Revogação de consentimento | Pendente (depende de um CMP)                                    |

Nenhum dos dois primeiros exige abrir chamado. Um direito que depende de e-mail
para um suporte não está realmente disponível.

### Exclusão: o que ela faz antes de fazer

`planAccountDeletion` decide, **antes de apagar qualquer coisa**, o que
aconteceria com cada grupo, e mostra isso à pessoa:

- grupo em que ela está sozinha → apagado com todos os dados;
- grupo de outra pessoa → ela apenas sai;
- grupo compartilhado do qual ela é responsável → **bloqueia**.

O último caso é bloqueado de propósito. Apagar levaria dados que não são só
dela, e transferir a responsabilidade para alguém que não pediu não é melhor.
Transferir é uma decisão, e decisões pertencem a pessoas.

A exclusão pede a senha de novo: o Firebase exige login recente, e pedir também
torna a ação deliberada.

A ordem dos apagamentos não é a óbvia. Apagar o documento do household exige ser
o responsável, e as regras verificam isso lendo o documento de **membro** de
quem chama — então os membros precisam sobreviver ao household, e não o
contrário.

### Uma correção da revisão da Fase 12

A regra de exclusão de membership exigia `resource.data.role != 'OWNER'`, para
impedir que alguém removesse o responsável. O efeito colateral era que o próprio
responsável nunca podia sair — e quem estivesse sozinho no próprio grupo jamais
conseguiria excluir a conta. O direito à eliminação existiria só no texto da
política.

A regra passou a permitir que qualquer pessoa saia, inclusive o responsável, e a
proibir apenas que **outra** pessoa o remova. Há teste para os dois lados.

## Rotas de servidor

As regras do Firestore protegem os dados. Elas não protegem as rotas de API, que
falam com terceiros pagos em nome do projeto — e é aí que mora o custo.

Toda rota que gasta dinheiro ou concede direito é autenticada por
`server/auth-guard.ts`: o token do Firebase é verificado pelo Admin SDK, com
`checkRevoked`. Um uid vindo no corpo é só uma alegação de quem chama sobre si
mesmo, e nunca é usado.

| Rota                          | Quem entra              | Por quê                                                     |
| ----------------------------- | ----------------------- | ----------------------------------------------------------- |
| `/api/assinatura/planos`      | Qualquer um             | Preço é público; exigir login afastaria quem está decidindo |
| `/api/assinatura/checkout`    | Token verificado        | Abre cobrança em nome de alguém                             |
| `/api/assinatura/reconciliar` | Token verificado        | Concede plano pago                                          |
| `/api/webhook/pagamento`      | Segredo compartilhado   | Chamado pelo provedor, não por um navegador                 |
| `/api/ai/diagnostico`         | Token verificado + cota | Chama um modelo cobrado por token                           |

### O caso da consultoria de IA

Uma rota que chama um modelo pago e não exige nada é uma fatura aberta ao
público: qualquer pessoa com o endereço gasta a chave do projeto num laço. Por
isso ela tem três camadas, e nenhuma delas sozinha basta:

1. **Token verificado**, o mesmo das rotas de pagamento — barra o anônimo.
2. **Cota por uid** (`server/rate-limit.ts`) — barra a conta autenticada num
   laço, que o token sozinho não impede.
3. **Teto de tamanho na entrada** (Zod) — o tamanho da pergunta é o teto de
   custo de cada chamada.

A cota vive na memória do processo. Com `maxInstances: 2`, o teto real é o dobro
do configurado e um deploy zera as janelas. É suficiente para conter custo e
abuso acidental; não seria suficiente para proteger algo irreversível. Um limite
exato exige estado compartilhado, e essa troca se faz quando houver mais de uma
instância importando.

A chave do modelo vai no cabeçalho `x-goog-api-key`, nunca na query string: a
URL aparece em log de acesso, em `referer` e dentro da mensagem de erro do
próprio `fetch`. Pelo mesmo motivo, o corpo da resposta do provedor não entra no
log — só o status.

Sem chave configurada, a rota responde pelo motor determinístico local. Isso é
degradação intencional: o produto continua respondendo, sem custo. O que **não**
pode ser silencioso é a chamada que falha _tendo_ chave — daí o status ir para o
log, para distinguir chave inválida (401/403) de modelo inexistente (404).

## Observabilidade: do console ao alerta

O `logger` sempre protegeu o **conteúdo**. O que faltava era a **forma**.

O App Hosting roda sobre Cloud Run: o que a instância escreve em stdout já é
coletado. Só que uma linha de texto vira uma entrada sem severidade, e "taxa de
erro" não é consultável sobre texto solto — não se alerta sobre o que não se
consegue contar.

Em produção, no servidor, cada log sai como **uma linha de JSON** com `severity`,
`message` e o contexto já limpo. Isso vira entrada estruturada no Cloud Logging,
e aí `severity >= ERROR` é uma consulta — e uma consulta é um alerta.

Fora de produção a saída continua legível para gente: JSON num terminal é pior
para quem depura, e ninguém alerta sobre a própria máquina.

O JSON só vale no **servidor**. O mesmo logger roda no bundle do cliente, onde
`process.stdout` não existe; escrever nele derrubaria a tela. Há teste para isso.

O que ainda falta é fora do código: criar a métrica baseada em log e o alerta no
console do Google Cloud. O formato agora permite.

## Cabeçalhos de segurança

Definidos em `next.config.ts`, aplicados a todas as rotas: HSTS, `nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` negando
câmera, microfone, geolocalização e pagamento, e `frame-ancestors 'none'` com
`X-Frame-Options: DENY` — clickjacking sobre uma tela que movimenta dinheiro.

`poweredByHeader` está desligado.

### A CSP está em observação, não em vigor

Existe uma política completa, servida como `Content-Security-Policy-Report-Only`:
o navegador **relata** o que ela bloquearia e não bloqueia nada. É a única forma
honesta de escrever a primeira versão de uma CSP para uma página que carrega
Firebase, reCAPTCHA e AdSense — terceiros cujos domínios mudam sem aviso. Uma CSP
errada não degrada: quebra o login ou a monetização, em produção, e em silêncio
para quem já estava com a página aberta.

`tests/e2e/csp.spec.ts` navega pelo site público e pelo fluxo autenticado e falha
se alguma violação for relatada. Sem esse teste, `Report-Only` seria um cabeçalho
que ninguém consulta.

**Para torná-la obrigatória** basta trocar o nome do cabeçalho em
`next.config.ts`. Antes disso, duas coisas precisam ser verdade:

1. O teste acima passando — já é o caso.
2. As diretivas de anúncio exercitadas contra tráfego real. O ambiente local não
   carrega AdSense de propósito, então elas **não** são validadas hoje. Esta é a
   razão pela qual a política ainda não vale.

Duas frouxidões conhecidas e por quê: `'unsafe-inline'` em `script-src`, porque o
App Router injeta scripts de hidratação e o nonce por requisição obrigaria toda
página a ser dinâmica; e em `style-src`, por causa dos `style={{...}}` nas telas.

## O que ainda não foi feito

- **Revisão de segurança independente.** Escrevi as regras e escrevi os testes
  delas; isso não substitui outra pessoa tentando quebrá-las. É o item mais
  importante que falta.
- Rate limiting em criação de conta — não é possível só no cliente.
- Tornar a CSP obrigatória, depois de medir as diretivas de anúncio em tráfego real.
- Métrica e alerta de taxa de erro no console do Google Cloud (o formato já permite).
- Cota de IA compartilhada entre instâncias, quando houver mais de uma que importe.
- Auditoria de alterações sensíveis (mudança de papel, exclusão).
- Destino para os logs e alertas sobre taxa de erro.

App Check está implementado em `lib/firebase/app-check.ts` e desligado
localmente; falta a chave reCAPTCHA e ligar a exigência no console. Ele nunca
substitui as regras — apenas encarece o abuso automatizado.

## Antes de qualquer deploy

`npm run verify` precisa passar, e a Fase 12 do [`ROADMAP.md`](ROADMAP.md)
precisa estar concluída. **Nenhum deploy sem autorização explícita.**
