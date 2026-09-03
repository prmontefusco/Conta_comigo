import { formatMoney } from "@/core/money/format";
import type { Money } from "@/core/money/money";

/**
 * What to say to a creditor.
 *
 * The hard part of renegotiating is rarely the arithmetic - it is being on the
 * phone, under pressure, without knowing what to ask for. These are scripts to
 * read out loud, built around the two things that change an outcome: asking
 * for the debt to be broken down before discussing anything, and naming a
 * figure that was decided beforehand instead of one improvised on the call.
 *
 * Every number in a script comes from the household's own data or is left as a
 * blank to fill in. Nothing here invents a balance, a rate or a promise, and
 * no script claims a right the app cannot verify.
 */

export type ScriptId =
  "DETALHAMENTO" | "PROPOSTA" | "PORTABILIDADE" | "PRAZO" | "COBRANCA_NAO_RECONHECIDA";

export interface ScriptParams {
  readonly personName?: string;
  readonly creditorName?: string;
  readonly debtDescription?: string;
  readonly claimedBalance?: Money;
  /** The instalment the household worked out that it can actually pay. */
  readonly affordableInstallment?: Money;
  readonly installmentCount?: number;
}

export interface NegotiationScript {
  readonly id: ScriptId;
  readonly title: string;
  readonly whenToUse: string;
  readonly channel: string;
  /** What to do before and after the call, in order. */
  readonly checklist: readonly string[];
  readonly build: (params: ScriptParams) => string;
}

/** Shown wherever a value is unknown, so nothing reads as certain when it is not. */
export const BLANK = "________";

function name(params: ScriptParams): string {
  return params.personName?.trim() || BLANK;
}

function creditor(params: ScriptParams): string {
  return params.creditorName?.trim() || BLANK;
}

function subject(params: ScriptParams): string {
  return params.debtDescription?.trim() || "esta dívida";
}

function amount(value: Money | undefined): string {
  return value ? formatMoney(value) : `R$ ${BLANK}`;
}

function count(value: number | undefined): string {
  return value && value > 0 ? String(value) : BLANK;
}

export const NEGOTIATION_SCRIPTS: readonly NegotiationScript[] = [
  {
    id: "DETALHAMENTO",
    title: "Pedir o detalhamento do saldo devedor",
    whenToUse:
      "Antes de discutir qualquer acordo. Sem saber quanto é principal e quanto é juros e multa, não há como avaliar se a proposta é boa.",
    channel: "Telefone, chat ou e-mail",
    checklist: [
      "Anote o nome de quem atendeu, a data, a hora e o número do protocolo.",
      "Peça o detalhamento por escrito, por e-mail ou WhatsApp.",
      "Não aceite nenhuma proposta nesta primeira ligação.",
    ],
    build: (params) =>
      [
        `Olá, meu nome é ${name(params)}. Estou entrando em contato sobre ${subject(params)}.`,
        "",
        "Antes de falar sobre acordo, preciso do detalhamento do saldo devedor. Por favor, me informe:",
        "",
        "1. O valor original contratado e a data da contratação.",
        "2. Quanto do saldo atual é principal e quanto é juros, multa e encargos.",
        "3. A taxa de juros aplicada e o CET (Custo Efetivo Total).",
        "4. A data do último pagamento registrado.",
        "5. Se esta dívida está registrada em algum cadastro de inadimplentes.",
        "",
        "Pode me enviar esse detalhamento por escrito, por e-mail ou WhatsApp?",
        "",
        `Vou registrar o protocolo deste atendimento: ${BLANK}.`,
      ].join("\n"),
  },
  {
    id: "PROPOSTA",
    title: "Propor um acordo que cabe no seu mês",
    whenToUse:
      "Depois de saber quanto cabe de verdade. O valor é decidido antes da ligação, não durante ela.",
    channel: "Telefone, chat ou WhatsApp",
    checklist: [
      "Calcule antes qual parcela cabe e não suba desse valor durante a conversa.",
      "Peça o valor total do acordo, não só o da parcela.",
      "Só assine ou aceite depois de receber as condições por escrito.",
    ],
    build: (params) =>
      [
        `Olá, meu nome é ${name(params)}. Estou falando sobre ${subject(params)}${
          params.creditorName ? ` com ${creditor(params)}` : ""
        }.`,
        "",
        `Quero quitar essa dívida e fiz as contas do meu orçamento. Consigo pagar ${amount(
          params.affordableInstallment,
        )} por mês, em até ${count(params.installmentCount)} parcelas.`,
        "",
        "Esse é o valor que cabe hoje. Não adianta eu aceitar uma parcela maior e não conseguir manter o acordo daqui a três meses.",
        "",
        `Se essa proposta não for possível, qual é a melhor condição que vocês conseguem com uma parcela de até ${amount(
          params.affordableInstallment,
        )}?`,
        "",
        "Antes de fechar, preciso saber:",
        "- o valor total do acordo, somando todas as parcelas;",
        "- a taxa de juros e o CET;",
        "- o que acontece se eu atrasar uma parcela;",
        "- a confirmação por escrito e a data da baixa do meu nome nos cadastros.",
      ].join("\n"),
  },
  {
    id: "PORTABILIDADE",
    title: "Pedir portabilidade para juros menores",
    whenToUse:
      "Quando outro banco oferece a mesma dívida com juros mais baixos. A portabilidade de crédito é regulamentada pelo Banco Central e não pode ser cobrada como tarifa.",
    channel: "Telefone ou aplicativo do banco",
    checklist: [
      "Peça ao banco atual o saldo devedor para portabilidade e o CET do contrato.",
      "Leve esses dois números ao banco novo e compare pelo CET, nunca pela parcela.",
      "Só troque se o CET do novo contrato for menor que o atual.",
    ],
    build: (params) =>
      [
        `Olá, meu nome é ${name(params)}. Tenho um contrato de ${subject(params)}${
          params.creditorName ? ` com ${creditor(params)}` : ""
        } e quero solicitar a portabilidade dele para outra instituição.`,
        "",
        "Para isso, preciso que vocês me informem:",
        "",
        "1. O saldo devedor atualizado para portabilidade.",
        "2. O CET (Custo Efetivo Total) e a taxa de juros do contrato atual.",
        "3. O número do contrato e a quantidade de parcelas que faltam.",
        "",
        "Peço também o número de protocolo deste pedido.",
        "",
        "Se vocês tiverem uma contraproposta com juros menores, posso avaliar — mas preciso dela por escrito, com o CET.",
      ].join("\n"),
  },
  {
    id: "PRAZO",
    title: "Pedir prazo antes de atrasar",
    whenToUse:
      "Quando você já sabe que a próxima parcela não vai caber. Avisar antes costuma abrir opções que o atraso fecha.",
    channel: "Telefone ou aplicativo do banco",
    checklist: [
      "Ligue antes do vencimento, não depois.",
      "Pergunte o custo da mudança: prorrogar quase sempre cobra juros.",
      "Confirme por escrito antes de deixar de pagar qualquer coisa.",
    ],
    build: (params) =>
      [
        `Olá, meu nome é ${name(params)}. Tenho ${subject(params)}${
          params.creditorName ? ` com ${creditor(params)}` : ""
        } e vou ter dificuldade de pagar a parcela que vence em ${BLANK}.`,
        "",
        "Estou avisando antes de atrasar, porque quero manter o contrato em dia.",
        "",
        "Quais dessas opções vocês têm?",
        "- prorrogar o vencimento desta parcela;",
        `- reduzir temporariamente a parcela para ${amount(params.affordableInstallment)} por alguns meses;`,
        "- alongar o prazo do contrato.",
        "",
        "Para cada opção, preciso saber quanto isso aumenta o custo total da dívida.",
      ].join("\n"),
  },
  {
    id: "COBRANCA_NAO_RECONHECIDA",
    title: "Contestar uma cobrança que você não reconhece",
    whenToUse:
      "Quando aparece uma dívida que você não fez, ou um valor que não bate com o que foi contratado.",
    channel: "Preferencialmente por escrito, com protocolo",
    checklist: [
      "Peça o documento que originou a dívida.",
      "Guarde todos os protocolos e as respostas recebidas.",
      "Se não houver solução, os canais de defesa do consumidor e o Banco Central recebem reclamações.",
    ],
    build: (params) =>
      [
        `Olá, meu nome é ${name(params)}. Recebi uma cobrança de ${amount(
          params.claimedBalance,
        )} referente a ${subject(params)}${params.creditorName ? ` de ${creditor(params)}` : ""} e não reconheço essa cobrança.`,
        "",
        "Peço que me enviem:",
        "",
        "1. O contrato ou documento que originou essa dívida.",
        "2. O detalhamento completo dos valores cobrados.",
        "3. A origem e a data da contratação.",
        "",
        "Enquanto essa documentação não for apresentada, peço que a cobrança seja suspensa e que meu nome não seja incluído em cadastro de inadimplentes.",
        "",
        `Registro o protocolo deste atendimento: ${BLANK}.`,
      ].join("\n"),
  },
];

export function scriptById(id: ScriptId): NegotiationScript {
  const script = NEGOTIATION_SCRIPTS.find((item) => item.id === id);
  if (!script) throw new Error(`Unknown negotiation script: ${id}`);
  return script;
}

/** The script text, ready to be copied. */
export function buildScript(id: ScriptId, params: ScriptParams): string {
  return scriptById(id).build(params);
}
