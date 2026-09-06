import Link from "next/link";
import type { Metadata } from "next";
import { FREE_LIMITS, PREMIUM_LIMITS } from "@/modules/billing/domain/plan-limits";
import { TRIAL_DAYS } from "@/modules/billing/domain/subscription";
import { PricingCards } from "./pricing-cards";

export const metadata: Metadata = {
  title: "Planos e Assinatura",
  // Sem preço aqui de propósito: o valor vem do servidor (ADR 0010), e um
  // número escrito à mão na metadata seria a primeira coisa a ficar velha.
  description:
    "O plano gratuito é completo para quem está endividado: modo emergência, cálculo de multa e juros, calculadora de acordo e roteiros de negociação. O Premium acrescenta projeção longa, leitura de documentos por IA e o painel da família.",
  alternates: { canonical: "/planos" },
};

export default function PlanosPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      {/* Hero Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/80 px-3.5 py-1 text-xs font-semibold text-teal-800 shadow-2xs">
          <span>✨</span>
          <span>Toda conta nova começa com {TRIAL_DAYS} dias de Premium</span>
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Quem está endividado não deveria precisar pagar para ver a saída.
        </h1>

        <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
          Por isso o plano gratuito não é uma amostra: ele tem o modo emergência, o cálculo de
          quanto o atraso custa por dia, a calculadora de acordo e os roteiros de negociação — para
          sempre, sem limite de contas. O Premium é para quem quer organizar com mais folga.
        </p>
      </div>

      {/* Componente Interativo com Seletor e Cards */}
      <div className="mt-12">
        <PricingCards />
      </div>

      {/* Selo de Garantia e Confiança */}
      <div className="mt-16 rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-xs backdrop-blur-sm sm:p-8">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xl text-teal-700">
              🛡️
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{TRIAL_DAYS} dias sem cartão</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                O teste começa sozinho quando você cria a conta e não pede dados de pagamento. Se
                não assinar depois, a conta continua funcionando no plano gratuito — nada é apagado.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xl text-teal-700">
              🔒
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Sem anúncios, sem repasse</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Não há publicidade em nenhuma tela e seus dados não são vendidos nem compartilhados.
                O tráfego é criptografado e o banco guarda tudo criptografado em repouso — não é
                ponta a ponta, e a gente prefere dizer isso do que exagerar.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xl text-teal-700">
              ⚡
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Pagamento avulso</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Cada pagamento vale por um período e acaba nele. Não há cobrança recorrente, não há
                cartão guardado e não há renovação para cancelar depois.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ - Perguntas Frequentes */}
      <div className="mt-16">
        <h2 className="text-center text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Perguntas Frequentes
        </h2>
        <p className="mt-2 text-center text-xs text-slate-500">
          Tudo o que você precisa saber antes de começar.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            {
              q: `Como funcionam os ${TRIAL_DAYS} dias grátis?`,
              a: `Ao criar a conta você entra automaticamente no Premium por ${TRIAL_DAYS} dias, sem informar cartão. Quando o período acaba, a conta passa para o plano gratuito e continua funcionando: nada é apagado e nenhuma cobrança acontece sozinha.`,
            },
            {
              q: "Preciso cancelar alguma coisa depois?",
              a: "Não. O pagamento aqui é avulso: cada compra vale por um período e termina nele. Não guardamos cartão, não há assinatura recorrente e não existe renovação automática para cancelar.",
            },
            {
              q: "O plano gratuito é limitado de verdade?",
              a: `Nas comodidades, sim: a projeção mostra ${FREE_LIMITS.forecastMonths} meses em vez de ${PREMIUM_LIMITS.forecastMonths}, cabem ${FREE_LIMITS.members} pessoas no grupo e ${FREE_LIMITS.creditCards} cartões, e o cadastro é digitado. No que ajuda alguém a sair da dívida, não: contas e dívidas sem limite de quantidade, modo emergência, cálculo de multa e mora, calculadora de acordo e roteiros de negociação ficam liberados para sempre.`,
            },
            {
              q: "Estou no vermelho. Vale pagar por um aplicativo?",
              a: "Provavelmente não agora — e o gratuito foi feito exatamente para isso. Use o modo emergência e a tela de negociação sem pagar nada. Se o Premium fizer sentido mais adiante, ele vai estar aqui.",
            },
            {
              q: "Minha família pode usar a mesma conta?",
              a: `Pode. Cada pessoa cria o próprio acesso e entra no mesmo grupo familiar, vendo os mesmos números. O gratuito comporta ${FREE_LIMITS.members} pessoas; o Premium, até ${PREMIUM_LIMITS.members}.`,
            },
            {
              q: "Vocês negociam minhas dívidas por mim?",
              a: "Não, e não temos relação com nenhum credor. O que fazemos é calcular quanto cabe no seu mês antes da ligação e dar o roteiro do que dizer. A conversa e a decisão continuam sendo suas.",
            },
          ].map((item) => (
            <div
              key={item.q}
              className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-2xs"
            >
              <h3 className="text-sm font-semibold text-slate-900">{item.q}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chamada Final */}
      <div className="mt-16 text-center">
        <h3 className="text-lg font-semibold text-slate-900">
          O primeiro passo é ver o tamanho real do problema.
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Leva menos de um minuto para criar a conta, e você pode cadastrar as contas aos poucos.
        </p>
        <div className="mt-5">
          <Link
            href="/criar-conta"
            className="inline-flex min-h-12 items-center rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-8 font-semibold text-white shadow-sm transition-all hover:from-teal-700 hover:to-cyan-700 hover:shadow-md"
          >
            Criar minha conta
          </Link>
        </div>
      </div>
    </div>
  );
}
