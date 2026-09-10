import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, ContentPage, Section } from "@/components/content-page";
import {
  JsonLd,
  buildArticleSchema,
  buildFaqSchema,
  type FaqItem,
} from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Precisa de Advogado para Superendividamento? Veja como entrar por conta própria ou de graça",
  description:
    "Descubra se é obrigatório ter advogado na Lei 14.181/2021. Saiba como iniciar o processo sozinho no CEJUSC e Procon, documentos exigidos e quando a Defensoria Pública atua gratuitamente.",
  keywords: [
    "precisa de advogado para superendividamento",
    "lei do superendividamento precisa de advogado",
    "como dar entrada no superendividamento sozinho",
    "cejusc superendividamento sem advogado",
    "procon superendividamento gratis",
    "defensoria publica superendividamento",
    "peticao inicial superendividamento",
    "documentos para lei do superendividamento",
  ],
  alternates: { canonical: "/precisa-de-advogado-para-superendividamento" },
};

const ADVOGADO_FAQS: readonly FaqItem[] = [
  {
    question: "Preciso de advogado para dar entrada na Lei do Superendividamento?",
    answer:
      "Não para a fase pré-processual ou administrativa. O cidadão pode apresentar o pedido de conciliação e repactuação de dívidas diretamente no CEJUSC do Tribunal de Justiça, no Procon da sua cidade ou pela plataforma Consumidor.gov.br sem qualquer necessidade de advogado.",
  },
  {
    question: "Quando o advogado ou a Defensoria Pública se tornam obrigatórios?",
    answer:
      "Se algum credor não aceitar a conciliação e for necessário instaurar a fase judicial contenciosa (Processo por Superendividamento para imposição do plano judicial compulsório, previsto no Artigo 104-B do CDC) ou pedir liminar para desbloqueio urgente de salário, a representação por advogado ou pela Defensoria Pública é exigida por lei.",
  },
  {
    question: "Quem não tem dinheiro para pagar advogado particular pode usar a Defensoria Pública?",
    answer:
      "Sim. Pessoas que comprovarem insuficiência de recursos (critério de hipossuficiência econômica, normalmente renda familiar de até 3 salários mínimos líquidos, variando por Estado) têm direito ao atendimento 100% gratuito pela Defensoria Pública estadual, no Núcleo de Defesa do Consumidor (NUDECON).",
  },
  {
    question: "Quais documentos preciso reunir antes de iniciar o pedido?",
    answer:
      "Comprovante de residência atualizado, documentos pessoais (RG/CPF), últimos 3 contracheques ou holerites (ou extratos do benefício do INSS), extratos de todas as contas bancárias dos últimos 90 dias, extratos dos empréstimos consignados (HISCON) e a lista detalhada de gastos com sobrevivência (aluguel, água, luz, farmácia e mercado).",
  },
  {
    question: "O que é melhor: entrar pelo Procon, pelo CEJUSC ou pela Justiça?",
    answer:
      "O CEJUSC (Centro Judiciário de Solução de Conflitos dos Tribunais de Justiça) costuma ser o canal mais eficiente, pois o acordo firmado tem eficácia de sentença judicial irrecorrível e a falta injustificada do banco suspende imediatamente a cobrança de juros e encargos. O Procon também é uma excelente alternativa rápida e informal.",
  },
  {
    question: "O Conta Comigo garante que meu pedido será aceito ou que vou ganhar a ação?",
    answer:
      "Não. O Conta Comigo é exclusivamente uma aplicação de suporte no controle orçamentário, auxílio na organização das finanças para diminuir o endividamento e preparação técnica da documentação inicial e cálculos. A decisão de aceitar a petição, deferir liminares ou homologar planos cabe soberana e exclusivamente à autoridade judicial ou administrativa competente.",
  },
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={buildArticleSchema({
          title: "Precisa de Advogado para Superendividamento? Veja como entrar por conta própria ou de graça",
          description:
            "Descubra se é obrigatório ter advogado na Lei 14.181/2021. Saiba como iniciar o processo sozinho no CEJUSC e Procon, documentos exigidos e quando a Defensoria Pública atua gratuitamente.",
          urlPath: "/precisa-de-advogado-para-superendividamento",
        })}
      />
      <JsonLd data={buildFaqSchema(ADVOGADO_FAQS)} />

      <ContentPage
        title="Precisa de Advogado para Superendividamento? Veja como agir sozinho ou de graça"
        intro="Uma das principais dúvidas de quem está sufocado por empréstimos, consignados e cartões de crédito é: 'Preciso pagar um advogado para conseguir renegociar minhas dívidas pela Lei 14.181/2021?' A resposta direta é: NÃO na primeira fase. Você pode agir por conta própria ou com a ajuda gratuita de órgãos públicos."
      >
        <Section heading="1. A resposta curta: você NÃO é obrigado a contratar advogado">
          <p>
            A <strong>Lei nº 14.181/2021</strong> foi elaborada exatamente para proteger cidadãos vulneráveis. O legislador
            criou uma fase de conciliação pré-processual projetada para ser simples, acessível e sem taxas de justiça:
          </p>
          <Bullets
            items={[
              "Fase de Conciliação Pré-Processual (CEJUSC): O próprio cidadão pode comparecer ao fórum da comarca e solicitar o agendamento de audiência de repactuação com todos os seus credores.",
              "Fase Administrativa (Procon): Órgão de defesa do consumidor que notifica todos os bancos e cartões para negociação coletiva sem intermediários pagos.",
              "Plataforma Consumidor.gov.br: Canal digital gratuito do Ministério da Justiça para notificação extrajudicial dos credores.",
            ]}
          />
          <p className="mt-3">
            Portanto, se você não tem condições financeiras para contratar um advogado particular, não se preocupe: você
            pode dar o primeiro passo sozinho ou recorrer aos órgãos de atendimento gratuito.
          </p>
        </Section>

        <Section heading="2. Onde dar entrada por conta própria (sem custos)">
          <div className="space-y-4">
            <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-5">
              <h3 className="font-semibold text-base text-[color:var(--color-foreground)]">
                Opção A: CEJUSC (Centros Judiciários dos Tribunais de Justiça) — Recomendado
              </h3>
              <p className="mt-2 text-sm text-[color:var(--color-foreground)]">
                Localizados nos fóruns estaduais, os CEJUSCs conduzem audiências de conciliação supervisionadas pelo Poder
                Judiciário. O acordo homologado no CEJUSC tem força de <strong>título executivo judicial</strong> (mesmo valor
                de uma sentença de juiz). Além disso, a lei estipula que se o banco for intimado e faltar sem justificativa,
                a exigibilidade da dívida é suspensa imediatamente.
              </p>
            </div>

            <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-5">
              <h3 className="font-semibold text-base text-[color:var(--color-foreground)]">
                Opção B: Procon Municipal ou Estadual (Núcleo de Superendividamento)
              </h3>
              <p className="mt-2 text-sm text-[color:var(--color-foreground)]">
                Muitos Procons contam com núcleos especializados no acolhimento de famílias superendividadas. Eles analisam
                o orçamento familiar, convocam todos os bancos credores em uma única data e intermedeiam a proposta de
                pagamento em até 60 meses com base na sua sobra salarial.
              </p>
            </div>

            <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-5">
              <h3 className="font-semibold text-base text-[color:var(--color-foreground)]">
                Opção C: Defensoria Pública do Estado (NUDECON)
              </h3>
              <p className="mt-2 text-sm text-[color:var(--color-foreground)]">
                Para quem comprovar hipossuficiência econômica, os defensores públicos oferecem consultoria e representação
                jurídica integralmente gratuita. Eles podem tanto atuar na fase amigável quanto ajuizar ações judiciais com
                pedidos de liminar de urgência.
              </p>
            </div>
          </div>
        </Section>

        <Section heading="3. Quando o advogado ou Defensor Público passa a ser necessário?">
          <p>
            Embora você possa iniciar a conciliação sem advogado, há duas hipóteses em que a intervenção jurídica técnica
            passa a ser necessária:
          </p>
          <Bullets
            items={[
              "Fase Judicial Compulsória (Artigo 104-B do CDC): Se um ou mais bancos recusarem terminantemente o plano amigável ou faltarem à audiência, o caso vira uma ação judicial litigiosa. Nessa etapa, o juiz decidirá o plano obrigatório por sentença, sendo indispensável a assinatura de advogado ou defensor público.",
              "Pedidos de Liminar de Urgência: Se o banco estiver debitando 70% ou 80% do seu salário na conta-corrente, deixando sua família sem comida, é necessário ajuizar uma Ação com Tutela de Urgência para cessar imediatamente os descontos e liberar o Mínimo Existencial.",
            ]}
          />
          <p className="mt-3">
            Em ambos os casos, caso você não tenha recursos para contratar honorários advocatícios particulares, a
            <strong> Defensoria Pública</strong> do seu Estado assume o processo de forma 100% gratuita.
          </p>
        </Section>

        <Section heading="4. Checklist oficial de documentos que você precisa levar">
          <p>
            Para que o conciliador, o Procon ou o juiz aceitem seu pedido sem atrasos, você precisará reunir os seguintes
            documentos:
          </p>
          <Bullets
            items={[
              "Documentos Pessoais: Cópia de RG, CPF e Certidão de Nascimento ou Casamento.",
              "Comprovante de Residência Atualizado: Conta de água, luz ou gás dos últimos 60 dias.",
              "Comprovação de Renda: Últimos 3 holerites / contracheques ou Extrato do Benefício do INSS.",
              "Extratos Bancários Integrais: Extrato dos últimos 90 dias de TODAS as contas bancárias em que você recebe renda ou movimenta valores.",
              "Extrato de Consignados (HISCON): Histórico de Empréstimos Consignados emitido pelo Meu INSS ou pelo portal de servidor público (SouGov, Portal do Servidor Estadual/Municipal).",
              "Contratos ou Faturas das Dívidas: Contratos de financiamento, extratos de faturas de cartão de crédito e extratos de limites utilizados do cheque especial.",
              "Comprovantes de Gastos de Subsistência: Contas de aluguel, condomínio, luz, água, gás, recibos de farmácia/medicamentos contínuos e laudos médicos se houver doentes crônicos.",
              "Dossiê Financeiro com Demonstração do Mínimo Existencial e Plano de Pagamento em 60 meses.",
            ]}
          />
        </Section>

        <Section heading="5. Como o Conta Comigo te ajuda a dar entrada sozinho">
          <p>
            O grande obstáculo para quem tenta dar entrada sozinho no CEJUSC ou Procon é a complexidade dos cálculos:
            como provar qual é a sua renda líquida real, quanto custa seu sustento e como ratear a sobra entre múltiplos
            bancos em parcelas de até 60 meses sem errar a matemática?
          </p>
          <p className="mt-3">
            O <strong>Conta Comigo</strong> resolve isso em minutos:
          </p>
          <Bullets
            items={[
              "Diagnóstico Automático: Calcula seu Mínimo Existencial garantido pelo Decreto nº 11.567/2023 e indica o percentual de comprometimento da sua renda.",
              "Plano de Repactuação em 60 Meses: Simula o rateio proporcional para todos os seus bancos, com carência de 180 dias.",
              "Dossiê Técnico para Juiz e Procon: Gera um relatório completo comprovando gastos essenciais e cortes efetuados.",
              "Gerador de Petição e Requerimento Inicial: Monta a petição formal com fundamentos jurídicos (Art. 104-A do CDC), pronta para você imprimir, assinar e levar ao CEJUSC, Procon ou Defensoria.",
            ]}
          />

          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            <p className="font-bold uppercase tracking-wider text-2xs text-amber-800 dark:text-amber-300">
              Aviso de Escopo: Suporte Operacional & Ausência de Garantia de Resultado
            </p>
            <p className="mt-1.5 leading-relaxed">
              O <strong>Conta Comigo</strong> é exclusivamente uma aplicação de <strong>suporte no controle orçamentário</strong>, auxílio e orientação na organização financeira para diminuição do endividamento e <strong>suporte na preparação da documentação inicial e cálculos técnicos</strong>.
            </p>
            <p className="mt-1.5 leading-relaxed text-amber-900/90 dark:text-amber-300/90">
              O aplicativo <strong>não presta assessoria jurídica privativa</strong> e <strong>não garante que a ação seja aceita, deferida ou ganha</strong>, nem que as propostas sejam acolhidas pelos credores. A aceitação e o êxito do pedido dependem única e exclusivamente da análise soberana do juiz ou órgão competente (CEJUSC, Procon ou Defensoria Pública).
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/app/superendividamento"
              className="inline-block rounded-xl bg-[color:var(--color-brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            >
              Gerar Petição Inicial e Dossiê no Conta Comigo &rarr;
            </Link>
            <Link
              href="/acao-de-repactuacao-de-dividas"
              className="inline-block rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-5 py-3 text-sm font-semibold text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface-sunken)]"
            >
              Conhecer as fases da Ação de Repactuação &rarr;
            </Link>
          </div>
        </Section>

        <Section heading="6. Dúvidas Frequentes">
          <div className="mt-4 space-y-3">
            {ADVOGADO_FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4 open:bg-[color:var(--color-surface-sunken)]"
              >
                <summary className="flex cursor-pointer items-center justify-between font-medium text-sm text-[color:var(--color-foreground)]">
                  <span>{faq.question}</span>
                  <span className="ml-2 text-base text-[color:var(--muted-fg)] transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-[color:var(--muted-fg)] leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </Section>
      </ContentPage>
    </>
  );
}
