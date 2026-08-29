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
permitiu o item 4 passar. Agora `tests/e2e/accessibility.spec.ts` audita 24
páginas contra WCAG 2.1 A e AA a cada execução.

---

## Estado dos itens

| Item                                          | Estado                                    |
| --------------------------------------------- | ----------------------------------------- |
| Índices conferidos contra as consultas reais  | ✔                                         |
| Estimativa de custo do Firestore              | ✔ (abaixo)                                |
| Auditoria de acessibilidade                   | ✔ 24 páginas, WCAG 2.1 AA, sem violações  |
| Exportação e exclusão de dados pela interface | ✔ `/app/meus-dados`                       |
| Observabilidade sem vazar dados financeiros   | ✔ `lib/observability/logger.ts`           |
| App Check                                     | ✔ preparado; falta a chave em produção    |
| Revisão do posicionamento de anúncios         | ✔ (abaixo)                                |
| Revisão de segurança independente             | ✖ **pendente**                            |
| Rate limiting na criação de conta             | ✖ **pendente** — exige Cloud Functions    |
| Monitoramento e alertas de erro               | ✖ **pendente** — falta o destino dos logs |
| Auditoria de performance com dados reais      | ⚠ parcial (abaixo)                        |

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

1. Não carregar Firestore na tela de login (hoje o `SessionProvider` do layout
   de autenticação o traz junto).
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
   importante desta lista.
2. **Destino para os logs.** O `logger` já protege o conteúdo; falta para onde
   enviá-lo e alertas sobre taxa de erro.
3. **Rate limiting na criação de conta.** Não é possível só no cliente. Exige
   Cloud Functions ou Identity Platform, e seria a primeira função do projeto —
   deve entrar por necessidade, não por conveniência.
4. **App Check em produção.** O código está pronto; falta a chave reCAPTCHA e
   ligar a exigência no console.
5. **Medição real de performance.**

---

## Regra que não muda

**Nenhum deploy sem autorização explícita.** `firebase deploy` não é executado
por ninguém automaticamente, e `npm run verify` precisa passar antes de
qualquer discussão sobre publicar.
