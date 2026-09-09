import { doc, writeBatch, type Firestore } from "firebase/firestore";
import { type CalendarDate, instant } from "@/core/date/calendar-date";
import { isPositive, zero, type Money } from "@/core/money/money";
import { err, ok, validationError, type Result } from "@/core/result/result";
import type { RecurringRule, RuleOccurrence } from "@/modules/recurring/domain/recurring-rule";
import type { AccountId, HouseholdId, UserId } from "@/modules/shared/domain/common";
import { stripUndefined } from "@/modules/shared/infrastructure/codecs";

/**
 * Confirmar uma ocorrência de regra recorrente.
 *
 * O salário é uma `RecurringRule`: ela existe só na projeção, expandida a cada
 * cálculo, e nunca virou documento. Isso mantém doze meses de projeção sem doze
 * meses de documentos — e é a razão de não haver, hoje, nenhum lugar onde
 * dizer "caiu, e caiu R$ 1.850 em vez de R$ 2.000".
 *
 * Aqui a ocorrência vira um documento **no momento em que é confirmada**, e só
 * então. Sem job de fechamento, sem materialização em massa: a pessoa aperta
 * "Recebi" e aquela ocorrência — só aquela — passa a existir.
 *
 * ## Três decisões que parecem detalhe e não são
 *
 * **A obrigação nasce já quitada, com o valor real.** Criá-la com os R$ 2.000
 * previstos para liquidá-la logo depois com R$ 1.850 deixaria R$ 150 de resto
 * — uma receita que ninguém vai receber, inflando a projeção e virando
 * "atrasada" quando a data passasse.
 *
 * **A chave da ocorrência é propagada, nunca reconstruída.**
 * `occurrenceKeyFor` usa a data **nominal**, enquanto `dueDate` já passou pela
 * política de fim de semana. Numa regra `NEXT_BUSINESS_DAY` cujo dia caia num
 * sábado, montar a chave a partir de `dueDate` produziria uma chave que não
 * bate com a que o motor de projeção procura — a deduplicação falharia em
 * silêncio e o salário seria contado duas vezes. Por isso a entrada é a
 * `RuleOccurrence` inteira, vinda do expansor.
 *
 * **O id do documento é a chave da ocorrência.** Confirmar duas vezes vira uma
 * escrita sobre documento existente, e as regras recusam pelo `createdAt` —
 * a idempotência é do banco, não de uma trava de tela que uma conexão instável
 * contorna.
 */

export interface ConfirmOccurrenceInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  readonly uid: UserId;
  readonly rule: RecurringRule;
  /** A ocorrência como o expansor a produziu. Nunca remontada à mão. */
  readonly occurrence: RuleOccurrence;
  /** O que realmente entrou ou saiu, que pode diferir do previsto. */
  readonly amount: Money;
  readonly accountId: AccountId;
  readonly settledOn: CalendarDate;
  /** Hoje, no fuso da casa. O módulo não inventa "hoje" por conta própria. */
  readonly asOf: CalendarDate;
}

export interface CancelOccurrenceInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  readonly uid: UserId;
  readonly rule: RecurringRule;
  readonly occurrence: RuleOccurrence;
}

export interface ConfirmedOccurrence {
  readonly obligationId: string;
  readonly transactionId: string;
}

/**
 * Ids de documento derivados da chave da ocorrência.
 *
 * `rule-1:2026-09-05` é um id válido — não contém barra, não é `.` nem `..` —
 * e é estável, que é o ponto.
 */
export function occurrenceDocumentId(occurrenceKey: string): string {
  return occurrenceKey;
}

export async function confirmOccurrence(
  input: ConfirmOccurrenceInput,
): Promise<Result<ConfirmedOccurrence>> {
  if (!isPositive(input.amount)) {
    return err(validationError("Informe um valor maior que zero."));
  }
  // Confirmar com data futura recriaria o problema que tudo isto resolve:
  // dinheiro contado como recebido antes de existir.
  if (input.settledOn > input.asOf) {
    return err(validationError("A data não pode estar no futuro. Confirme só o que já se moveu."));
  }

  const now = instant();
  const isInflow = input.rule.direction === "INFLOW";
  const obligationId = occurrenceDocumentId(input.occurrence.occurrenceKey);

  const obligationRef = doc(
    input.db,
    `households/${input.householdId}/obligations/${obligationId}`,
  );
  const transactionRef = doc(
    input.db,
    `households/${input.householdId}/transactions/${obligationId}`,
  );

  const batch = writeBatch(input.db);

  batch.set(
    obligationRef,
    stripUndefined({
      householdId: input.householdId,
      direction: input.rule.direction,
      origin: "RECURRING_RULE",
      source: {
        recurringRuleId: input.rule.id,
        occurrenceKey: input.occurrence.occurrenceKey,
      },
      description: input.rule.description,
      // O valor real, não o previsto: é ele que a projeção precisa parar de
      // esperar e o mês precisa contar.
      amount: input.amount,
      dueDate: input.occurrence.dueDate,
      competenceDate: input.occurrence.competenceDate,
      categoryId: input.rule.categoryId,
      expectedAccountId: input.accountId,
      expenseNature: input.rule.expenseNature,
      confidence: "CONFIRMED",
      visibility: input.rule.visibility,
      responsibleMemberId: input.rule.responsibleMemberId,
      status: "SETTLED",
      settledAmount: input.amount,
      settlementTransactionIds: [transactionRef.id],
      settledAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.uid,
    }),
  );

  batch.set(
    transactionRef,
    stripUndefined({
      householdId: input.householdId,
      kind: isInflow ? "INCOME" : "EXPENSE",
      amount: input.amount,
      transactionDate: input.settledOn,
      // A competência é a da ocorrência: o salário de setembro é de setembro
      // mesmo que caia no dia 2 de outubro.
      competenceDate: input.occurrence.competenceDate,
      description: input.rule.description,
      visibility: input.rule.visibility,
      responsibleMemberId: input.rule.responsibleMemberId,
      accountId: input.accountId,
      categoryId: input.rule.categoryId ?? (isInflow ? undefined : "outros-gastos"),
      settlesObligationId: obligationId,
      createdAt: now,
      updatedAt: now,
      createdBy: input.uid,
    }),
  );

  try {
    await batch.commit();
  } catch (commitError) {
    return err(alreadyConfirmed(commitError));
  }

  return ok({ obligationId, transactionId: transactionRef.id });
}

/**
 * "Não recebi este mês."
 *
 * Materializa a ocorrência como cancelada. Uma obrigação cancelada continua no
 * conjunto de chaves que o motor de projeção consulta, então a ocorrência para
 * de ser projetada — que é exatamente o que "não veio" significa. Deixá-la
 * simplesmente aberta faria a projeção continuar contando um salário que não
 * existe, e a listagem continuaria oferecendo o botão de confirmar.
 */
export async function cancelOccurrence(input: CancelOccurrenceInput): Promise<Result<null>> {
  const now = instant();
  const obligationId = occurrenceDocumentId(input.occurrence.occurrenceKey);

  const batch = writeBatch(input.db);
  batch.set(
    doc(input.db, `households/${input.householdId}/obligations/${obligationId}`),
    stripUndefined({
      householdId: input.householdId,
      direction: input.rule.direction,
      origin: "RECURRING_RULE",
      source: {
        recurringRuleId: input.rule.id,
        occurrenceKey: input.occurrence.occurrenceKey,
      },
      description: input.rule.description,
      amount: input.occurrence.amount,
      dueDate: input.occurrence.dueDate,
      competenceDate: input.occurrence.competenceDate,
      categoryId: input.rule.categoryId,
      expenseNature: input.rule.expenseNature,
      confidence: input.rule.confidence,
      visibility: input.rule.visibility,
      responsibleMemberId: input.rule.responsibleMemberId,
      status: "CANCELED",
      settledAmount: zero(input.occurrence.amount.currency),
      settlementTransactionIds: [],
      createdAt: now,
      updatedAt: now,
      createdBy: input.uid,
    }),
  );

  try {
    await batch.commit();
  } catch (commitError) {
    return err(alreadyConfirmed(commitError));
  }

  return ok(null);
}

/**
 * A recusa das regras vira uma frase que explica o que aconteceu.
 *
 * Uma segunda confirmação da mesma ocorrência é barrada pelo `createdAt`
 * imutável. Mostrar "permission-denied" para quem tocou no botão duas vezes
 * seria transformar a proteção num defeito aparente.
 */
function alreadyConfirmed(cause: unknown) {
  const message =
    cause instanceof Error && cause.message.includes("permission")
      ? "Este lançamento já foi confirmado."
      : "Não foi possível confirmar agora. Tente novamente.";
  return validationError(message);
}
