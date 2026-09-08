import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Entre em Contato — Fale com Paulo Roberto Montefusco | Conta comigo",
  description:
    "Entre em contato com o criador do Conta comigo por formulário, WhatsApp ou telefone (67 99275-3760). Tire dúvidas sobre o aplicativo ou a Lei do Superendividamento.",
  alternates: { canonical: "/contato" },
};

export default function ContatoPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 border border-cyan-200">
          Atendimento & Suporte
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Fale Conosco
        </h1>
        <p className="mt-3 text-base text-neutral-600 leading-relaxed">
          Tem alguma dúvida sobre as funcionalidades do aplicativo, quer entender melhor como aplicar a
          Lei do Superendividamento ou enviar uma sugestão? Estamos prontos para atender você.
        </p>
      </div>

      {/* Grid de Contato: Informações Diretas + Formulário */}
      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Coluna Esquerda: Informações Diretas */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-6 shadow-xs">
            <h2 className="text-lg font-bold text-neutral-900">Canais Diretos</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Você fala diretamente com o responsável e desenvolvedor do projeto:
            </p>

            <div className="mt-6 space-y-5">
              {/* Responsável */}
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 text-lg">
                  👤
                </div>
                <div>
                  <span className="text-2xs font-semibold uppercase tracking-wider text-neutral-400">
                    Responsável / Atendimento
                  </span>
                  <p className="text-sm font-bold text-neutral-900">Paulo Roberto Montefusco</p>
                  <p className="text-xs text-neutral-500">Criador da plataforma Conta comigo</p>
                </div>
              </div>

              {/* WhatsApp & Telefone */}
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 text-lg">
                  📱
                </div>
                <div>
                  <span className="text-2xs font-semibold uppercase tracking-wider text-neutral-400">
                    Telefone & WhatsApp
                  </span>
                  <p className="text-sm font-bold text-neutral-900">
                    <a
                      href="https://wa.me/5567992753760?text=Ol%C3%A1%2C%20Paulo!%20Gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20o%20Conta%20Comigo."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      (67) 99275-3760
                      <span className="text-2xs font-normal text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        WhatsApp
                      </span>
                    </a>
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Atendimento rápido para dúvidas e orientações
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href="https://wa.me/5567992753760?text=Ol%C3%A1%2C%20Paulo!%20Gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20o%20Conta%20Comigo."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-emerald-700"
                    >
                      <span>Abrir no WhatsApp ➔</span>
                    </a>
                    <a
                      href="tel:+5567992753760"
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Ligar
                    </a>
                  </div>
                </div>
              </div>

              {/* E-mail */}
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 text-lg">
                  ✉️
                </div>
                <div>
                  <span className="text-2xs font-semibold uppercase tracking-wider text-neutral-400">
                    E-mail Oficial
                  </span>
                  <p className="text-sm font-bold text-neutral-900">
                    <a
                      href="mailto:prmontefusco@gmail.com?subject=Contato%20via%20Conta%20Comigo"
                      className="hover:text-cyan-700 hover:underline break-all"
                    >
                      prmontefusco@gmail.com
                    </a>
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Respondemos geralmente em até 24 horas úteis
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card de Compromisso */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
              <span>🛡️</span> Privacidade e Segurança
            </h3>
            <p className="mt-2 text-xs text-teal-800 leading-relaxed">
              Respeitamos integralmente a Lei Geral de Proteção de Dados (LGPD). Seus dados de contato
              serão utilizados estritamente para responder à sua mensagem. Jamais compartilhamos ou
              vendemos suas informações.
            </p>
          </div>
        </div>

        {/* Coluna Direita: Formulário de Mensagem */}
        <div className="lg:col-span-7">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
