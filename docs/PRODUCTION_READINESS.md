# Prontidão para produção

Registro da revisão da Fase 12. Escrito para ser lido antes de qualquer deploy,
e atualizado quando alguma linha deixar de ser verdade.

**Nenhum deploy foi feito.** O produto roda apenas em emuladores.

---

## O que a revisão encontrou

Cinco problemas reais, todos corrigidos. Estão listados porque a lista é mais
útil que a conclusão.

### 1. Nove índices compostos sem uso

`firestore.indexes.json` declarava índices para consultas que a aplicação não
faz. O argumento original — "declarar cedo não custa nada" — estava errado:
cada índice composto é atualizado em toda escrita do documento, o que é
cobrado, ocupa armazenamento e torna a escrita mais lenta.

Removidos. A regra passou a ser: um índice entra junto com a consulta que
precisa dele. Um índice ausente falha de forma barulhenta e imediata, com o
link para criá-lo — é o tipo de falha que se prefere ter.

### 2. A exclusão de conta era impossível

As regras impediam o OWNER de remover a própria membership, para proteger
contra outra pessoa removê-lo. O efeito colateral: quem estivesse sozinho no
próprio grupo jamais conseguiria excluir a conta, e o direito à eliminação
previsto na LGPD existiria só no texto da política.

A regra passou a permitir que qualquer pessoa saia, inclusive o responsável, e
a proibir apenas que **outra** pessoa remova o responsável.

### 3. A ordem da exclusão estava invertida

Apagar o documento do household exige ser o responsável, e as regras verificam
isso lendo o documento de **membro** de quem chama. Apagar os membros primeiro
tornaria o household indelével.

A ordem correta é: subcoleções, convites, documento do household, membros por
último.

### 4. Valores monetários podiam não ser anunciados

`MoneyText` usava `aria-label` num `<span>`. ARIA proíbe nomear elementos sem
papel, então o rótulo era ignorável — e o texto visível estava `aria-hidden`.
Um leitor de tela podia anunciar **nada** onde havia um valor.

Encontrado pela auditoria com axe-core. O sinal virou uma palavra oculta ao
lado de um glifo visível, sem nenhum ARIA.

### 5. Auditoria de acessibilidade não existia

Havia cuidado com acessibilidade, mas nenhuma verificação sistemática — o que
permitiu o item 4 passar. Agora `tests/e2e/accessibility.spec.ts` audita todas
as páginas contra WCAG 2.1 A e AA a cada execução.

---

## A revisão seguinte: as rotas de API

A revisão da Fase 12 olhou dados, regras e acessibilidade. Ela é anterior aos
três commits que trouxeram pagamentos, checkout e o diagnóstico com IA — e essas
rotas nunca tinham passado por uma leitura de prontidão.

As rotas de pagamento chegaram no padrão da casa: token verificado, Zod, logger,
erros tipados. A rota de IA (`/api/ai/diagnostico`) não. Ela foi escrita como se
fosse interna e exposta como se fosse pública.

### 6. A consultoria de IA era um proxy aberto para um modelo pago

Sem autenticação, sem cota e sem validação de entrada. Qualquer pessoa com o
endereço podia enviar POSTs num laço e gastar a chave do projeto — sem conta, sem
login, sem teto. Custo ilimitado exposto na internet aberta.

Corrigido com as mesmas três camadas descritas em
[`SECURITY.md`](SECURITY.md#o-caso-da-consultoria-de-ia): token verificado, cota
por uid e teto de tamanho por Zod.

### 7. A chave do modelo ia na query string

`?key=${apiKey}`. A URL aparece em log de acesso, em `referer` e dentro da
mensagem de erro do próprio `fetch` — e o `catch` registrava o erro cru com
`console.error`, fora do logger que existe justamente para não vazar segredo.

Passou para o cabeçalho `x-goog-api-key`. O log agora leva o status, não o corpo.

### 8. `GEMINI_API_KEY` não existia em lugar nenhum

Nem em `.env.example`, nem em `apphosting.yaml`. O código lia uma variável que
nenhum ambiente definia: em produção, a consultoria cairia para sempre no motor
local, e ninguém saberia — a degradação é silenciosa por projeto.

Declarada nos dois, como segredo `RUNTIME`, no mesmo padrão do Asaas. O nome do
modelo virou configuração (`GEMINI_MODEL`): modelos são descontinuados numa
cadência que não combina com reimplantar código para trocar uma string.

### 9. Sem timeout na chamada ao modelo

Um provedor que não responde segurava a instância até o limite da plataforma.
Agora são 20s, e o estouro cai no motor local em vez de virar erro.

### 10. O consultor anunciava a sobra do mês como se fosse o saldo

`totalCashFormatted` recebia `report.monthlyNet`. O relatório de saúde não tem
campo de saldo; o valor certo é `finance.totalCash`.

O erro não aparecia na tela: ele entrava no prompt e nas respostas, sob o rótulo
"Saldo atual em conta". Numa família com sobra negativa, o consultor afirmava um
saldo negativo para quem tinha dinheiro em conta — dois números que levam a
decisões opostas. É o tipo de defeito que este produto existe para não cometer.

### 11. Nenhum cabeçalho de segurança

`next.config.ts` estava vazio. Sem HSTS, sem `nosniff`, sem `Referrer-Policy` — e
sem nada impedindo que as telas fossem enquadradas em iframe, num produto que
movimenta dinheiro. Ver [`SECURITY.md`](SECURITY.md#cabeçalhos-de-segurança).

### 12. Cinco telas fora da auditoria de acessibilidade

`diagnostico-ia`, `visao-futuro`, `membros`, `configuracoes` e `comecar` não
estavam na lista. Duas delas são as funcionalidades mais novas do produto — as
que mais precisavam da auditoria e as únicas que não a tinham. A auditoria agora
cobre 29 páginas.

### 13. O modelo configurado tinha sido retirado

O código pedia `gemini-1.5-flash`, que não existe mais na API. Somado ao achado
nº 8 — a chave não declarada em ambiente nenhum — a consultoria com IA nunca
teria funcionado em produção, e teria falhado da pior maneira: em silêncio,
caindo no motor local sem que nada indicasse por quê.

O padrão passou a ser `gemini-2.5-flash`, que segue estável e é o de melhor
relação preço/desempenho para uso de alto volume — que é o caso aqui. O nome
continua configurável por `GEMINI_MODEL`, e agora o status HTTP da recusa vai
para o log: um modelo inexistente aparece como 404 em vez de sumir.

### 14. Os logs não eram contáveis

O `logger` já protegia o conteúdo, mas escrevia texto solto. O App Hosting roda
sobre Cloud Run e já coleta o stdout — o que faltava não era o transporte, era a
forma. Sobre texto não se consulta severidade, e sem consulta não há alerta de
taxa de erro.

Em produção, no servidor, cada log agora sai como uma linha de JSON com
`severity`. Falta só criar a métrica e o alerta no console; o formato permite.

Ao implementar isso quase introduzi uma regressão: `process.stdout` não existe no
navegador, e este logger também roda no bundle do cliente. Há teste para esse
caso.

---

---

## Estado dos itens

| Item                                          | Estado                                   |
| --------------------------------------------- | ---------------------------------------- |
| Índices conferidos contra as consultas reais  | ✔                                        |
| Estimativa de custo do Firestore              | ✔ (abaixo)                               |
| Auditoria de acessibilidade                   | ✔ 29 páginas, WCAG 2.1 AA, sem violações |
| Exportação e exclusão de dados pela interface | ✔ `/app/meus-dados`                      |
| Observabilidade sem vazar dados financeiros   | ✔ `lib/observability/logger.ts`          |
| App Check                                     | ✔ preparado; falta a chave em produção   |
| Revisão do posicionamento de anúncios         | ✔ (abaixo)                               |
| Revisão de segurança independente             | ✖ **pendente**                           |
| Rate limiting na criação de conta             | ✖ **pendente** — exige Cloud Functions   |
| Rotas de API autenticadas e com cota          | ✔ ver SECURITY.md                        |
| Cabeçalhos de segurança                       | ✔                                        |
| CSP                                           | ⚠ em `Report-Only`, com teste E2E        |
| Logs estruturados e consultáveis              | ✔ JSON com `severity` em produção        |
| Alerta de taxa de erro                        | ✖ **pendente** — criar no console        |
| Auditoria de performance com dados reais      | ⚠ parcial (abaixo)                       |

---

## Custo estimado do Firestore

O cálculo importa porque a arquitetura carrega o household inteiro e deriva em
memória (`docs/ARCHITECTURE.md`). É preciso saber a que volume isso deixa de
fazer sentido.

**Documentos por household**, para uma família com um ano de uso:

| Coleção                                                          | Ordem de grandeza |
| ---------------------------------------------------------------- | ----------------- |
| transactions                                                     | 400–600           |
| obligations                                                      | 50–150            |
| categories                                                       | 30                |
| cardPurchases                                                    | 30–80             |
| recurringRules, accounts, cards, debts, reserves, goals, budgets | < 60 somados      |
| **Total**                                                        | **~700**          |

**Leituras por sessão:** ~700 na assinatura inicial, mais quatro documentos de
identidade. Depois disso, apenas as mudanças.

**Mensal, com 1.000 famílias ativas e duas sessões por dia:**

| Item          | Volume      | Custo aproximado |
| ------------- | ----------- | ---------------- |
| Leituras      | 42M/mês     | US$ 25           |
| Escritas      | 300 mil/mês | US$ 0,55         |
| Armazenamento | ~350 MB     | US$ 0,06         |
| **Total**     |             | **~US$ 26/mês**  |

Valores da tabela pública do Firestore no momento da revisão; confirmar antes
de qualquer projeção financeira séria.

### Onde isso deixa de funcionar

O custo cresce com **documentos por household × sessões**, não com o número de
famílias. Uma família com cinco anos de histórico chega a ~3.000 transações e
multiplica por quatro o custo da própria sessão.

**Limiar prático: 2.000 documentos por household.** Acima disso vale paginar as
transações e carregar o histórico sob demanda, mantendo a assinatura completa
apenas para o que a projeção precisa. `deriveFinanceData` é o ponto onde essa
mudança entra, e é por isso que ela está separada do provider React.

---

## Performance

Do build de produção:

| Rota               | First Load JS |
| ------------------ | ------------- |
| Páginas públicas   | 188 kB        |
| Telas da aplicação | 409–417 kB    |

A diferença de ~230 kB é o SDK do Firebase (Auth e Firestore). As páginas
públicas não o carregam, que é o que mais importa para descoberta orgânica e
para quem chega pela primeira vez.

Para a área autenticada, 417 kB é aceitável mas não confortável para o público
do produto, que pode estar num plano de dados limitado. Reduções possíveis, por
ordem de retorno:

1. Não carregar Firestore na tela de login. **O diagnóstico original estava
   incompleto:** não basta tirar o `SessionProvider` do layout de autenticação.
   `lib/firebase/client.ts` importa `firebase/auth` e `firebase/firestore` no
   mesmo módulo, então qualquer tela que chame `getAuthClient()` — a de login
   inclusive, diretamente — arrasta o Firestore junto.

   A correção real é separar o bootstrap em dois módulos e apontar os 11
   arquivos que hoje importam de `client.ts` para o que cada um precisa. É
   mecânico, mas mexe na fundação de que todas as telas dependem, e o ganho é
   estimado e não medido. Não é trabalho para a véspera de um deploy: entra
   depois da primeira medição real, junto com os itens 2 e 3.

2. Adiar o carregamento das telas de relatórios e simulador, que só são abertas
   depois do painel.
3. Rever o `FinanceProvider` quando a paginação entrar: menos dados em memória,
   menos trabalho de derivação.

**Não medido ainda:** Lighthouse e Core Web Vitals contra um ambiente real, com
latência de rede e um dispositivo modesto. Um build local não diz o que
interessa aqui.

---

## Publicidade

Verificado em telas reais, mobile e desktop:

- Nenhuma requisição a `googlesyndication`, `doubleclick` ou
  `googleadservices` sai do ambiente local — há teste E2E para isso.
- O único anúncio do painel fica entre dois blocos de leitura, longe de
  qualquer botão de ação.
- Nas páginas de conteúdo, o anúncio fica depois do artigo inteiro.
- `AdSlot` não recebe nenhuma prop financeira: não há o que vazar.
- `ads.txt` é gerado a partir da configuração e não expõe publisher id fora de
  produção.

Falta, antes de ativar: conta AdSense aprovada, ids das ad units por placement
e um mecanismo de consentimento se o mercado exigir.

---

## O que ainda impede um deploy

1. **Revisão de segurança independente.** Escrevi as regras e escrevi os testes
   delas. Isso não substitui outra pessoa tentando quebrá-las. É o item mais
   importante desta lista — e o achado nº 6 mostra por quê: a rota de IA passou
   por três commits sem que ninguém notasse que estava aberta.
2. **Alerta sobre taxa de erro.** Os logs já saem estruturados e chegam ao Cloud
   Logging; falta criar a métrica baseada em log e o alerta no console. É
   configuração, não código.
3. **Rate limiting na criação de conta.** Não é possível só no cliente. Exige
   Cloud Functions ou Identity Platform, e seria a primeira função do projeto —
   deve entrar por necessidade, não por conveniência.
4. **App Check em produção.** O código está pronto; falta a chave reCAPTCHA e
   ligar a exigência no console.
5. **Medição real de performance.**
6. **Tornar a CSP obrigatória.** A política está escrita e em observação, com
   teste E2E. Falta exercitar as diretivas de anúncio contra tráfego real — o
   ambiente local não carrega AdSense de propósito.
7. **Alerta de orçamento na chave do modelo.** A cota por uid contém o abuso de
   uma conta; ela não protege contra muitas contas legítimas ao mesmo tempo. Um
   teto de gasto no console do provedor é a única defesa que não depende do
   nosso código estar certo.

---

## Regra que não muda

**Nenhum deploy sem autorização explícita.** `firebase deploy` não é executado
por ninguém automaticamente, e `npm run verify` precisa passar antes de
qualquer discussão sobre publicar.
