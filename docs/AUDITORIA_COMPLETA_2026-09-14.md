# Auditoria completa do Conta comigo — 14/09/2026

## Veredito executivo

O produto atende bem à parte de **organizar, tornar visível e priorizar** uma situação de endividamento. Os cenários auditados mostram saldo livre, contas vencidas, risco de corte, bem em garantia, projeção mensal, roteiros de negociação e encaminhamento ao Procon/Defensoria em linguagem direta. O motor financeiro e a segurança de acesso têm boa cobertura automatizada.

Contudo, o estado atual **não deve ser apresentado como plenamente confiável para uma pessoa superendividada**, especialmente no módulo jurídico. Há três falhas críticas de coerência: uma meta mostra 100% com R$ 0 guardado; parcelas vencidas aparecem com valor R$ 0 no modo emergência; e o dossiê afirma “enquadramento pleno” calculando tudo com zeros. A suíte ponta a ponta também não inicia no ambiente documentado, pois o App Hosting Emulator tenta buscar `GEMINI_API_KEY` no Secret Manager do projeto demo e encerra com erro 403.

Classificação geral: **útil como organizador e orientador, mas ainda não pronto para ser fonte principal de decisão financeira ou jurídica**.

## Escopo e método

- Estado auditado: árvore de trabalho local atual, incluindo alterações ainda não commitadas.
- Perfis percorridos: Diego Almeida (família endividada) e Joana Souza (orçamento estruturalmente deficitário).
- Fluxos observados: entrada, painel, modo emergência, plano de recuperação e superendividamento.
- Verificações técnicas: TypeScript, ESLint, testes unitários, regras do Firestore, build de produção, dependências de produção e tentativa da suíte E2E desktop/mobile.
- Evidência visual: cinco capturas de tela integrais, apresentadas durante a auditoria no chat.

## Resultados automatizados

| Verificação | Resultado | Observação |
|---|---:|---|
| TypeScript (`npm run typecheck`) | Passou | Sem erros |
| ESLint (`npm run lint`) | Passou | Sem erros |
| Testes unitários (`npm run test`) | Passou | 75 arquivos, 839 testes |
| Regras Firestore (`npm run test:rules`) | Passou | 2 arquivos, 104 testes |
| Build (`npm run build`) | Passou | 78 páginas geradas; rotas de API compiladas |
| Dependências de produção (`npm audit --omit=dev`) | Passou | 0 vulnerabilidades encontradas |
| E2E (`npm run test:e2e`) | Falhou antes dos testes | App Hosting Emulator tentou acessar Secret Manager e recebeu 403 |

## Jornada auditada

1. **Entrar e acessar os dados da família — saudável.** Login local funcionou para os dois perfis, isolamento familiar visível e navegação autenticada correta.
2. **Entender a urgência no painel — parcialmente saudável.** As prioridades são claras e acionáveis, mas a tela é muito longa e repete alertas. A meta “Diagnóstico e Mapeamento Atual” aparece como 100% concluída ao mesmo tempo em que informa “R$ 0 de R$ 1.000”.
3. **Decidir o que pagar primeiro — precisa de correção crítica.** A ordem por consequência é excelente (serviço essencial, bem em garantia, rotativo), mas financiamento e empréstimo vencidos aparecem com R$ 0, contradizendo os valores corretos mostrados no plano.
4. **Montar um plano de recuperação — parcialmente saudável.** O plano não promete quitação quando o mês não fecha, oferece calendário, ordem de dívidas e roteiro de negociação. Porém recomenda formar reserva enquanto a parcela máxima e a sobra mensal são R$ 0, sem explicitar que isso deve aguardar uma renegociação que torne o fluxo viável.
5. **Usar o módulo de superendividamento — não saudável.** Ao abrir a tela de Joana, os campos começam zerados e o sistema já declara “Situação Crítica: Enquadramento Pleno na Lei 14.181/2021”. Zero de custo é tratado como maior ou igual a zero de renda, produzindo um diagnóstico jurídico falso antes do preenchimento.

## Achados prioritários

### P0 — Diagnóstico jurídico falso com formulário vazio

Na tela de superendividamento, renda, mínimo existencial e parcelas aparecem como R$ 0,00, mas o produto declara “enquadramento pleno”. No domínio, a condição `custoTotalMensalAtual >= rendaLiquidaMensal` aceita `0 >= 0` como situação crítica. A interface também não bloqueia o resultado até haver dados mínimos válidos.

Impacto: uma pessoa vulnerável pode acreditar que possui enquadramento jurídico confirmado e gerar documentação baseada em dados vazios. O aviso de ausência de garantia jurídica não neutraliza uma afirmação categórica incorreta.

Recomendação: criar estado “dados insuficientes”; exigir renda positiva, despesas essenciais revisadas e ao menos uma dívida elegível antes do diagnóstico; nunca usar “enquadramento pleno” como conclusão jurídica automática; apresentar “indícios para buscar avaliação no Procon/Defensoria”.

### P0 — Valores R$ 0 em parcelas vencidas no modo emergência

O modo emergência lista o financiamento do carro e o empréstimo pessoal vencidos como R$ 0,00, enquanto o plano mostra R$ 1.295,12 e R$ 1.056,95. Além de incoerente, o total “fica de fora” não inclui corretamente toda a pressão imediata.

Impacto: a priorização pode induzir a família a subestimar o valor necessário para proteger um bem ou negociar uma parcela.

Recomendação: fazer a triagem consumir a mesma fonte canônica de parcelas do calendário/plano; acrescentar teste de integração que compare os valores da mesma dívida nas três telas.

### P1 — Meta com progresso contraditório

O cartão escolhe a primeira milestone não concluída; quando uma meta inviável é omitida pelo domínio, cai na milestone inicial já concluída (100%), mas o rodapé continua exibindo o estado da reserva (R$ 0 de R$ 1.000).

Impacto: reduz confiança exatamente no momento em que o usuário precisa acreditar nos números.

Recomendação: quando não existe milestone alcançável, mostrar estado “plano ainda não fecha” e CTA para renegociação, sem barra de progresso; não combinar uma milestone com métricas de outra.

### P1 — Suíte E2E não executável no fluxo documentado

O comando oficial tenta iniciar o App Hosting Emulator, que busca um segredo de produção no projeto demo. A suíte encerra antes de executar os cenários desktop/mobile.

Impacto: regressões de navegação, formulários, acessibilidade e responsividade podem chegar à produção apesar de 943 testes de domínio/regras passarem.

Recomendação: fornecer valor/secret local inofensivo para IA ou retirar a referência no override do emulador; adicionar uma checagem CI que prove que todos os testes E2E realmente começaram e terminaram.

### P1 — Conteúdo de investimento dentro do modo emergência

Após dizer que faltam R$ 1.600 para cobrir obrigações urgentes, a mesma tela recomenda camadas de reserva com Tesouro Selic, CDB, LCI/LCA e IPCA+.

Impacto: aumenta carga cognitiva e pode desviar a atenção da proteção de serviços essenciais e da renegociação imediata.

Recomendação: ocultar “Estratégia de liquidez” quando há conta essencial vencida ou fluxo inviável; substituí-la por próximos três passos e contatos/documentos necessários.

### P2 — Densidade e duplicação no painel

O painel repete as mesmas urgências em “Atenção agora”, “Ações de hoje” e “Pontos de atenção”, seguido de vários blocos extensos. A navegação lateral tem mais de 25 destinos.

Impacto: para alguém sob estresse financeiro, excesso de informação pode dificultar a primeira ação.

Recomendação: modo orientado por etapas, com uma ação primária por vez; recolher seções secundárias e agrupar cadastros/relatórios em “Mais”.

### P2 — Linguagem e acessibilidade

- Correção textual: “1 dias” deve ser “1 dia”.
- O uso de emojis como ícones é inconsistente e pode produzir leitura desnecessária em tecnologia assistiva se não forem sempre ocultados.
- Há bom link “Ir para o conteúdo”, rótulos de campos, headings e progressbars nomeadas.
- A auditoria por árvore de acessibilidade encontrou muitos controles identificáveis, mas a falha do E2E impediu confirmar Axe, teclado completo, foco, contraste calculado e reflow mobile.

## Pontos fortes

- Os princípios financeiros centrais são corretos e testados: transferência não vira despesa, empréstimo não vira renda, reserva não vira gasto e fatura não duplica compra.
- A projeção expõe déficit, data do menor saldo e compromissos por mês sem inventar uma data de quitação quando não há capacidade mensal.
- O modo emergência prioriza consequências reais, como corte de água/luz e perda de bem em garantia.
- O plano fornece scripts de negociação e explicita o custo total como pergunta obrigatória ao credor.
- Há separação entre saldo total, reserva protegida e saldo livre.
- Regras do Firestore possuem 104 testes, incluindo isolamento entre famílias.
- Há avisos de escopo e encaminhamento para atendimento público gratuito.

## O aplicativo realmente pode ajudar?

**Sim, com ressalvas.** Ele pode ajudar uma família a consolidar dados, enxergar o rombo antes, escolher urgências e preparar uma conversa de renegociação. Isso já é valor real. Hoje, porém, não deve ser usado sozinho para decidir quais dívidas pagar nem para concluir enquadramento na Lei do Superendividamento, porque as inconsistências encontradas afetam justamente essas duas decisões.

Para uma versão segura, a ordem recomendada é: (1) corrigir o diagnóstico jurídico vazio; (2) unificar os valores de parcelas na triagem; (3) corrigir a meta contraditória; (4) restaurar o E2E; (5) simplificar o fluxo de crise; (6) fazer revisão jurídica externa e teste com usuários realmente endividados.

## Limites desta auditoria

- Não houve transação financeira real nem chamada a credor.
- IA/Gemini não pôde ser validada sem configuração local funcional.
- Pagamentos Asaas não foram exercitados contra serviço externo.
- Não é possível afirmar conformidade WCAG completa sem execução automatizada e testes manuais de teclado/leitor de tela em todos os breakpoints.
- A validade jurídica dos textos e documentos exige revisão por profissional habilitado; esta auditoria avaliou coerência do produto, não prestou parecer jurídico.

## Correções aplicadas após a auditoria

Em 14/09/2026, foram implementadas e verificadas as seguintes correções:

- a triagem passou a calcular parcelas vencidas pelo cronograma real da dívida, inclusive quando não existe `installmentAmount` gravado;
- o diagnóstico de superendividamento passou a retornar “dados insuficientes” quando renda, despesas essenciais ou dívidas ainda não foram informadas, sem afirmar enquadramento jurídico nem liberar dossiê/petição;
- a meta de recuperação deixou de exibir 100% ou uma milestone concluída quando o plano não fecha, apresentando o estado “Sem prazo viável” e encaminhamento para negociação;
- as estratégias de investimento e camadas de reserva passaram a ficar ocultas enquanto houver contas que não cabem no orçamento de emergência;
- a suíte E2E passou a iniciar pelo ambiente local sem depender do App Hosting Emulator e de segredo de produção;
- foram corrigidos os contrastes apontados na página inicial, a associação de rótulo e o foco do quadro rolável na página de superendividamento;
- o teste público foi atualizado para o título atual da página inicial.

Evidências após as correções: typecheck e lint aprovados; 841 testes unitários aprovados; 104 testes de regras do Firestore aprovados; build de produção aprovado com 78 rotas; 296 testes E2E aprovados em desktop e mobile. A rodada completa cobre acessibilidade automatizada, navegação por teclado, autenticação, isolamento entre famílias, projeções, fluxo de dívidas e emergência, pagamentos defensivos, relatórios e páginas públicas.

Também foram aplicados os refinamentos de segunda prioridade que cabiam diretamente no código: concordância de “dia/dias”, marcação de emojis decorativos para que não sejam anunciados por leitores de tela e remoção da segunda listagem completa dos mesmos alertas no painel. O bloco “Atenção agora” permanece como resumo acionável e a caixa de avisos preserva o detalhamento.
