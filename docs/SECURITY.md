# Segurança

Dados financeiros estão entre os mais sensíveis que um produto pode guardar. As
Security Rules são código de produção e têm testes como qualquer outro código
de produção.

**Nenhuma funcionalidade é considerada pronta se a regra correspondente não
tiver teste.** Hoje: 45 testes em `tests/rules/household-isolation.test.ts`,
executados por `npm run test:rules`.

## Modelo

Todo acesso a dados acontece no cliente. As Security Rules **são** a camada de
autorização, não uma segunda linha de defesa. Não existe caminho alternativo,
nenhum service account, nenhum backend privilegiado.

Ver [`adr/0002-client-side-data-access.md`](adr/0002-client-side-data-access.md).

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
| Exclusão de conta          | Regras permitem `delete users/{uid}`; UI pendente               |
| Exportação                 | Pendente (Fase 12)                                              |
| Minimização                | ✔ não coletamos dados bancários de acesso nem números de cartão |
| Transparência              | ✔ `/privacidade`                                                |
| Revogação de consentimento | Pendente                                                        |

## O que ainda não foi feito

- App Check, para dificultar acesso por clientes não oficiais.
- Rate limiting em criação de conta.
- Auditoria de alterações sensíveis (mudança de papel, exclusão).
- Exportação e exclusão de dados pela interface.
- Revisão de segurança independente antes de qualquer deploy (Fase 12).

## Antes de qualquer deploy

`npm run verify` precisa passar, e a Fase 12 do [`ROADMAP.md`](ROADMAP.md)
precisa estar concluída. **Nenhum deploy sem autorização explícita.**
