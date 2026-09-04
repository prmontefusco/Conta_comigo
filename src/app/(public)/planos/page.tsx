import Link from "next/link";
import type { Metadata } from "next";
import { PricingCards } from "./pricing-cards";

export const metadata: Metadata = {
  title: "Planos e Assinatura — 30 dias grátis | Conta comigo",
  description:
    "Organize suas finanças com tranquilidade. Teste 30 dias grátis. Apenas R$ 7,99 por mês ou R$ 69,99 por ano no plano anual. Sem fidelidade.",
  alternates: { canonical: "/planos" },
};

export default function PlanosPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      {/* Hero Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/80 px-3.5 py-1 text-xs font-semibold text-teal-800 shadow-2xs">
          <span>✨</span>
          <span>30 dias de teste gratuito em todos os planos Premium</span>
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Um investimento pequeno para uma tranquilidade sem preço.
        </h1>

        <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
          Sem letrinhas miúdas, sem pegadinhas e sem renovações escondidas. Experimente por 30 dias
          e comprove como a clareza financeira transforma sua rotina.
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
              <h3 className="text-sm font-semibold text-slate-900">30 Dias Sem Risco</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Aproveite todos os recursos avançados livremente. Se não amar a experiência, cancele
                a qualquer momento com um único clique.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xl text-teal-700">
              🔒
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Privacidade Sagrada</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Seus dados financeiros nunca serão vendidos para terceiros ou anunciantes.
                Criptografia bancária de ponta a ponta.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xl text-teal-700">
              ⚡
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Pix & Cartão Seguro</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Pagamentos processados com segurança máxima. No Pix, ativação imediata sem
                burocracia.
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
          <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-2xs">
            <h3 className="text-sm font-semibold text-slate-900">
              Como funcionam os 30 dias grátis?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Você cria sua conta e ganha 30 dias de acesso irrestrito a todos os recursos Premium,
              incluindo IA de leitura de documentos e projeção completa de 12 meses. Nada será
              cobrado durante o período de teste.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-2xs">
            <h3 className="text-sm font-semibold text-slate-900">
              Posso cancelar a qualquer momento?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Sim! Sem carência, sem contratos de longo prazo e sem burocracia. Você pode cancelar a
              renovação com 1 clique direto no menu de sua conta.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-2xs">
            <h3 className="text-sm font-semibold text-slate-900">
              Qual a vantagem do plano anual de R$ 69,99?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              O plano anual sai por <strong>R$ 69,99 por ano</strong>, o que equivale a apenas{" "}
              <strong>R$ 5,83 por mês</strong>. É uma economia de 27% em relação ao valor da
              mensalidade avulsa.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-2xs">
            <h3 className="text-sm font-semibold text-slate-900">
              Minha família pode usar a mesma assinatura?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Sim! O Conta comigo foi feito para famílias. Você pode convidar seu parceiro(a) ou
              outros membros da casa para visualizar e registrar contas juntos dentro do mesmo grupo
              familiar.
            </p>
          </div>
        </div>
      </div>

      {/* Chamada Final */}
      <div className="mt-16 text-center">
        <h3 className="text-lg font-semibold text-slate-900">
          Pronto para dar o primeiro passo rumo à tranquilidade?
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Crie sua conta em menos de 1 minuto e comece seu teste gratuito.
        </p>
        <div className="mt-5">
          <Link
            href="/criar-conta"
            className="inline-flex min-h-12 items-center rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-8 font-semibold text-white shadow-sm transition-all hover:from-teal-700 hover:to-cyan-700 hover:shadow-md"
          >
            Começar meus 30 dias grátis agora
          </Link>
        </div>
      </div>
    </div>
  );
}
