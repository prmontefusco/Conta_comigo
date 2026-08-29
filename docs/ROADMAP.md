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

## Pendente

### Fase 12 — Production Readiness

Antes de qualquer deploy, e **somente com autorização explícita**:

- [ ] Revisão de segurança independente
- [ ] Revisão das Security Rules por outra pessoa
- [ ] Verificar índices contra as consultas reais
- [ ] Estimativa de custo do Firestore
- [ ] Auditoria de performance (Lighthouse, Core Web Vitals)
- [ ] Auditoria de acessibilidade (leitor de tela, teclado, contraste)
- [ ] Revisão de privacidade e LGPD
- [ ] Exportação e exclusão de dados pela interface
- [ ] App Check
- [ ] Rate limiting na criação de conta
- [ ] Monitoramento e alertas de erro
- [ ] Revisão do posicionamento de anúncios em telas reais

## Backlog

Preparado pela arquitetura, sem implementação:

- Convites por e-mail
- Importação OFX e CSV
- Open Finance
- Notificações push e e-mail
- Assinatura Premium com cobrança
- Investimentos
- OCR de boletos e leitura de faturas
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
