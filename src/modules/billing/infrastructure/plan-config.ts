import "server-only";

import {
  buildPlanCatalogue,
  isPlanCatalogueConfigured,
  type PlanCatalogue,
} from "@/modules/billing/domain/subscription";
import { isPaymentConfigured } from "@/modules/billing/infrastructure/asaas-gateway";

/**
 * Preços, lidos da configuração do ambiente.
 *
 * Ficam apenas no servidor. O navegador consulta os planos por
 * `GET /api/assinatura/planos`, de modo que existe **uma** fonte de verdade: se
 * o preço viesse também numa variável pública, as duas poderiam divergir e o
 * cliente exibiria um valor diferente do que seria cobrado.
 *
 * Definir em apphosting.yaml, em centavos inteiros:
 *   SUBSCRIPTION_PRICE_MONTHLY_CENTS: "500"    → R$ 5,00
 *   SUBSCRIPTION_PRICE_YEARLY_CENTS:  "5000"   → R$ 50,00
 *
 * Decisão registrada na ADR 0010 (docs/adr/0010-price-as-configuration.md).
 */
export function planCatalogue(): PlanCatalogue {
  return buildPlanCatalogue({
    monthly: process.env.SUBSCRIPTION_PRICE_MONTHLY_CENTS,
    yearly: process.env.SUBSCRIPTION_PRICE_YEARLY_CENTS,
  });
}

/**
 * A venda só abre quando há **o que** vender e **como** cobrar.
 *
 * Faltando qualquer um dos dois, a tela informa que a assinatura ainda não está
 * disponível, em vez de mostrar um botão que só pode falhar.
 */
export function isCheckoutOpen(): boolean {
  return isPlanCatalogueConfigured(planCatalogue()) && isPaymentConfigured();
}
