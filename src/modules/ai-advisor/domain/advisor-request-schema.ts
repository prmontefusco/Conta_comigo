import { z } from "zod";

/**
 * O que o cliente pode dizer ao pedir uma consultoria.
 *
 * O corpo desta rota vira **prompt de um modelo cobrado por token**, então o
 * limite de tamanho não é preciosismo de validação: é o teto de custo de uma
 * requisição. Sem ele, um campo de texto longo é uma fatura aberta.
 *
 * O contexto financeiro chega já formatado do navegador porque é derivado em
 * memória lá (`deriveFinanceData`). Isso é aceitável apenas porque a resposta
 * volta para a mesma pessoa que enviou os números: ninguém vê o dado de outro
 * ao mentir aqui. O que não é aceitável é o tamanho ser livre — daí os `max`.
 */

/** Pergunta livre. Acima disto, o texto é recusado em vez de truncado em silêncio. */
export const MAX_QUESTION_LENGTH = 500;

/** Um valor monetário já formatado ("R$ 1.234,56"). */
const formattedMoney = z.string().trim().max(40);

export const advisorRequestSchema = z.object({
  message: z.string().trim().max(MAX_QUESTION_LENGTH).optional(),
  context: z.object({
    score: z.number().finite().min(0).max(100),
    statusLabel: z.string().trim().max(60),
    totalCashFormatted: formattedMoney,
    monthlyIncomeFormatted: formattedMoney,
    monthlyExpensesFormatted: formattedMoney,
    monthlyNetFormatted: formattedMoney,
    debtCommitmentRatio: z.number().finite().min(0).max(100_000),
    totalDebtFormatted: formattedMoney,
    overdueBillsCount: z.number().int().min(0).max(100_000),
    overdueBillsTotalFormatted: formattedMoney,
    emergencyFundMonths: z.number().finite().min(0).max(1_000),
    monthsToDebtFree: z.number().finite().min(0).max(1_000),
    debtFreeDateFormatted: z.string().trim().max(40),
  }),
});

export type AdvisorRequestInput = z.infer<typeof advisorRequestSchema>;
export type AdvisorContext = AdvisorRequestInput["context"];
