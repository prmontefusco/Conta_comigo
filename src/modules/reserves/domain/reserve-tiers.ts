import {
  type Money,
  greaterOrEqual,
  multiply,
  subtract,
  zero,
} from "@/core/money/money";

export interface CamadaLiquidez {
  readonly numero: 1 | 2 | 3;
  readonly nome: string;
  readonly liquidezDias: "D+0 (Imediato)" | "D+1 (1 dia útil)" | "D+30 (Estratégico)";
  readonly metaValor: Money;
  readonly valorAlocadoAtual: Money;
  readonly percentualConcluido: number;
  readonly ondeGuardar: string;
  readonly objetivo: string;
}

export interface EstruturaCamadasReserva {
  readonly custoMensalEssencial: Money;
  readonly totalReservaAtual: Money;
  readonly camada1Imediata: CamadaLiquidez;
  readonly camada2CurtoPrazo: CamadaLiquidez;
  readonly camada3Oportunidades: CamadaLiquidez;
}

/**
 * Aloca o montante total de reservas da família em 3 camadas de liquidez
 * proporcionalmente ao custo de vida essencial mensal.
 */
export function calcularCamadasReserva(
  custoMensalEssencial: Money,
  totalReservaAtual: Money,
): EstruturaCamadasReserva {
  const moeda = custoMensalEssencial.currency;

  // Camada 1: 1 mês de custo essencial (D+0)
  const metaC1 = custoMensalEssencial;
  // Camada 2: Próximos 5 meses (completando 6 meses no total)
  const metaC2 = multiply(custoMensalEssencial, 5);

  let restante = totalReservaAtual;

  // Alocação Camada 1
  let alocadoC1 = zero(moeda);
  if (greaterOrEqual(restante, metaC1)) {
    alocadoC1 = metaC1;
    restante = subtract(restante, metaC1);
  } else {
    alocadoC1 = restante;
    restante = zero(moeda);
  }

  // Alocação Camada 2
  let alocadoC2 = zero(moeda);
  if (greaterOrEqual(restante, metaC2)) {
    alocadoC2 = metaC2;
    restante = subtract(restante, metaC2);
  } else {
    alocadoC2 = restante;
    restante = zero(moeda);
  }

  // Alocação Camada 3 (o que sobrou além dos 6 meses de segurança total)
  const alocadoC3 = restante;
  const metaC3 = multiply(custoMensalEssencial, 6); // meta de referência para mais 6 meses

  const pctC1 = metaC1.amount > 0 ? Math.min(100, Math.round((alocadoC1.amount / metaC1.amount) * 100)) : 0;
  const pctC2 = metaC2.amount > 0 ? Math.min(100, Math.round((alocadoC2.amount / metaC2.amount) * 100)) : 0;
  const pctC3 = metaC3.amount > 0 ? Math.min(100, Math.round((alocadoC3.amount / metaC3.amount) * 100)) : 0;

  return {
    custoMensalEssencial,
    totalReservaAtual,
    camada1Imediata: {
      numero: 1,
      nome: "Caixa Imediato (Respiro 24/7)",
      liquidezDias: "D+0 (Imediato)",
      metaValor: metaC1,
      valorAlocadoAtual: alocadoC1,
      percentualConcluido: pctC1,
      ondeGuardar: "Conta remunerada (100% CDI) ou caixinha com resgate imediato aos fins de semana.",
      objetivo: "Cobrir imprevistos cotidianos urgentes (remédios, pequenos reparos, emergência no feriado).",
    },
    camada2CurtoPrazo: {
      numero: 2,
      nome: "Proteção Plena (2 a 6 meses)",
      liquidezDias: "D+1 (1 dia útil)",
      metaValor: metaC2,
      valorAlocadoAtual: alocadoC2,
      percentualConcluido: pctC2,
      ondeGuardar: "Tesouro Selic ou CDB de liquidez diária em grandes bancos / cooperativas.",
      objetivo: "Proteger contra desemprego, emergências de saúde ou quedas bruscas de renda familiar.",
    },
    camada3Oportunidades: {
      numero: 3,
      nome: "Caixa Estratégico & Oportunidades",
      liquidezDias: "D+30 (Estratégico)",
      metaValor: metaC3,
      valorAlocadoAtual: alocadoC3,
      percentualConcluido: pctC3,
      ondeGuardar: "Títulos com carência (LCI/LCA 90 dias, Tesouro IPCA+ curto, CDBs pós-fixados).",
      objetivo: "Excedente de segurança para aproveitar compras à vista com desconto ou projetos futuros.",
    },
  };
}
