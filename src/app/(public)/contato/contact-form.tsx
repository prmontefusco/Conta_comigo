"use client";

import { useState } from "react";

export function ContactForm() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [assunto, setAssunto] = useState("Dúvida sobre o aplicativo");
  const [mensagem, setMensagem] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // Máscara de telefone
  function handleTelefoneChange(value: string) {
    const raw = value.replace(/\D/g, "");
    if (raw.length <= 10) {
      setTelefone(
        raw.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2")
      );
    } else {
      setTelefone(
        raw
          .slice(0, 11)
          .replace(/^(\d{2})(\d)/, "($1) $2")
          .replace(/(\d{5})(\d)/, "$1-$2")
      );
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !mensagem.trim()) {
      alert("Por favor, preencha nome, e-mail e mensagem.");
      return;
    }

    setSubmitting(true);
    // Simula o registro e processamento do formulário
    setTimeout(() => {
      setSubmitting(false);
      setEnviado(true);
    }, 600);
  }

  const whatsappMessageText = encodeURIComponent(
    `*Contato via Conta Comigo*\n` +
      `*Nome:* ${nome || "Não informado"}\n` +
      `*E-mail:* ${email || "Não informado"}\n` +
      `*Telefone:* ${telefone || "Não informado"}\n` +
      `*Assunto:* ${assunto}\n\n` +
      `*Mensagem:*\n${mensagem}`
  );

  const whatsappUrl = `https://wa.me/5567992753760?text=${whatsappMessageText}`;
  const mailtoUrl = `mailto:prmontefusco@gmail.com?subject=${encodeURIComponent(
    `[Conta Comigo] ${assunto} - ${nome}`
  )}&body=${encodeURIComponent(
    `Nome: ${nome}\nE-mail: ${email}\nTelefone: ${telefone}\nAssunto: ${assunto}\n\nMensagem:\n${mensagem}`
  )}`;

  if (enviado) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 sm:p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
          ✅
        </div>
        <h3 className="mt-4 text-xl font-bold text-emerald-950">
          Mensagem Recebida com Sucesso!
        </h3>
        <p className="mt-2 text-sm text-emerald-800 leading-relaxed max-w-lg mx-auto">
          Obrigado, <strong>{nome}</strong>! Sua solicitação referente a &quot;{assunto}&quot; foi
          registrada. Paulo Roberto entrará em contato com você pelo e-mail <strong>{email}</strong>
          {telefone ? ` ou pelo WhatsApp ${telefone}` : ""}.
        </p>

        <div className="mt-6 border-t border-emerald-200 pt-6">
          <p className="text-xs font-semibold text-emerald-900 mb-3">
            Precisa de resposta urgente? Você também pode enviar agora direto para o WhatsApp:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
            >
              <span>Conversar no WhatsApp agora ➔</span>
            </a>
            <button
              type="button"
              onClick={() => {
                setEnviado(false);
                setMensagem("");
              }}
              className="inline-flex items-center rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
            >
              Enviar outra mensagem
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-6 sm:p-8 shadow-xs space-y-4"
    >
      <div className="border-b border-neutral-100 pb-4">
        <h2 className="text-lg font-bold text-neutral-900">Envie sua Mensagem</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Preencha o formulário abaixo e entraremos em contato o mais breve possível.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nome" className="block text-xs font-semibold text-neutral-700">
            Nome Completo *
          </label>
          <input
            id="nome"
            type="text"
            required
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-2xs focus:border-[color:var(--color-brand-600)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-600)]"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-neutral-700">
            E-mail para Retorno *
          </label>
          <input
            id="email"
            type="email"
            required
            placeholder="seu.email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-2xs focus:border-[color:var(--color-brand-600)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-600)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="telefone" className="block text-xs font-semibold text-neutral-700">
            Telefone / WhatsApp
          </label>
          <input
            id="telefone"
            type="tel"
            placeholder="(67) 99999-9999"
            value={telefone}
            onChange={(e) => handleTelefoneChange(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-2xs focus:border-[color:var(--color-brand-600)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-600)]"
          />
        </div>

        <div>
          <label htmlFor="assunto" className="block text-xs font-semibold text-neutral-700">
            Assunto Principal *
          </label>
          <select
            id="assunto"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-2xs focus:border-[color:var(--color-brand-600)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-600)]"
          >
            <option value="Dúvida sobre o aplicativo">Dúvida sobre o aplicativo</option>
            <option value="Superendividamento (Lei 14.181/2021)">
              Superendividamento (Lei 14.181/2021)
            </option>
            <option value="Ajuda com Dossiê para Procon/Justiça">
              Ajuda com Dossiê para Procon/Justiça
            </option>
            <option value="Sugestão de funcionalidade">Sugestão de funcionalidade</option>
            <option value="Parceria ou Imprensa">Parceria ou Imprensa</option>
            <option value="Outro assunto">Outro assunto</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="mensagem" className="block text-xs font-semibold text-neutral-700">
          Mensagem ou Dúvida *
        </label>
        <textarea
          id="mensagem"
          required
          rows={5}
          placeholder="Descreva detalhadamente como podemos te ajudar..."
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-2xs focus:border-[color:var(--color-brand-600)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-600)]"
        />
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-[color:var(--color-brand-600)] px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[color:var(--color-brand-700)] disabled:opacity-50"
        >
          {submitting ? "Enviando..." : "Enviar Mensagem pelo Site"}
        </button>

        {mensagem.trim().length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-2xs text-neutral-400">ou envie direto:</span>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
            >
              <span>WhatsApp</span>
            </a>
            <a
              href={mailtoUrl}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <span>E-mail</span>
            </a>
          </div>
        )}
      </div>
    </form>
  );
}
