import {
  type Money,
  money,
  multiply,
  sum,
} from "@/core/money/money";
import type { RecurringRule } from "./recurring-rule";

export interface MicroAssinaturaItem {
  readonly id: string;
  readonly nome: string;
  readonly valorMensal: Money;
  readonly categoria?: string;
  readonly provavelSupérfluo: boolean;
}

export interface ImpactoFuturoAssinaturas {
  readonly totalMensal: Money;
  readonly custoAcumulado1Ano: Money;
  readonly projecaoInvestido5Anos: Money; // juros compostos a ~10% a.a. (0.8% a.m.)
  readonly itens: readonly MicroAssinaturaItem[];
}

const PALAVRAS_CHAVE_ASSINATURAS = [
  "netflix",
  "spotify",
  "amazon",
  "prime",
  "disney",
  "hbo",
  "max",
  "globoplay",
  "youtube",
  "apple",
  "icloud",
  "google one",
  "deezer",
  "paramount",
  "academia",
  "smart fit",
  "bluefit",
  "clube",
  "assinatura",
  "streaming",
  "tarifa",
  "pacote",
];

/**
 * Identifica micro-assinaturas e cobranças automáticas que drenam silenciosamente o orçamento.
 */
export function detectarDespesasFantasmas(
  regras: readonly RecurringRule[],
  tetoValorMensal = 15000, // R$ 150,00 em centavos
): ImpactoFuturoAssinaturas {
  const moeda = regras[0]?.amount.currency ?? "BRL";

  const itens: MicroAssinaturaItem[] = [];

  for (const regra of regras) {
    if (regra.direction !== "OUTFLOW" || !regra.active) continue;

    const nomeLower = regra.description.toLowerCase();
    const ehPorNome = PALAVRAS_CHAVE_ASSINATURAS.some((palavra) => nomeLower.includes(palavra));
    const ehPorValor = regra.amount.amount <= tetoValorMensal;

    if (ehPorNome || ehPorValor) {
      itens.push({
        id: regra.id,
        nome: regra.description,
        valorMensal: regra.amount,
        provavelSupérfluo: ehPorNome,
      });
    }
  }

  const totalMensal = sum(
    itens.map((i) => i.valorMensal),
    moeda,
  );

  const custo1Ano = multiply(totalMensal, 12);

  // Projeção em 5 anos (60 meses) com CDI médio conservador de 0.8% ao mês
  // FV = PMT * ((1 + i)^n - 1) / i
  // Para i = 0.008 e n = 60: ((1.008)^60 - 1) / 0.008 ≈ 76.62
  const fatorFV5Anos = 76.62;
  const projecao5AnosAmount = Math.round(totalMensal.amount * fatorFV5Anos);
  const projecaoInvestido5Anos = money(projecao5AnosAmount, moeda);

  return {
    totalMensal,
    custoAcumulado1Ano: custo1Ano,
    projecaoInvestido5Anos,
    itens,
  };
}
