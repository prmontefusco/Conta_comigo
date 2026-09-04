"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Callout, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { formatMoney } from "@/core/money/format";
import {
  daysUntilExpiry,
  isWithinRenewalWindow,
  RENEWAL_WINDOW_DAYS,
} from "@/modules/billing/domain/subscription";
import { useSession } from "@/modules/household/ui/session-provider";

/**
 * Assinatura.
 *
 * O tom segue o do resto do produto: fatos e consequências, sem pressa
 * fabricada. Não há contagem regressiva nem "oferta por tempo limitado", e o
 * plano gratuito não é apresentado como um defeito — ele continua completo.
 *
 * Nada nesta tela concede plano. Ela abre uma cobrança e mostra como pagá-la; a
 * ativação vem sempre de uma confirmação que o servidor lê no provedor.
 */

type Cycle = "MONTHLY" | "YEARLY";
type Method = "PIX" | "CARD";

interface PlanRow {
  readonly cycle: Cycle;
  readonly label: string;
  readonly amountCents: number;
  readonly currency: string;
}

interface PlansResponse {
  readonly open: boolean;
  readonly plans: readonly PlanRow[];
  readonly yearlySavingPerMonthCents: number | null;
}

interface PixResult {
  readonly method: "PIX";
  readonly pixCopyPaste: string;
  readonly qrCodeImage: string | null;
  readonly amountCents: number;
}

const brl = (cents: number): string => formatMoney({ amount: cents, currency: "BRL" });

export default function SubscriptionPage() {
  const { user, subscription, isPremium, refreshProfile } = useSession();

  const [catalogue, setCatalogue] = useState<PlansResponse | null>(null);
  const [cycle, setCycle] = useState<Cycle>("YEARLY");
  const [pix, setPix] = useState<PixResult | null>(null);
  const [busy, setBusy] = useState<Method | "CHECK" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // O aviso carrega o próprio tom: "pagamento confirmado" e "ainda não
  // recebemos a confirmação" não podem sair no mesmo verde.
  const [notice, setNotice] = useState<{ tone: "positive" | "info"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/assinatura/planos")
      .then((response) => response.json() as Promise<PlansResponse>)
      .then((data) => {
        if (!active) return;
        setCatalogue(data);
        // Se só um ciclo estiver à venda, é ele que fica selecionado.
        const first = data.plans[0];
        if (first && !data.plans.some((plan) => plan.cycle === "YEARLY")) {
          setCycle(first.cycle);
        }
      })
      .catch(() => {
        // Falhar fechado: sem catálogo, nada é oferecido.
        if (active) setCatalogue({ open: false, plans: [], yearlySavingPerMonthCents: null });
      });

    return () => {
      active = false;
    };
  }, []);

  const authorizedFetch = useCallback(
    async (path: string, body?: unknown) => {
      if (!user) throw new Error("Sessão ausente.");
      const token = await user.getIdToken();

      return fetch(path, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    },
    [user],
  );

  async function startCheckout(method: Method) {
    setBusy(method);
    setError(null);
    setNotice(null);
    setPix(null);

    try {
      const response = await authorizedFetch("/api/assinatura/checkout", { cycle, method });
      const data: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof data === "object" && data !== null && "message" in data
            ? String((data as { message: unknown }).message)
            : "Não foi possível iniciar o pagamento agora.";
        setError(message);
        return;
      }

      if (method === "PIX") {
        setPix(data as PixResult);
        setCopied(false);
        return;
      }

      // O cartão é digitado no ambiente do provedor. Nenhum dado de cartão passa
      // por este aplicativo nem chega ao nosso servidor.
      const url = (data as { invoiceUrl?: string }).invoiceUrl;
      if (url) window.location.href = url;
      else setError("O provedor não devolveu o endereço de pagamento.");
    } catch {
      setError("Não foi possível falar com o servidor. Verifique sua conexão.");
    } finally {
      setBusy(null);
    }
  }

  async function checkPayment() {
    setBusy("CHECK");
    setError(null);
    setNotice(null);

    try {
      const response = await authorizedFetch("/api/assinatura/reconciliar");
      const data = (await response.json()) as { activated?: boolean; reason?: string };

      if (data.activated) {
        await refreshProfile();
        setPix(null);
        setNotice({ tone: "positive", text: "Pagamento confirmado. Seu plano está ativo." });
      } else if (data.reason === "NO_PENDING_PAYMENT") {
        setNotice({ tone: "info", text: "Não há nenhum pagamento aberto no momento." });
      } else {
        setNotice({
          tone: "info",
          text: "Ainda não recebemos a confirmação. Se você acabou de pagar, tente de novo em alguns instantes.",
        });
      }
    } catch {
      setError("Não foi possível verificar o pagamento agora.");
    } finally {
      setBusy(null);
    }
  }

  async function copyPix(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
      setError("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  }

  if (!catalogue) return <Spinner label="Carregando planos" />;

  const remainingDays = daysUntilExpiry(subscription);
  const selected = catalogue.plans.find((plan) => plan.cycle === cycle);
  const saving = catalogue.yearlySavingPerMonthCents;

  // Quem já pagou só vê a compra de novo quando ela faz sentido: perto do fim.
  const renewing = isWithinRenewalWindow(subscription);
  const canBuy = catalogue.open && (!isPremium || renewing);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Assinatura</h1>

      {notice ? <Callout tone={notice.tone}>{notice.text}</Callout> : null}
      {error ? <Callout tone="critical">{error}</Callout> : null}

      {!isPremium ? (
        <div className="rounded-2xl border border-teal-200/80 bg-teal-50/70 p-4 shadow-2xs backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-base">✨</span>
            <p className="text-sm font-semibold text-teal-900">
              Aproveite 30 dias grátis de teste do Plano Premium
            </p>
          </div>
          <p className="mt-1 text-xs text-teal-700">
            Apenas R$ 7,99/mês ou R$ 69,99/ano (menos de R$ 5,83/mês no plano anual). Cancele quando
            quiser.
          </p>
        </div>
      ) : null}

      <Card>
        <CardTitle>Seu plano</CardTitle>
        <p className="text-sm">
          <span className="font-medium">{isPremium ? "Premium" : "Gratuito"}</span>
          {isPremium && remainingDays !== null ? (
            <span style={{ color: "var(--muted-fg)" }}>
              {" — "}
              {remainingDays} {remainingDays === 1 ? "dia restante" : "dias restantes"}
            </span>
          ) : null}
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-fg)" }}>
          {isPremium
            ? "Você não vê anúncios e tem acesso irrestrito ao leitor com IA e projeções completas."
            : "Você está no plano gratuito. O Premium libera motor de projeção de 12 meses, leitor inteligente de faturas e remove todos os anúncios."}
        </p>
      </Card>

      {canBuy ? (
        <>
          {renewing ? (
            <Callout tone="info">
              Ao renovar agora, os dias que ainda faltam são somados ao novo período. Você não perde
              nada por renovar antes do fim.
            </Callout>
          ) : null}

          <Card>
            <CardTitle hint={saving ? `No anual, ${brl(saving)} a menos por mês` : undefined}>
              Escolha o período
            </CardTitle>
            <fieldset className="space-y-2">
              <legend className="sr-only">Período da assinatura</legend>
              {catalogue.plans.map((plan) => (
                <label
                  key={plan.cycle}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3"
                  style={{
                    borderColor:
                      cycle === plan.cycle ? "var(--color-brand-500)" : "var(--card-border)",
                  }}
                >
                  <input
                    type="radio"
                    name="cycle"
                    value={plan.cycle}
                    checked={cycle === plan.cycle}
                    onChange={() => setCycle(plan.cycle)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1">
                    <span className="font-medium">{plan.label}</span>
                    {plan.cycle === "YEARLY" ? (
                      <span className="block text-xs" style={{ color: "var(--muted-fg)" }}>
                        {brl(Math.round(plan.amountCents / 12))} por mês, pagos de uma vez
                      </span>
                    ) : null}
                  </span>
                  <span className="font-semibold">{brl(plan.amountCents)}</span>
                </label>
              ))}
            </fieldset>
          </Card>

          <Card>
            <CardTitle hint={selected ? brl(selected.amountCents) : undefined}>
              {renewing ? "Como renovar" : "Como pagar"}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void startCheckout("PIX")} disabled={busy !== null}>
                {busy === "PIX" ? "Gerando Pix…" : "Pagar com Pix"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => void startCheckout("CARD")}
                disabled={busy !== null}
              >
                {busy === "CARD" ? "Abrindo…" : "Pagar com cartão"}
              </Button>
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--muted-fg)" }}>
              Os dados do cartão são digitados no ambiente do provedor de pagamento. Eles não passam
              por este aplicativo e não ficam guardados aqui.
            </p>
          </Card>
        </>
      ) : catalogue.open ? (
        <Card>
          <CardTitle>Renovação</CardTitle>
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Seu plano está ativo e nada será cobrado automaticamente. A renovação abre nos últimos{" "}
            {RENEWAL_WINDOW_DAYS} dias antes do vencimento.
          </p>
        </Card>
      ) : (
        <Card>
          <CardTitle>Ainda não disponível</CardTitle>
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            A assinatura ainda não está aberta para contratação. Isso não muda nada no seu uso: o
            planejamento continua completo no plano gratuito.
          </p>
        </Card>
      )}

      {pix ? (
        <Card>
          <CardTitle hint={brl(pix.amountCents)}>Pix copia e cola</CardTitle>
          {pix.qrCodeImage ? (
            /* eslint-disable-next-line @next/next/no-img-element -- data URI do provedor, sem host externo */
            <img
              src={`data:image/png;base64,${pix.qrCodeImage}`}
              alt="QR Code para pagamento por Pix"
              className="mx-auto mb-3 h-48 w-48"
            />
          ) : null}
          <p
            className="rounded-lg p-3 font-mono text-xs break-all"
            style={{ background: "var(--muted-bg)" }}
          >
            {pix.pixCopyPaste}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void copyPix(pix.pixCopyPaste)}>
              {copied ? "Código copiado" : "Copiar código"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void checkPayment()}
              disabled={busy !== null}
            >
              {busy === "CHECK" ? "Verificando…" : "Já paguei"}
            </Button>
          </div>
        </Card>
      ) : subscription?.status === "PENDING" ? (
        <Card>
          <CardTitle>Pagamento em aberto</CardTitle>
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Existe uma cobrança aguardando confirmação. Se você já pagou, verifique agora.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => void checkPayment()}
            disabled={busy !== null}
          >
            {busy === "CHECK" ? "Verificando…" : "Já paguei"}
          </Button>
        </Card>
      ) : null}

      <Card>
        <CardTitle>O que muda com o Premium</CardTitle>
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          O Premium remove os anúncios. Nenhuma função de planejamento fica atrás do pagamento: o
          orçamento, a projeção e os relatórios são os mesmos nos dois planos.
        </p>
      </Card>
    </div>
  );
}
