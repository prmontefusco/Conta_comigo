import {
  type Money,
  isPositive,
  money,
  zero,
} from "@/core/money/money";

export type NivelRunway = "CRITICO" | "VULNERAVEL" | "ESTAVEL" | "SEGURO" | "INDEPENDENTE";

export interface RunwayInput {
  readonly liquidezTotalDisponivel: Money;
  readonly custoMensalEssencial: Money;
}

export interface RunwayCalculado {
  readonly liquidezDisponivel: Money;
  readonly custoMensalEssencial: Money;
  readonly burnRateDiario: Money;
  readonly diasAutonomia: number;
  readonly mesesAutonomia: number;
  readonly nivel: NivelRunway;
  readonly tituloNivel: string;
  readonly descricao: string;
  readonly recomendacaoAcao: string;
}

/**
 * Calcula os Dias de Liberdade Financeira (Runway) da família.
 * Representa quantos dias a família sobreviveria mantendo suas despesas básicas
 * caso todas as fontes de renda fossem interrompidas hoje.
 */
export function calcularRunway(input: RunwayInput): RunwayCalculado {
  const moeda = input.liquidezTotalDisponivel.currency;

  if (!isPositive(input.custoMensalEssencial) || !isPositive(input.liquidezTotalDisponivel)) {
    return {
      liquidezDisponivel: input.liquidezTotalDisponivel,
      custoMensalEssencial: input.custoMensalEssencial,
      burnRateDiario: zero(moeda),
      diasAutonomia: 0,
      mesesAutonomia: 0,
      nivel: "CRITICO",
      tituloNivel: "Caixa em Risco Imediato",
      descricao: "A família não possui cobertura de liquidez para despesas essenciais.",
      recomendacaoAcao:
        "Foque em formar a Reserva de Respiro de R$ 500 a R$ 1.000 antes de qualquer outro investimento.",
    };
  }

  // Custo diário estimado (despesa mensal / 30)
  const custoDiarioAmount = Math.max(1, Math.round(input.custoMensalEssencial.amount / 30));
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
    descricao = `Seus recursos cobrem aproximadamente ${diasAutonomia} dias de sobrevivência básica.`;
    recomendacaoAcao =
      "Evite novas parcelas e estanque despesas supérfluas para alcançar pelo menos 30 dias de cobertura.";
  } else if (diasAutonomia < 90) {
    nivel = "VULNERAVEL";
    tituloNivel = "Colchão Inicial (1 a 3 meses)";
    descricao = `Você possui ${diasAutonomia} dias (${mesesAutonomia} meses) de tranquilidade garantida.`;
    recomendacaoAcao =
      "Mantenha o foco em amortizar dívidas com juros altos para depois expandir a reserva para 6 meses.";
  } else if (diasAutonomia < 180) {
    nivel = "ESTAVEL";
    tituloNivel = "Estabilidade Padrão (3 a 6 meses)";
    descricao = `Cobertura sólida de ${diasAutonomia} dias (${mesesAutonomia} meses) para imprevistos do cotidiano.`;
    recomendacaoAcao =
      "Patrimônio suficiente para atravessar transições de emprego ou emergências médicas com calma.";
  } else if (diasAutonomia < 365) {
    nivel = "SEGURO";
    tituloNivel = "Segurança Avançada (6 a 12 meses)";
    descricao = `Excelente proteção de ${mesesAutonomia} meses sem depender de renda ativa.`;
    recomendacaoAcao =
      "Você já pode começar a diversificar aportes em investimentos de maior prazo com liquidez planejada.";
  } else {
    nivel = "INDEPENDENTE";
    tituloNivel = "Liberdade Financeira (1 ano+)";
    descricao = `Você atingiu mais de 1 ano completo (${mesesAutonomia} meses) de autonomia e resiliência financeira.`;
    recomendacaoAcao =
      "Excelente estrutura patrimonial. Mantenha os custos essenciais sob controle e foque em valorização de longo prazo.";
  }

  return {
    liquidezDisponivel: input.liquidezTotalDisponivel,
    custoMensalEssencial: input.custoMensalEssencial,
    burnRateDiario,
    diasAutonomia,
    mesesAutonomia,
    nivel,
    tituloNivel,
    descricao,
    recomendacaoAcao,
  };
}
