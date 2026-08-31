import { NextResponse } from "next/server";
import { CYCLE_LABELS, yearlySavingPerMonth } from "@/modules/billing/domain/subscription";
import { isCheckoutOpen, planCatalogue } from "@/modules/billing/infrastructure/plan-config";

/**
 * Planos à venda.
 *
 * Preço é informação pública, então a rota não exige autenticação — pedir login
 * para ver quanto custa só afastaria quem ainda está decidindo.
 *
 * Existe uma única fonte de verdade: o mesmo catálogo que o checkout usa para
 * cobrar. Se o preço também viesse numa variável pública do cliente, as duas
 * poderiam divergir e a tela mostraria um valor diferente do cobrado.
 *
 * Quando não há preço configurado ou não há chave de provedor, a resposta diz
 * que a venda está fechada, em vez de exibir planos que ninguém consegue pagar.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const catalogue = planCatalogue();

  const plans = (["MONTHLY", "YEARLY"] as const)
    .map((cycle) => catalogue[cycle])
    .filter((option) => option !== undefined)
    .map((option) => ({
      cycle: option.cycle,
      label: CYCLE_LABELS[option.cycle],
      amountCents: option.price.amount,
      currency: option.price.currency,
    }));

  const saving = yearlySavingPerMonth(catalogue);

  return NextResponse.json({
    open: isCheckoutOpen(),
    plans,
    yearlySavingPerMonthCents: saving?.amount ?? null,
  });
}
