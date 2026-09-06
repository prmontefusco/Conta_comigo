"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMonthKey } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, money } from "@/core/money/money";
import { Badge, Callout, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { MoneyField, SelectField, TextField } from "@/components/ui/form";
import {
  URGENCY_LABELS,
  VERDICT_LABELS,
  advisePurchase,
  type InstallmentOffer,
  type PurchasePath,
  type PurchaseUrgency,
} from "@/modules/purchase-advisor/domain/purchase-advisor";
import { starterReserveStatus } from "@/modules/reserves/domain/starter-reserve";
import { useFinance } from "@/modules/household/ui/finance-provider";

/**
 * Antes de comprar.
 *
 * A tela não aprova nem reprova. Ela mostra os caminhos e o que cada um faz
 * com o mês e com o plano — inclusive os dois que loja nenhuma oferece:
 * esperar e comprar à vista, e consertar o que já existe.
 *
 * Nada aqui repreende. Quem chegou nesta tela está decidindo sobre uma
 * geladeira quebrada ou um celular que morreu, não pedindo permissão.
 */
export default function BuyAdvisorPage() {
  const finance = useFinance();

  const [urgency, setUrgency] = useState<PurchaseUrgency>("BROKEN_ESSENTIAL");
  const [what, setWhat] = useState("");
  const [cashText, setCashText] = useState("");
  const [lifespanText, setLifespanText] = useState("");
  const [repairText, setRepairText] = useState("");
  const [repairLifespanText, setRepairLifespanText] = useState("");
  const [serviceText, setServiceText] = useState("");

  const [installmentText, setInstallmentText] = useState("");
  const [installmentCount, setInstallmentCount] = useState("10");
  const [downText, setDownText] = useState("");

  if (finance.loading) return <Spinner label="Carregando seus números" />;

  const monthlyCapacity = averageMonthlyCapacity(finance);
  const reserve = starterReserveStatus(finance.reserves, monthlyOutflows(finance));

  const installmentAmount = fromDecimalString(installmentText);
  const count = Math.max(1, Number(installmentCount) || 1);
  const offers: InstallmentOffer[] =
    installmentAmount && installmentAmount.amount > 0
      ? [
          {
            id: "oferta",
            label: `${count}x de ${formatMoney(installmentAmount)}`,
            installmentAmount,
            installmentCount: count,
            ...(fromDecimalString(downText) ? { downPayment: fromDecimalString(downText)! } : {}),
          },
        ]
      : [];

  const advice = advisePurchase({
    asOf: finance.asOf,
    urgency,
    ...(fromDecimalString(cashText) ? { cashPrice: fromDecimalString(cashText)! } : {}),
    installmentOffers: offers,
    ...(fromDecimalString(repairText) ? { repairCost: fromDecimalString(repairText)! } : {}),
    ...(positiveInt(repairLifespanText)
      ? { repairLifespanMonths: positiveInt(repairLifespanText)! }
      : {}),
    ...(positiveInt(lifespanText) ? { newLifespanMonths: positiveInt(lifespanText)! } : {}),
    ...(fromDecimalString(serviceText)
      ? { serviceMonthlyCost: fromDecimalString(serviceText)! }
      : {}),
    availableCash: finance.totalCash,
    starterReserve: reserve,
    monthlyCapacity,
    forecast: finance.forecast,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Antes de comprar</h1>
        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
          O que cada forma de pagar faz com o seu mês e com o seu plano.
        </p>
      </div>

      <Callout tone="info">
        Esta tela não diz se você deve comprar. Ela mostra os caminhos com os números da sua casa —
        inclusive consertar e esperar, que loja nenhuma oferece. A escolha é sua, e o motivo dela
        pode ser um que nenhuma conta captura.
      </Callout>

      <Card>
        <CardTitle hint="Isto muda a leitura de tudo o que vem abaixo.">
          O que acontece se você não comprar agora
        </CardTitle>

        <div className="mt-3 max-w-md">
          <SelectField
            label="Situação"
            value={urgency}
            onChange={(event) => setUrgency(event.target.value as PurchaseUrgency)}
            options={Object.entries(URGENCY_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </Card>

      {advice.skipDeliberation ? (
        <Card>
          <CardTitle>Aqui não há o que simular</CardTitle>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-fg)" }}>
            Numa emergência familiar não existe &ldquo;vale a pena?&rdquo;. A pergunta útil é outra:
            como absorver esse gasto com o menor estrago. Isso significa decidir o que adiar neste
            mês, e há uma tela para exatamente isso.
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-fg)" }}>
            Sentimos muito pelo momento. Quando der, volte aqui para organizar o resto.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/app/emergencia"
              className="inline-flex min-h-10 items-center rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[color:var(--color-brand-700)]"
            >
              Ver o que pagar primeiro
            </Link>
            <Link
              href="/app/negociar"
              className="inline-flex min-h-10 items-center rounded-xl border border-[color:var(--card-border)] px-4 text-sm font-semibold transition hover:border-[color:var(--color-brand-600)]"
            >
              Pedir prazo aos credores
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <CardTitle hint="Preencha o que você souber. Cada campo abre um caminho a mais.">
              A compra
            </CardTitle>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <TextField
                label="O que é"
                value={what}
                onChange={(event) => setWhat(event.target.value)}
                placeholder="Máquina de lavar"
              />
              <MoneyField
                label="Preço à vista"
                value={cashText}
                onChange={(event) => setCashText(event.target.value)}
                hint="Se não souber, pergunte na loja: quase toda tem desconto à vista."
              />
              <TextField
                label="Quantos meses deve durar"
                type="number"
                min={1}
                value={lifespanText}
                onChange={(event) => setLifespanText(event.target.value)}
                placeholder="96"
                hint="Um chute honesto basta. É o que permite comparar com o conserto."
              />
            </div>

            <div className="mt-5 border-t border-[color:var(--card-border)] pt-4">
              <p className="text-2xs font-semibold tracking-wider uppercase">Se for parcelar</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <MoneyField
                  label="Valor da parcela"
                  value={installmentText}
                  onChange={(event) => setInstallmentText(event.target.value)}
                />
                <TextField
                  label="Quantas parcelas"
                  type="number"
                  min={1}
                  max={48}
                  value={installmentCount}
                  onChange={(event) => setInstallmentCount(event.target.value)}
                />
                <MoneyField
                  label="Entrada"
                  value={downText}
                  onChange={(event) => setDownText(event.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 border-t border-[color:var(--card-border)] pt-4">
              <p className="text-2xs font-semibold tracking-wider uppercase">
                Se der para consertar ou alugar
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <MoneyField
                  label="Custo do conserto"
                  value={repairText}
                  onChange={(event) => setRepairText(event.target.value)}
                />
                <TextField
                  label="Quantos meses o conserto segura"
                  type="number"
                  min={1}
                  value={repairLifespanText}
                  onChange={(event) => setRepairLifespanText(event.target.value)}
                  placeholder="12"
                />
                <MoneyField
                  label="Pagar pelo serviço, por mês"
                  value={serviceText}
                  onChange={(event) => setServiceText(event.target.value)}
                  hint="Lavanderia, aluguel."
                />
              </div>
            </div>
          </Card>

          {advice.paths.length === 0 ? (
            <Callout tone="info">
              Informe pelo menos um preço — à vista, parcelado ou o custo do conserto — para ver os
              caminhos.
            </Callout>
          ) : (
            <div className="space-y-3">
              {advice.nothingFits ? (
                <div
                  role="note"
                  className="rounded-2xl border p-4 sm:p-5"
                  style={{ borderColor: "var(--tone-attention)", background: "var(--card-bg)" }}
                >
                  <span
                    className="text-2xs rounded-md px-2 py-0.5 font-bold tracking-wider uppercase"
                    style={{
                      color: "var(--tone-attention)",
                      background: "var(--color-surface-sunken)",
                    }}
                  >
                    Nenhum caminho cabe hoje
                  </span>

                  <p className="mt-2.5 text-sm font-semibold">
                    Nenhuma das formas de pagar cabe no seu mês como ele está agora.
                  </p>

                  <p className="mt-2 text-sm" style={{ color: "var(--muted-fg)" }}>
                    Isso é aritmética, não descuido — e não significa que você tem que ficar sem.
                    Significa que a saída passa por mudar alguma coisa antes:{" "}
                    {advice.smallestUpfront ? (
                      <>
                        o menor desembolso da lista é {formatMoney(advice.smallestUpfront)}, e é
                        desse número que vale partir.
                      </>
                    ) : (
                      <>vale partir do caminho de menor desembolso da lista.</>
                    )}
                  </p>

                  <ul className="mt-3 space-y-1.5 text-sm" style={{ color: "var(--muted-fg)" }}>
                    <li>
                      <strong style={{ color: "var(--page-fg)" }}>Pedir prazo maior.</strong> Mais
                      parcelas custa mais no total, mas pode ser a diferença entre ter e não ter.
                      Com o número acima em mãos, dá para pedir a parcela que cabe, em vez de
                      aceitar a que ofereceram.
                    </li>
                    <li>
                      <strong style={{ color: "var(--page-fg)" }}>Abrir espaço no mês.</strong> Se
                      alguma conta puder ser adiada ou renegociada, a folga muda e esta tela muda
                      junto.
                    </li>
                    <li>
                      <strong style={{ color: "var(--page-fg)" }}>Usado ou emprestado.</strong> Nem
                      toda solução é uma compra nova. Um aparelho de segunda mão que segure alguns
                      meses às vezes é o caminho mais barato por mês de uso.
                    </li>
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/app/negociar"
                      className="inline-flex min-h-10 items-center rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[color:var(--color-brand-700)]"
                    >
                      Calcular a parcela que cabe
                    </Link>
                    <Link
                      href="/app/emergencia"
                      className="inline-flex min-h-10 items-center rounded-xl border border-[color:var(--card-border)] px-4 text-sm font-semibold transition hover:border-[color:var(--color-brand-600)]"
                    >
                      Abrir espaço no mês
                    </Link>
                  </div>
                </div>
              ) : null}

              {advice.paths.map((path) => (
                <PathCard
                  key={path.id}
                  path={path}
                  cheapestPerUse={path.id === advice.cheapestPerMonthOfUseId}
                />
              ))}
            </div>
          )}

          <Card>
            <CardTitle>Sobre esta análise</CardTitle>
            <ul className="mt-2 space-y-2 text-sm" style={{ color: "var(--muted-fg)" }}>
              <li>
                Os números saem do que você cadastrou e das estimativas que informou aqui. Vida útil
                de aparelho é palpite, não previsão — troque o número e veja a conta mudar.
              </li>
              <li>
                O Conta comigo é um apoio à sua decisão. Não vendemos nada, não indicamos loja,
                banco ou forma de crédito, e não temos relação com nenhum credor.
              </li>
              <li>
                <strong style={{ color: "var(--page-fg)" }}>
                  A decisão, a compra e o compromisso assumido são seus.
                </strong>{" "}
                O aplicativo não se responsabiliza por prejuízo, contrato, negociação ou dívida
                decorrente de escolhas feitas a partir destas informações. Confira sempre os valores
                e as condições com quem vai lhe vender.
              </li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function PathCard({ path, cheapestPerUse }: { path: PurchasePath; cheapestPerUse: boolean }) {
  const tone =
    path.verdict === "FITS"
      ? "positive"
      : path.verdict === "TIGHT"
        ? "attention"
        : ("critical" as const);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--card-border)] pb-3">
        <div>
          <h3 className="text-sm font-semibold">{path.label}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={tone}>{VERDICT_LABELS[path.verdict]}</Badge>
            {cheapestPerUse ? <Badge tone="positive">Menor custo por mês de uso</Badge> : null}
          </div>
        </div>

        <div className="text-right">
          {/* O total vem antes da parcela, sempre: o varejo inteiro é feito
              para a pessoa pensar em parcela, e quebrar isso é a função. */}
          <p className="tabular text-lg font-bold">{formatMoney(path.totalPaid)}</p>
          {path.kind === "SERVICE" ? (
            <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
              em {path.months} meses
            </p>
          ) : null}
          <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
            {subheading(path)}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-2xs font-medium" style={{ color: "var(--muted-fg)" }}>
            Sai hoje
          </dt>
          <dd className="tabular mt-0.5 text-sm font-semibold">{formatMoney(path.upfront)}</dd>
        </div>

        {path.costPerMonthOfUse ? (
          <div>
            <dt className="text-2xs font-medium" style={{ color: "var(--muted-fg)" }}>
              Por mês de uso
            </dt>
            <dd className="tabular mt-0.5 text-sm font-semibold">
              {formatMoney(path.costPerMonthOfUse)}
            </dd>
            {path.lifespanMonths ? (
              <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
                em {path.lifespanMonths} meses
              </p>
            ) : null}
          </div>
        ) : null}

        {path.impliedMonthlyRate !== null ? (
          <div>
            <dt className="text-2xs font-medium" style={{ color: "var(--muted-fg)" }}>
              Juro embutido
            </dt>
            <dd className="tabular mt-0.5 text-sm font-semibold">
              {path.impliedMonthlyRate.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              % ao mês
            </dd>
          </div>
        ) : null}

        {path.touchesStarterReserve ? (
          <div>
            <dt className="text-2xs font-medium" style={{ color: "var(--muted-fg)" }}>
              Reserva depois
            </dt>
            <dd
              className="tabular mt-0.5 text-sm font-semibold"
              style={{ color: "var(--tone-critical)" }}
            >
              {formatMoney(path.reserveAfter)}
            </dd>
          </div>
        ) : null}
      </dl>

      {path.flipsMonthIntoDeficit ? (
        <p
          className="mt-3 rounded-lg border p-3 text-sm font-semibold"
          style={{ borderColor: "var(--tone-critical)", color: "var(--tone-critical)" }}
        >
          Este é o caminho que tira o seu mês do azul.
        </p>
      ) : null}

      {path.notes.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-[color:var(--card-border)] pt-3">
          {path.notes.map((note) => (
            <li key={note} className="text-xs" style={{ color: "var(--muted-fg)" }}>
              {note}
            </li>
          ))}
        </ul>
      ) : null}

      {path.monthByMonth.length > 0 ? (
        <details className="mt-3 border-t border-[color:var(--card-border)] pt-3">
          <summary className="cursor-pointer text-xs font-medium">
            Mês a mês: onde essa parcela cabe
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[320px] text-xs">
              <thead>
                <tr style={{ color: "var(--muted-fg)" }}>
                  <th className="py-1 pr-3 text-left font-medium">Mês</th>
                  <th className="py-1 pr-3 text-right font-medium">Sobra do mês</th>
                  <th className="py-1 text-right font-medium">Depois da parcela</th>
                </tr>
              </thead>
              <tbody>
                {path.monthByMonth.map((fit) => (
                  <tr key={fit.month} className="border-t border-[color:var(--card-border)]">
                    <td className="py-1.5 pr-3">{formatMonthKey(fit.month)}</td>
                    <td className="tabular py-1.5 pr-3 text-right">{formatMoney(fit.capacity)}</td>
                    <td
                      className="tabular py-1.5 text-right font-medium"
                      style={{ color: fit.fits ? undefined : "var(--tone-critical)" }}
                    >
                      {formatMoney(fit.leftOver)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

/**
 * O que a linha embaixo do total diz, por tipo de caminho.
 *
 * "Nx de R$ Y" só descreve um parcelamento. Para a espera, esse Y é o quanto
 * se guarda por mês — dizer "1x de R$ 11.270,92" ao lado de um total de
 * R$ 9.800 é ruído. Para o serviço, é um custo que se repete, não uma parcela
 * que acaba.
 */
function subheading(path: PurchasePath): string {
  if (path.kind === "WAIT_AND_PAY_CASH" && path.monthlyAmount) {
    return `guardando ${formatMoney(path.monthlyAmount)} por mês`;
  }
  if (path.kind === "SERVICE" && path.monthlyAmount) {
    return `${formatMoney(path.monthlyAmount)} por mês, enquanto usar`;
  }
  if (path.monthlyAmount && path.months > 0) {
    return `${path.months}x de ${formatMoney(path.monthlyAmount)}`;
  }
  return "pagamento único";
}

function positiveInt(text: string): number | null {
  const value = Number(text);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** A mesma sobra média que a tela de negociação usa. */
function averageMonthlyCapacity(finance: ReturnType<typeof useFinance>) {
  const months = finance.forecast.months.filter((month) => !month.isPartial);
  if (months.length === 0) return money(0);

  const total = months.reduce(
    (sofar, month) => sofar + month.expectedInflows.amount - month.committedOutflows.amount,
    0,
  );
  return money(Math.round(total / months.length));
}

/** Gasto mensal médio, para dimensionar a reserva de partida. */
function monthlyOutflows(finance: ReturnType<typeof useFinance>) {
  const months = finance.forecast.months.filter((month) => !month.isPartial);
  if (months.length === 0) return money(0);

  const total = months.reduce((sofar, month) => sofar + month.committedOutflows.amount, 0);
  return money(Math.round(total / months.length));
}
