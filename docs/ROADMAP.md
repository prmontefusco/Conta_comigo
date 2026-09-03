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

### Fase 11 — Site público + AdSense Ready ✔

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

## Backlog

Preparado pela arquitetura, sem implementação:

- Convites por e-mail (hoje a entrada no grupo é pelo identificador da pessoa)
- Importação OFX e CSV
- Open Finance
- Notificações push e e-mail
- Investimentos
- Leitura de boleto e de fatura fechada (o comprovante de compra já é lido)
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
