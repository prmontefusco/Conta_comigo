import {
  type Money,
  isPositive,
  money,
  zero,
} from "@/core/money/money";

export type NivelRunway = "CRITICO" | "VULNERAVEL" | "ESTAVEL" | "SEGURO" | "INDEPENDENTE";

export interface RunwayInput {
  readonly liquidezTotalDisponivel: Money;
  readonly saidasMensaisConsideradas: Money;
}

export interface RunwayCalculado {
  readonly liquidezDisponivel: Money;
  readonly saidasMensaisConsideradas: Money;
  readonly burnRateDiario: Money;
  readonly diasAutonomia: number;
  readonly mesesAutonomia: number;
  readonly nivel: NivelRunway;
  readonly tituloNivel: string;
  readonly descricao: string;
  readonly recomendacaoAcao: string;
}

/**
 * Estima por quantos dias o caixa cobriria as saídas mensais usadas no cálculo.
 * É uma referência baseada nos dados cadastrados, não uma garantia de cobertura.
 */
export function calcularRunway(input: RunwayInput): RunwayCalculado {
  const moeda = input.liquidezTotalDisponivel.currency;

  if (!isPositive(input.saidasMensaisConsideradas) || !isPositive(input.liquidezTotalDisponivel)) {
    return {
      liquidezDisponivel: input.liquidezTotalDisponivel,
      saidasMensaisConsideradas: input.saidasMensaisConsideradas,
      burnRateDiario: zero(moeda),
      diasAutonomia: 0,
      mesesAutonomia: 0,
      nivel: "CRITICO",
      tituloNivel: "Caixa em Risco Imediato",
      descricao: "Ainda não há dados suficientes para estimar a cobertura do caixa.",
      recomendacaoAcao:
        "Confira se o saldo das contas e os compromissos do mês estão atualizados.",
    };
  }

  // Custo diário estimado (despesa mensal / 30)
  const custoDiarioAmount = Math.max(1, Math.round(input.saidasMensaisConsideradas.amount / 30));
  const burnRateDiario = money(custoDiarioAmount, moeda);

  const diasAutonomia = Math.floor(input.liquidezTotalDisponivel.amount / custoDiarioAmount);
  const mesesAutonomia = Math.round((diasAutonomia / 30) * 10) / 10;

  let nivel: NivelRunway;
  let tituloNivel: string;
  let descricao: string;
  let recomendacaoAcao: string;

  if (diasAutonomia < 30) {
    nivel = "CRITICO";
    tituloNivel = "Fôlego Curto (< 1 mês)";
    descricao = `Pelos valores cadastrados, o caixa cobre cerca de ${diasAutonomia} dias das saídas consideradas.`;
    recomendacaoAcao = "Revise os saldos e vencimentos cadastrados para conferir esta estimativa.";
  } else if (diasAutonomia < 90) {
    nivel = "VULNERAVEL";
    tituloNivel = "Estimativa: 1 a 3 meses";
    descricao = `Pelos valores cadastrados, o caixa cobre cerca de ${diasAutonomia} dias (${mesesAutonomia} meses) das saídas consideradas.`;
    recomendacaoAcao = "A estimativa pode mudar se saldo, compromissos ou despesas variarem.";
  } else if (diasAutonomia < 180) {
    nivel = "ESTAVEL";
    tituloNivel = "Estimativa: 3 a 6 meses";
    descricao = `Pelos valores cadastrados, o caixa cobre cerca de ${diasAutonomia} dias (${mesesAutonomia} meses) das saídas consideradas.`;
    recomendacaoAcao = "A estimativa não considera mudanças inesperadas nas entradas ou despesas.";
  } else if (diasAutonomia < 365) {
    nivel = "SEGURO";
    tituloNivel = "Estimativa: 6 a 12 meses";
    descricao = `Pelos valores cadastrados, o caixa cobre cerca de ${mesesAutonomia} meses das saídas consideradas.`;
    recomendacaoAcao = "Use este número como referência e mantenha os dados do mês atualizados.";
  } else {
    nivel = "INDEPENDENTE";
    tituloNivel = "Estimativa: mais de 12 meses";
    descricao = `Pelos valores cadastrados, o caixa cobre cerca de ${mesesAutonomia} meses das saídas consideradas.`;
    recomendacaoAcao = "Esta estimativa depende dos saldos e compromissos informados no aplicativo.";
  }

  return {
    liquidezDisponivel: input.liquidezTotalDisponivel,
    saidasMensaisConsideradas: input.saidasMensaisConsideradas,
    burnRateDiario,
    diasAutonomia,
    mesesAutonomia,
    nivel,
    tituloNivel,
    descricao,
    recomendacaoAcao,
  };
}
