import Link from "next/link";
import type { Metadata } from "next";
import {
  JsonLd,
  buildSoftwareAppSchema,
  buildFaqSchema,
  type FaqItem,
} from "@/lib/json-ld";

export const metadata: Metadata = {
  // `absolute` evita o sufixo do template do layout raiz, que aqui produziria
  // "Conta comigo — ... | Conta comigo".
  title: {
    absolute: "Conta comigo — Gestão Financeira Familiar, Dívidas e Mínimo Existencial",
  },
  description:
    "Aplicativo gratuito de controle de gastos, gestão financeira familiar, renegociação de dívidas e proteção pelo superendividamento (Lei 14.181/2021). Projete suas finanças com clareza.",
  keywords: [
    "controle de gastos",
    "gestão financeira familiar",
    "planejamento financeiro",
    "lei do superendividamento",
    "como sair das dívidas",
    "mínimo existencial",
    "organização de finanças",
    "aplicativo financeiro gratuito",
    "repactuação de dívidas",
  ],
  alternates: { canonical: "/" },
};

const QUESTIONS = [
  "Quanto dinheiro eu tenho hoje, de verdade?",
  "Quanto disso já está comprometido com contas deste mês?",
  "Quais contas vencem primeiro?",
  "Quanto vai sobrar no fim do mês?",
  "Uma compra parcelada cabe no meu orçamento?",
  "Se minha renda cair, o que acontece?",
  "Como estarão minhas finanças daqui a 3, 6 e 12 meses?",
] as const;

const PRINCIPLES = [
  {
    title: "Transferência não é despesa",
    body:
      "Mover dinheiro entre suas contas não empobrece ninguém. O Conta comigo registra a " +
      "movimentação sem inventar um gasto que não existiu.",
  },
  {
    title: "Empréstimo não é renda",
    body:
      "Receber R$ 10.000 de empréstimo aumenta o que está disponível e, ao mesmo tempo, cria " +
      "uma obrigação. As duas coisas aparecem separadas, porque são coisas diferentes.",
  },
  {
    title: "Reserva não é gasto",
    body:
      "Guardar dinheiro não é perdê-lo. O saldo continua sendo seu; o que muda é quanto está " +
      "disponível para novas decisões. Por isso mostramos saldo total e saldo livre.",
  },
  {
    title: "A fatura do cartão não é uma segunda despesa",
    body:
      "A compra é contabilizada no mês em que aconteceu. Pagar a fatura movimenta dinheiro, " +
      "mas não repete o gasto. Sem isso, o mês parece pior do que é.",
  },
] as const;

const HOME_FAQS: readonly FaqItem[] = [
  {
    question: "O que é a Lei do Superendividamento (Lei 14.181/2021)?",
    answer:
      "A Lei 14.181/2021 protege cidadãos que não conseguem pagar suas dívidas de consumo sem comprometer a sobrevivência da família. Ela permite reunir todos os credores em uma audiência conjunta no Procon ou na Justiça para aprovar um plano de repactuação em até 5 anos com carência de até 180 dias.",
  },
  {
    question: "O que é o Mínimo Existencial e como ele protege meu salário?",
    answer:
      "O Mínimo Existencial (Decreto nº 11.567/2023) garante que descontos de empréstimos consignados, cartões e débitos automáticos não podem confiscar o valor necessário para alimentação básica, moradia, remédios essenciais e luz. O piso federal de referência é R$ 600 por pessoa, podendo ser superior conforme os gastos essenciais comprovados.",
  },
  {
    question: "Como o Conta Comigo ajuda no controle de gastos e na gestão financeira familiar?",
    answer:
      "O Conta Comigo centraliza contas, cartões e receitas com projeção futura dos próximos meses. Você sabe com antecedência se um mês vai fechar no vermelho, divide despesas compartilhadas sem atrito com permissões granulares para a família e calcula se sua renda está protegida contra o superendividamento.",
  },
  {
    question: "O Conta Comigo é gratuito?",
    answer:
      "Sim. O plano gratuito oferece todas as funcionalidades essenciais de controle de contas, projeção mensal, divisão básica familiar e diagnóstico do superendividamento. O plano Premium adiciona geração de dossiês com IA, auditoria avançada e suporte prioritário.",
  },
];

const GUIDES = [
  {
    title: "Lei do Superendividamento (Lei 14.181/2021)",
    description: "Como funciona a repactuação de dívidas em bloco, carência de 180 dias e prazo de até 5 anos.",
    href: "/lei-do-superendividamento",
    tag: "Legislação e Direitos",
  },
  {
    title: "Mínimo Existencial: Decreto nº 11.567/2023",
    description: "Impeça bancos de confiscarem seu salário e saiba quais despesas são protegidas por lei.",
    href: "/minimo-existencial",
    tag: "Proteção Salarial",
  },
  {
    title: "Como Sair das Dívidas Passo a Passo",
    description: "Estanque os juros e escolha entre o Método Bola de Neve e Avalanche para quitar tudo.",
    href: "/como-sair-das-dividas",
    tag: "Estratégia Prática",
  },
  {
    title: "Orçamento e Gestão Financeira Familiar",
    description: "Divida despesas da casa sem conflitos, com níveis de privacidade e permissões para o casal.",
    href: "/orcamento-familiar",
    tag: "Família e Casal",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <JsonLd data={buildSoftwareAppSchema()} />
      <JsonLd data={buildFaqSchema(HOME_FAQS)} />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
        {/* Background glow effects */}
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
          <div className="h-[450px] w-[700px] rounded-full bg-gradient-to-tr from-cyan-200/40 via-teal-100/30 to-emerald-100/40 blur-3xl" />
        </div>

        <div className="mx-auto max-w-5xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--card-border)] bg-white/80 px-3.5 py-1 text-xs font-medium text-[color:var(--color-brand-700)] shadow-xs backdrop-blur-xs">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Proteção Legal • Lei 14.181/2021 & Gestão Familiar Colaborativa</span>
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-neutral-900 sm:text-5xl sm:leading-[1.15]">
            Controle suas contas de hoje e{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[color:var(--color-brand-700)] to-teal-600">
              antecipe o seu futuro financeiro
            </span>{" "}
            sem surpresas.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base text-neutral-600 sm:text-lg leading-relaxed">
            O Conta Comigo reúne o que você tem, o que já está comprometido e o que ainda vai acontecer.
            Projete até 12 meses à frente, proteja seu salário com o <strong>Mínimo Existencial</strong> e
            organize as finanças da sua casa em equipe.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/criar-conta"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[color:var(--color-brand-600)] px-7 font-semibold text-white shadow-md shadow-cyan-900/10 transition-all hover:bg-[color:var(--color-brand-700)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Criar conta gratuita
            </Link>
            <Link
              href="/como-funciona"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[color:var(--card-border)] bg-white/90 px-6 font-medium text-neutral-800 shadow-2xs transition-all hover:bg-neutral-50 hover:border-neutral-300"
            >
              Ver como funciona &rarr;
            </Link>
          </div>

          {/* Micro trust indicators */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-500">
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>100% gratuito para começar</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Sem senhas bancárias (Zero risco)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Dossiê da Lei 14.181/2021 incluso</span>
            </div>
          </div>

          {/* VISUAL DASHBOARD MOCKUP */}
          <div className="mt-12 overflow-hidden rounded-2xl border border-[color:var(--card-border)] bg-neutral-900/5 p-2 sm:p-3 shadow-2xl backdrop-blur-xs">
            <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white text-left shadow-xs">
              {/* Fake App Browser Chrome */}
              <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-400/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-400/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
                  <span className="ml-2 text-2xs font-medium text-neutral-400">app.contacomigo.com.br/dashboard</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-2xs font-semibold text-emerald-800">
                    Casa & Família
                  </span>
                </div>
              </div>

              {/* Mockup Dashboard Content */}
              <div className="p-4 sm:p-6 bg-slate-50/50 space-y-5">
                {/* Stat Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xs">
                    <span className="text-2xs font-medium text-neutral-500 uppercase tracking-wider">Saldo Líquido</span>
                    <p className="mt-1 text-base sm:text-lg font-bold text-neutral-900">R$ 5.420,00</p>
                    <span className="mt-0.5 inline-block text-2xs text-emerald-600 font-medium">Livre p/ decisões: R$ 2.920</span>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xs">
                    <span className="text-2xs font-medium text-neutral-500 uppercase tracking-wider">Contas do Mês</span>
                    <p className="mt-1 text-base sm:text-lg font-bold text-neutral-900">R$ 2.500,00</p>
                    <span className="mt-0.5 inline-block text-2xs text-neutral-500">6 pendentes • 2 pagas</span>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xs">
                    <span className="text-2xs font-medium text-neutral-500 uppercase tracking-wider">Runway / Fôlego</span>
                    <p className="mt-1 text-base sm:text-lg font-bold text-teal-700">3.8 meses</p>
                    <span className="mt-0.5 inline-block text-2xs text-teal-600 font-medium">Caixa equilibrado</span>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-2xs">
                    <span className="text-2xs font-medium text-neutral-500 uppercase tracking-wider">Mínimo Existencial</span>
                    <p className="mt-1 text-base sm:text-lg font-bold text-emerald-700">Preservado</p>
                    <span className="mt-0.5 inline-block text-2xs text-emerald-600 font-medium">Art. 54-A CDC</span>
                  </div>
                </div>

                {/* Mockup Projection preview */}
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                        Projeção Antecipada (Próximos 3 Meses)
                      </h4>
                      <p className="text-2xs text-neutral-500">Veja o aperto antes que ele aconteça e tome decisões seguras</p>
                    </div>
                    <span className="rounded-md bg-cyan-50 px-2 py-0.5 text-2xs font-semibold text-cyan-700 border border-cyan-200">
                      Antecedência Ativa
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                      <div className="flex justify-between font-semibold text-emerald-950">
                        <span>Próximo Mês</span>
                        <span className="text-emerald-700">+ R$ 1.820,00</span>
                      </div>
                      <p className="mt-1 text-2xs text-emerald-800">Contas e receitas totalmente cobertas.</p>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                      <div className="flex justify-between font-semibold text-emerald-950">
                        <span>Em 60 Dias</span>
                        <span className="text-emerald-700">+ R$ 640,00</span>
                      </div>
                      <p className="mt-1 text-2xs text-emerald-800">Término da parcela do seguro auto.</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <div className="flex justify-between font-semibold text-amber-950">
                        <span>Em 90 Dias (Alerta)</span>
                        <span className="text-amber-700">− R$ 420,00</span>
                      </div>
                      <p className="mt-1 text-2xs text-amber-800 font-medium">⚠️ IPVA previsto. Ajuste sugerido em compras não essenciais.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 CORE PILLARS SECTION */}
      <section className="border-y border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
              O que você conquista com o Conta Comigo
            </h2>
            <p className="mt-2 text-neutral-600 text-sm sm:text-base">
              Desenvolvido com fundamentação técnica e jurídica para transformar ansiedade financeira em clareza absoluta.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {/* Feature 1 */}
            <div className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-6 shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-[color:var(--color-brand-700)]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-bold text-neutral-900">
                1. O mês que não fecha aparece antes de chegar
              </h3>
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                A maioria das pessoas só descobre que o dinheiro acabou no dia 25. Com nossa projeção contínua de 3 a 12 meses, você identifica o déficit com antecedência suficiente para cortar despesas ou negociar antes de entrar no cheque especial.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-6 shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-bold text-neutral-900">
                2. Proteção Legal ao Superendividamento (Lei 14.181/2021)
              </h3>
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                O único aplicativo que calcula o seu <strong>Mínimo Existencial</strong> (Decreto nº 11.567/2023) e emite um Dossiê Técnico fundamentado para você apresentar no Procon ou Defensoria Pública para repactuar todas as suas dívidas em até 5 anos.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-6 shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-bold text-neutral-900">
                3. Gestão Familiar & Casal Colaborativo
              </h3>
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                Divida despesas compartilhadas sem atrito. Convide cônjuge ou familiares com permissões granulares: cada um pode manter seus gastos pessoais privados enquanto a soma das despesas da residência é gerenciada em conjunto.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-6 shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-bold text-neutral-900">
                4. Simulador de Decisões e Runway de Caixa
              </h3>
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                Pergunte ao seu orçamento antes de passar o cartão: &quot;E se eu parcelar essa viagem em 10 vezes?&quot; ou &quot;E se minha renda diminuir 20%?&quot;. Veja o impacto exato nos meses seguintes antes de assumir o compromisso.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE: SPREADSHEET VS CONTA COMIGO */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Por que trocar planilhas pelo Conta Comigo?
          </h2>
          <p className="mt-2 text-neutral-600 text-sm sm:text-base">
            Planilhas exigem manutenção manual cansativa e não entendem a separação entre competência e caixa.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[color:var(--card-border)] bg-white shadow-2xs">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80">
                <th className="p-4 font-semibold text-neutral-700">Situação Financeira</th>
                <th className="p-4 font-semibold text-neutral-500 w-1/3">Planilha Tradicional / Outros Apps</th>
                <th className="p-4 font-bold text-[color:var(--color-brand-700)] w-1/3 bg-cyan-50/40">Conta Comigo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <tr>
                <td className="p-4 font-medium text-neutral-900">Previsão de Meses Futuros</td>
                <td className="p-4 text-neutral-500 text-xs">Apenas olha o passado (&quot;onde gastei&quot;)</td>
                <td className="p-4 text-emerald-700 text-xs font-semibold bg-cyan-50/20">Projeção de 3 a 12 meses à frente com alertas</td>
              </tr>
              <tr>
                <td className="p-4 font-medium text-neutral-900">Cartão de Crédito Parcelado</td>
                <td className="p-4 text-neutral-500 text-xs">Duplica a despesa na fatura ou perde o controle</td>
                <td className="p-4 text-emerald-700 text-xs font-semibold bg-cyan-50/20">Separa o mês da compra do desembolso mensal</td>
              </tr>
              <tr>
                <td className="p-4 font-medium text-neutral-900">Proteção ao Superendividamento</td>
                <td className="p-4 text-neutral-500 text-xs">Inexistente (nenhum suporte legal)</td>
                <td className="p-4 text-emerald-700 text-xs font-semibold bg-cyan-50/20">Cálculo de Mínimo Existencial & Dossiê para o Procon</td>
              </tr>
              <tr>
                <td className="p-4 font-medium text-neutral-900">Saldo Disponível Real</td>
                <td className="p-4 text-neutral-500 text-xs">Mistura reservas de emergência com saldo livre</td>
                <td className="p-4 text-emerald-700 text-xs font-semibold bg-cyan-50/20">Mostra Saldo Total vs Saldo Livre p/ Gastar</td>
              </tr>
              <tr>
                <td className="p-4 font-medium text-neutral-900">Uso Compartilhado Familiar</td>
                <td className="p-4 text-neutral-500 text-xs">Confuso, sobrescreve fórmulas e expõe tudo</td>
                <td className="p-4 text-emerald-700 text-xs font-semibold bg-cyan-50/20">Contas conjuntas com permissões de privacidade</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)]">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">
            As perguntas que o aplicativo responde
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {QUESTIONS.map((question) => (
              <li
                key={question}
                className="rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4 shadow-2xs font-medium text-neutral-800"
              >
                {question}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">
          O mês que não fecha aparece antes de chegar
        </h2>
        <p className="mt-3 max-w-2xl" style={{ color: "var(--muted-fg)" }}>
          A maior parte dos apertos não é surpresa: é a soma de compromissos que já existiam. A
          projeção mensal mostra receitas previstas e compromissos assumidos lado a lado, e destaca
          o primeiro mês em que as contas não fecham.
        </p>

        <div
          role="region"
          aria-label="Exemplo de projeção mensal"
          tabIndex={0}
          className="mt-6 overflow-x-auto"
        >
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="sr-only">Exemplo de projeção mensal</caption>
            <thead>
              <tr className="border-b border-[color:var(--card-border)] text-left">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Mês
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Receitas
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Compromissos
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Sobra
                </th>
              </tr>
            </thead>
            <tbody className="tabular">
              <tr className="border-b border-[color:var(--card-border)]">
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                  Setembro
                </th>
                <td className="py-2.5 pr-4 text-right">R$ 8.000,00</td>
                <td className="py-2.5 pr-4 text-right">R$ 6.200,00</td>
                <td className="py-2.5 text-right text-[color:var(--color-positive-700)]">
                  R$ 1.800,00
                </td>
              </tr>
              <tr className="border-b border-[color:var(--card-border)]">
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                  Outubro
                </th>
                <td className="py-2.5 pr-4 text-right">R$ 8.000,00</td>
                <td className="py-2.5 pr-4 text-right">R$ 7.400,00</td>
                <td className="py-2.5 text-right text-[color:var(--color-positive-700)]">
                  R$ 600,00
                </td>
              </tr>
              <tr className="border-b border-[color:var(--card-border)] bg-[color:var(--color-attention-100)]">
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                  Novembro
                </th>
                <td className="py-2.5 pr-4 text-right">R$ 8.000,00</td>
                <td className="py-2.5 pr-4 text-right">R$ 8.700,00</td>
                <td className="py-2.5 text-right text-[color:var(--color-critical-700)]">
                  − R$ 700,00
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 max-w-2xl text-sm" style={{ color: "var(--muted-fg)" }}>
          Em agosto já dá para ver o problema de novembro. Três meses de antecedência costumam ser a
          diferença entre ajustar algo e recorrer a crédito caro.
        </p>
      </section>

      <section className="border-t border-[color:var(--card-border)]">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">
            Contas corretas, não apenas somadas
          </h2>
          <p className="mt-3 max-w-2xl" style={{ color: "var(--muted-fg)" }}>
            Muitos aplicativos tratam tudo como &quot;lançamento&quot;. Isso produz números que
            parecem certos e não são. Aqui, cada tipo de movimento tem o significado que realmente
            tem.
          </p>

          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title}>
                <dt className="font-semibold">{principle.title}</dt>
                <dd className="mt-1 text-sm" style={{ color: "var(--muted-fg)" }}>
                  {principle.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* SEO Topic Clusters / Educational Guides */}
      <section className="border-t border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)]">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Guias Práticos e Educação Financeira Gratuita
              </h2>
              <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--muted-fg)" }}>
                Aprenda a exercer seus direitos legais, estancar juros de dívidas e organizar as
                finanças da sua casa com os nossos conteúdos aprofundados.
              </p>
            </div>
            <Link
              href="/educacao-financeira"
              className="mt-3 text-sm font-medium text-[color:var(--color-brand-700)] hover:underline sm:mt-0"
            >
              Ver todos os guias &rarr;
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {GUIDES.map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="group flex flex-col justify-between rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-5 transition-all hover:border-[color:var(--color-brand-600)] hover:shadow-sm"
              >
                <div>
                  <span className="inline-block rounded bg-[color:var(--color-brand-50)] px-2 py-0.5 text-xs font-medium text-[color:var(--color-brand-700)]">
                    {guide.tag}
                  </span>
                  <h3 className="mt-2 text-base font-semibold group-hover:text-[color:var(--color-brand-600)]">
                    {guide.title}
                  </h3>
                  <p className="mt-1.5 text-sm" style={{ color: "var(--muted-fg)" }}>
                    {guide.description}
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center text-xs font-semibold text-[color:var(--color-brand-600)]">
                  Ler guia completo &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions (FAQ) Section */}
      <section className="border-t border-[color:var(--card-border)]">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">
            Perguntas Frequentes sobre Finanças e Superendividamento
          </h2>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--muted-fg)" }}>
            Respostas diretas para as dúvidas mais comuns de quem quer organizar a vida financeira.
          </p>

          <div className="mt-8 grid gap-4">
            {HOME_FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-5 open:bg-[color:var(--color-surface-sunken)]"
              >
                <summary className="flex cursor-pointer items-center justify-between font-semibold text-base">
                  <span>{faq.question}</span>
                  <span className="ml-4 text-xl text-[color:var(--muted-fg)] transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted-fg)" }}>
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)]">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Sem sermão, sem culpa</h2>
          <p className="mt-3" style={{ color: "var(--muted-fg)" }}>
            Quem está endividado ou perdido nas contas normalmente já sabe disso. O que falta é
            informação clara. O Conta comigo apresenta fatos e consequências, e deixa a decisão com
            você.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/criar-conta"
              className="inline-flex min-h-12 items-center rounded-lg bg-[color:var(--color-brand-600)] px-6 font-medium text-white shadow-sm hover:bg-[color:var(--color-brand-700)]"
            >
              Criar conta gratuita
            </Link>
            <Link
              href="/contato"
              className="inline-flex min-h-12 items-center rounded-lg border border-[color:var(--card-border)] bg-white px-6 font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Fale conosco ou tire dúvidas
            </Link>
          </div>
          <p className="mt-4 text-xs text-neutral-500">
            Dúvidas diretas com o criador (Paulo Roberto)? WhatsApp:{" "}
            <a
              href="https://wa.me/5567992753760"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-700 font-semibold hover:underline"
            >
              (67) 99275-3760
            </a>{" "}
            • E-mail:{" "}
            <a
              href="mailto:prmontefusco@gmail.com"
              className="text-teal-700 font-semibold hover:underline"
            >
              prmontefusco@gmail.com
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
