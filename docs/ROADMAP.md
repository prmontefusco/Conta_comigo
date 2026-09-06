# Roadmap

Estado em 28 de agosto de 2026.

## Concluído

### Fase 0 — Discovery ✔

Repositório inspecionado (vazio, nada a preservar). Ambiente verificado: Node
24, npm 11, Java 26, Firebase CLI 15, git 2.55. Arquitetura, domínio, modelo do
Firestore, Security Rules e estratégia de testes definidos e documentados.

### Fase 1 — Fundação ✔

Next.js 15.5.24 com App Router e Turbopack; TypeScript estrito
(`noUncheckedIndexedAccess`, `noUnusedLocals`, sem `any` injustificado); ESLint
com a regra que impede o domínio de importar Firebase; Prettier; Vitest;
Playwright; `@firebase/rules-unit-testing`; Emulator Suite com App Hosting,
Auth e Firestore; estrutura modular.

`npm run dev:local` sobe tudo e popula os dados.

### Fase 2 — Identity + Household ✔

Cadastro, login, logout, recuperação de senha. Household, membership, papéis
(`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`), Security Rules com 45 testes.

Critério atendido: dois households não conseguem acessar dados um do outro,
verificado por teste.

### Fase 3 — Contas e categorias ✔

Contas com saldo inicial e data, tipos, cheque especial separado do saldo, 30
categorias padrão em pt-BR, saldos derivados de movimentações.

Critério atendido: transferências não alteram receitas nem despesas, verificado
por teste.

### Fase 4 — Receitas e contas ✔

Obrigações nas duas direções, vencimentos, recorrência com oito frequências,
liquidação total e parcial, política de fim de semana, contas vencidas que
permanecem.

### Fase 5 — Cartões ✔

Cartão, fechamento, vencimento, compra, parcelamento, faturas derivadas,
pagamento total e parcial, limite comprometido incluindo parcelas futuras.

Critério atendido: uma compra é contada uma vez em todo o horizonte, verificado
por teste.

### Fase 6 — Dívidas ✔

Empréstimos e financiamentos com PRICE, SAC e modo simplificado; separação de
juros, tarifas e seguro; saldo devedor; custo de contratação; compromisso
mensal.

### Fase 7 — Forecast Engine ✔

Função pura, 7 a 365 dias, linha do tempo diária, buckets mensais, menor saldo
projetado, primeira data negativa, primeiro mês em déficit, tratamento de mês
parcial, deduplicação entre regras e obrigações materializadas.

### Fase 8 — Budget ✔

Orçamento mensal com planejado, comprometido e realizado. Gastos fora do
orçamento reportados à parte.

### Fase 9 — Reservas e metas ✔

Reservas protegidas e não protegidas, metas, cobertura de emergência, meses de
autonomia, saldo livre distinto do saldo total.

### Fase 10 — Dashboard ✔

Painel com Hoje, Pontos de atenção, Este mês, Próximos 30 dias e Próximos
meses. Telas de contas, cartões, projeção, dívidas, reservas, orçamento,
recorrências, membros e configurações. Simulador com cinco cenários.

### Fase 10b — Relatórios ✔

Seis blocos, cada um titulado com a pergunta que responde:

| Pergunta                           | O que mostra                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| Quanto entrou e quanto saiu?       | Receitas e despesas por competência, mês a mês                                        |
| Para onde meu dinheiro foi?        | Categorias do mês, separando gasto de comprometido, com comparação com o mês anterior |
| Isso é sempre assim?               | Evolução de uma categoria ou do total, com média                                      |
| Quanto do meu custo é obrigatório? | Fixas, variáveis e eventuais, com a fatia das fixas                                   |
| O orçamento está funcionando?      | Planejado contra gasto + comprometido, ao longo dos meses                             |
| Estou reduzindo meu endividamento? | Trajetória do total devido em 12 meses e data de término de cada dívida               |

Os cálculos são funções puras em `modules/reports/domain`, sem I/O, cobertas
por 28 testes. Os gráficos são SVG escrito à mão — sem biblioteca — e cada um
é decorativo para leitores de tela, sempre acompanhado dos mesmos números numa
tabela real.

O seed passou a gerar histórico realizado a partir das próprias regras de
recorrência de cada família, porque uma página de gráficos zerados é pior que
nenhuma página.

### Fase 11 — Site público ✔

Landing page e sete páginas de conteúdo original, privacidade, termos, SEO com
metadata por página, sitemap, robots, `ads.txt` gerado, `AdSlot` com
placeholders locais.

### Fase 13 — Assinatura e pagamentos ✔

Camada de servidor completa em [`BILLING.md`](BILLING.md): gateway Asaas com
Pix e checkout hospedado, webhook que trata o payload como pista e relê a
cobrança na API, reconciliação autenticada para quando o webhook se perde,
catálogo de preços vindo de configuração e tela de assinatura.

Falta apenas a `ASAAS_API_KEY`. Sem ela a venda fica fechada por construção — a
rota de planos responde `open: false` e o checkout devolve 503.

### Fase 14 — Dia a dia, família e comprovante ✔

O que faltava para o produto acompanhar a rotina, e não só os compromissos:

- Tela **Dia a dia**: registrar gasto pago (conta ou cartão, à vista ou
  parcelado) e provento recebido, com totais do mês, para onde o dinheiro foi e
  quanto cada pessoa recebeu e gastou
- Provento recebido pode virar recorrência — diária, semanal, quinzenal, mensal
  ou anual — e a regra começa na **próxima** ocorrência, para o dinheiro que já
  entrou não ser projetado duas vezes
- Cartões: **compras parceladas em andamento** (quantas faltam, até quando,
  quanto ainda vai ser cobrado) e **o que vai ser faturado mês a mês**, somando
  todos os cartões
- Família: administrador adiciona quem já tem conta pelo identificador, muda
  papéis e remove acesso; cartão, conta, dívida, compra e conta a pagar podem
  ser atribuídos a uma pessoa do grupo
- Leitura de comprovante por foto (OCR pelo modelo multimodal), que **sugere** o
  preenchimento e não grava nada sozinha; a foto não é armazenada

### Fase 15 — Diagnóstico correto e saída da dívida ✔

Três correções primeiro, porque tudo o mais se apoia nelas:

- **Saldo devedor descontava nada.** As telas chamavam `outstandingPrincipal`
  e `summariseDebts` sem a lista de parcelas pagas — que já era calculada para
  a projeção. O saldo ficava congelado no valor contratado para sempre.
- **A sobra mensal vinha do horizonte inteiro.** `recovery-calculator` e
  `financial-health` liam `forecast.summary`, que soma treze meses, e a
  tratavam como mensal: a capacidade de pagamento saía multiplicada por treze e
  a data de quitação era impossível.
- **A "economia em juros" era 20% fixos.** Agora é medida: o mesmo plano
  rodado sem aporte extra é o custo de pagar só o mínimo, e a diferença é a
  economia.

Além disso, o simulador de quitação passou a usar o motor de amortização real
(saldo, parcela e prazo vindos do cronograma) em vez de dividir o principal
pelo número de parcelas com taxa média inventada.

Sobre essa base:

- **Taxa comparável**: campo de CET no cadastro, e `effectiveMonthlyRate` com
  quatro fontes — contrato, CET, taxa resolvida a partir da parcela, ou
  desconhecida — sempre dizendo qual é qual
- **Classificação por risco**: dívida com garantia real, consignado, sem
  garantia; alerta quando um bem pode ser retomado e quando uma conta de
  serviço essencial vence
- **Negociação**: calculadora de proposta viável (dois tetos, o menor vale) e
  cinco roteiros de conversa com o credor, preenchidos com os dados da casa
- **Reserva de partida**: R$ 500 a R$ 1.000 guardados _antes_ da quitação
  total, com marco próprio na linha do tempo, à frente do "dívida zero"
- **Pílulas contextuais**: orientação curta escolhida pela situação atual da
  família, dentro do aplicativo
- **Orçamento por envelopes completo**: tetos sugeridos a partir do histórico
  dos três meses anteriores, com média e mês mais alto por categoria, e alerta
  quando uma categoria passa do teto
- **Conquistas do grupo**: marcos derivados dos registros — dívida zerada, cada
  quarto amortizado, fatura sem atraso, reserva formada, mês no azul
- **Entrar com o Google**, com criação de perfil e de grupo no primeiro acesso

## Pendente

### Fase 12 — Production Readiness (em andamento)

A revisão está registrada em
[`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md), com os problemas que ela
encontrou e o que ainda impede um deploy.

A segunda passagem cobriu as rotas de API, que são posteriores à primeira. O
achado que importa: a consultoria de IA estava exposta sem autenticação, sem
cota e sem validação — um proxy aberto para um modelo cobrado por token.

Concluído:

- [x] Índices conferidos contra as consultas reais — os nove índices compostos
      declarados não eram usados por consulta nenhuma e foram removidos
- [x] Estimativa de custo do Firestore, com o limiar em que a arquitetura de
      "carregar tudo e derivar" deixa de valer
- [x] Auditoria de acessibilidade — 29 páginas contra WCAG 2.1 AA, automatizada
- [x] Exportação e exclusão de dados pela interface (LGPD)
- [x] Observabilidade que estruturalmente não registra valores financeiros
- [x] App Check implementado e desligado localmente
- [x] Revisão do posicionamento de anúncios
- [x] Rotas de API autenticadas, validadas e com cota — inclusive a de IA
- [x] Cabeçalhos de segurança (HSTS, nosniff, referrer, frame-ancestors)
- [x] `format:check` no `npm run verify`, para o estilo não voltar a divergir

Pendente:

- [ ] **Revisão de segurança independente** — o item mais importante
- [ ] Habilitar o provedor Google no console e liberar o domínio em _Authorized
      domains_ (sem isso o botão responde `auth/operation-not-allowed`)
- [ ] Destino para os logs e alertas sobre taxa de erro
- [ ] Rate limiting na criação de conta (exige Cloud Functions)
- [ ] Chave reCAPTCHA e exigência de App Check no console
- [ ] Lighthouse e Core Web Vitals contra um ambiente real
- [ ] Mecanismo de consentimento (CMP), se o mercado exigir
- [ ] CSP completa, medida antes em `Report-Only` contra tráfego real
- [ ] Alerta de orçamento na chave do modelo de IA

**Nenhum deploy sem autorização explícita.**

## Pendente da auditoria de setembro/2026

A auditoria fechou dezessete achados e realinhou o produto ao público de
endividamento em massa. Isto é o que ficou **explicitamente de fora**, com o
motivo. A ordem é por impacto na disposição a pagar, não por esforço.

### 1. Avisar antes do vencimento ✔ feito

Resolvido dentro do aplicativo, e não por canal externo: um sininho no topo,
visível de qualquer tela. Os treze tipos de aviso já eram calculados por
`alerts/domain/alerts.ts` — o que faltava era chegarem a quem não estava
olhando o painel.

O contador conta só o que **ainda não foi visto** (`alert-inbox.ts`). Um número
que nunca muda vira decoração, e a conta de luz vencida ontem sumiria no meio
de "sua reserva está abaixo da meta", que é verdade há seis meses. A ordem é
por gravidade antes de por novidade: um corte de energia já visto continua mais
importante que um aviso novo de orçamento.

A marcação de "já vi" fica no navegador, de propósito: é conveniência de
leitura, não dado financeiro, e sincronizar isso custaria uma escrita por aviso
lido e uma coleção nova nas Security Rules.

Push, e-mail e WhatsApp continuam possíveis depois, reutilizando o mesmo
domínio. Nenhum deles é necessário para o aviso existir.

### 2. Lançar em segundos ✔ feito

Era o buraco que eu tinha deixado fora deste backlog, e o mais caro: o
formulário completo pede nove campos, e um pão de R$ 12 não justifica nove
campos. Quem desiste de lançar não deixa de gastar — deixa de enxergar, e
todas as projeções envelhecem junto.

A barra de lançamento rápido em Dia a dia pede dois toques: valor e categoria.
Data, conta e visibilidade vêm do que a casa vem fazendo
(`daily/domain/quick-entry.ts`), e o formulário completo continua a um toque.
A categoria é o único campo que **não** é adivinhado: errar a conta custa uma
correção, errar a categoria contamina orçamento, relatório e a leitura do que
a casa gasta com o quê.

### 3. Importar extrato (OFX, CSV) ✔ feito

`transactions/domain/statement-import.ts` lê os dois formatos. OFX é SGML com
tags que não fecham — um parser de XML engasga, então a leitura é por marcador.
CSV não tem padrão nenhum: as colunas são encontradas pelo cabeçalho (com ou
sem acento) e o separador é detectado sozinho.

O cuidado que exigiu mais atenção foi o número. `-45.90` e `-45,90` são o mesmo
valor em notações diferentes, e `1.234` é genuinamente ambíguo — mil duzentos e
trinta e quatro, ou um vírgula dois? Desempata a quantidade de casas: dinheiro
tem duas, então três dígitos depois do separador é milhar. Errar isto não
produz erro visível, produz saldo errado com aparência de precisão.

A tela lê e **propõe**: nada é gravado sem conferência, e o que já existe com a
mesma data e valor chega desmarcado. Um extrato traz transferência entre contas
próprias, estorno e o que já foi lançado à mão.

### 4. Simulador de renegociação de prazo ✔ feito

Era a pergunta que o aviso de plano inviável levantava e não respondia. Agora
`negotiation/domain/term-extension.ts` resolve a Price para o prazo e a tela de
negociação mostra a parcela a pedir, em quantas vezes, e — lado a lado — o
alívio mensal e o quanto a dívida encarece. Três desfechos que um número
sozinho esconderia: quando a parcela que cabe não cobre nem os juros (nenhum
prazo resolve, o caminho é abatimento ou portabilidade), quando o prazo
necessário passa do que um credor aceita, e quando zerar aquela dívida ainda
não fecha o mês.

### 5. Perfil de dependente, sem login ✔ feito

Papel `DEPENDENT` e o botão "Adicionar pessoa sem acesso" em Membros. Um campo
só — nome — porque é tudo o que existe para pedir. A pessoa passa a aparecer
em "de quem é este gasto" e não entra no aplicativo.

A segurança vem da forma do id, não de uma verificação de papel: o documento é
criado com prefixo `dep_`, que o Firebase Auth nunca emite, e as regras exigem
esse prefixo justamente para impedir que um administrador crie
`members/{uidDeUmEstranho}` e faça o próprio grupo aparecer na lista de outra
pessoa. Dez testes de regras guardam essa fronteira (docs/SECURITY.md).

Dependentes **não ocupam assento** no limite do plano: cobrar por um filho de
doze anos que nem entra no aplicativo tornaria o plano gratuito inútil para uma
família.

### 6. Onboarding curto ✔ feito

Três etapas abrem uma tela útil — contas, renda e contas fixas —, e o domínio
já sabia disso em `hasMinimumViableSetup`. A tela mostrava seis caixas iguais
mesmo assim.

Agora a barra de progresso mede só o essencial, e as outras três ficam num
bloco recolhido: "depois, quando der". Elas continuam ali e continuam valendo;
deixaram de bloquear a sensação de ter terminado.

### 7. Decisões comerciais que não são minhas para tomar

- **Preço.** Continua em R$ 7,99 / R$ 69,99. A recomendação da auditoria foi
  R$ 14,90 / R$ 119,90 — dentro da faixa de mercado, sem sinalizar produto
  inferior. Agora é uma linha em `SUBSCRIPTION_PRICE_MONTHLY_CENTS` e
  `SUBSCRIPTION_PRICE_YEARLY_CENTS`, e o site inteiro acompanha sozinho.
- **Preço social.** Gratuidade integral por seis meses para quem registra
  déficit e contas em atraso. Custo marginal quase zero, e torna a missão
  demonstrável em vez de declarada.

### 8. Contagem regressiva da dívida ✔ feito

Vinte e dois meses de parcela em dia é muito tempo para não ver nada
acontecer. `debt-countdown.ts` compara o saldo devedor de hoje com o de três
meses atrás, reconstruído do cronograma, e a tela de Visão de Futuro abre com
"você derrubou R$ X" e a dívida mais perto de acabar.

Não comemora o que não aconteceu: sem movimento no período, devolve `null` e o
cartão mostra só o saldo. Um "R$ 0,00 pagos" em destaque seria desânimo com
aparência de dado.

## O que ainda falta

### Decisão de preço

Ver a seção 7 acima. É a única pendência do escopo da auditoria.

### ~~Rate limit compartilhado~~ ✔ feito

`server/rate-limit-store.ts` conta no Firestore, em transação, com um documento
por chave e janela. A falha é permissiva de propósito: se o Firestore não
responder, cai para a contagem em memória em vez de bloquear — negar a função a
todo mundo por falha de infraestrutura seria pior que perder precisão entre
instâncias.

Falta configurar a **política de TTL** no campo `expiresAt` da coleção
`rateLimits`, no console do Firestore. Sem ela nada quebra e nada fica
inseguro; a coleção só cresce (docs/SECURITY.md).

### Notificação fora do aplicativo

O sininho resolve o aviso para quem abre o aplicativo. Push, e-mail ou WhatsApp
alcançariam quem não abre — e reutilizam o mesmo domínio de alertas. Continua
dependendo de uma escolha de canal e de infraestrutura.

### ~~Convite por e-mail~~ ✔ feito

O diagnóstico de que "só um servidor pode intermediar" estava errado. As
Security Rules conseguem autorizar o próprio convidado, desde que consigam
encontrar o convite dele sem que ele diga qual é — e é isso que se obtém
fazendo o **id do documento ser o e-mail em minúsculas**. A regra monta o
caminho a partir de `request.auth.token.email` e busca.

A outra metade é `email_verified`: sem ela bastaria criar uma conta com o
e-mail de outra pessoa para cair no grupo dela. O cadastro passou a enviar a
confirmação, e a tela de convite reenvia e força um token novo — porque
confirmar o e-mail não atualiza o token que já está no navegador, e é o token
que as regras leem.

Quinze testes de regras cobrem isso, a maioria são tentativas que precisam
falhar (docs/SECURITY.md).

### O aplicativo não envia e-mail

O convite é endereçado a um e-mail, mas o link é compartilhado à mão. Enviar de
verdade exige provedor de envio — a mesma decisão de infraestrutura da
notificação fora do aplicativo, e vale resolver as duas juntas.

## Backlog anterior

Preparado pela arquitetura, sem implementação:

- Open Finance
- Investimentos
- Aplicativos móveis nativos
- Múltiplas moedas
- Feriados nacionais no cálculo de dias úteis

## Explicitamente fora de escopo

**IA.** Não antes de os dados, o domínio e as projeções estarem corretos. E,
mesmo depois, ela poderá _explicar_ os números calculados pelo motor
determinístico — nunca substituí-lo.

**Consultoria financeira.** O produto apresenta fatos e consequências. A decisão
é do usuário.

**Microsserviços, Kafka, Kubernetes, event sourcing, CQRS completo.** Isto é um
SaaS pequeno.
