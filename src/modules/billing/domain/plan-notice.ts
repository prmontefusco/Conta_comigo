import type { PlanStatus } from "./plan-status";

/**
 * O aviso sobre o plano — e **só quando há o que fazer**.
 *
 * O modelo de referência (cvlivre) mostra uma faixa de status em toda tela
 * autenticada, o tempo todo. Aqui isso seria errado por dois motivos.
 *
 * O primeiro é de prioridade: a primeira coisa da tela inicial é "Atenção
 * agora" — conta vencida, mês que não fecha. Pôr um aviso sobre assinatura
 * acima disso inverte o que o produto considera urgente.
 *
 * O segundo é de tom. Um lembrete permanente de assinatura na tela de quem
 * está apertado é exatamente a pressão que este produto se recusa a fazer
 * (docs/PRODUCT.md, seção 12). O que sobra é o aviso com ação real: cobrança
 * em aberto, e-mail por confirmar, teste acabando, plano acabando.
 *
 * O texto mora aqui, e não no componente, pela mesma razão que as mensagens de
 * alerta moram em `alerts.ts`: é o que permite testá-lo sem montar React.
 */

export interface PlanNotice {
  readonly tone: "info" | "attention" | "positive";
  readonly title: string;
  readonly body: string;
  /** O rótulo do link que leva à tela de assinatura. */
  readonly action: string;
}

/** "3 dias" / "1 dia". Evita a concordância errada espalhada por três telas. */
export function formatDays(days: number): string {
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

/**
 * Escolhe o aviso, ou nenhum.
 *
 * `endDate` já vem formatada no fuso da casa: um plano que vence à meia-noite
 * de Brasília não pode aparecer com a data do dia seguinte.
 */
export function buildPlanNotice(status: PlanStatus, endDate: string | null): PlanNotice | null {
  // Vem primeiro de propósito: quem pagou e não viu o plano ativar precisa
  // desta porta, e ela é mais urgente que qualquer prazo.
  if (status.pendingCharge) {
    return {
      tone: "info",
      title: "Há um pagamento aguardando confirmação",
      body: "Se você já pagou, a confirmação costuma chegar em minutos. Dá para conferir agora.",
      action: "Verificar pagamento",
    };
  }

  if (status.kind === "TRIAL_PENDING_EMAIL") {
    return {
      tone: "info",
      title: "Confirme seu e-mail para liberar o período de teste",
      body: `Os ${status.trialTotalDays} dias de Premium ficam disponíveis assim que você abrir o link que enviamos.`,
      action: "Ver detalhes",
    };
  }

  if (status.kind === "TRIAL" && status.endingSoon && status.daysRemaining !== null) {
    return {
      tone: "info",
      title: `Seu período de teste termina em ${formatDays(status.daysRemaining)}`,
      body:
        (endDate ? `O Premium vale até ${endDate}. ` : "") +
        "Depois disso a conta passa para o plano gratuito e continua funcionando — nada é apagado e nada é cobrado sozinho.",
      action: "Ver o que muda",
    };
  }

  if (status.kind === "PAID" && status.endingSoon && status.daysRemaining !== null) {
    return {
      tone: "attention",
      title: `Seu plano ${status.cycleLabel?.toLowerCase() ?? "Premium"} termina em ${formatDays(
        status.daysRemaining,
      )}`,
      body:
        (endDate ? `Ele vale até ${endDate}. ` : "") +
        "Renovando agora, os dias que faltam são somados ao novo período.",
      action: "Renovar",
    };
  }

  return null;
}
