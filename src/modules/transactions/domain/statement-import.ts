import { tryCalendarDate, type CalendarDate } from "@/core/date/calendar-date";
import { type Money, money } from "@/core/money/money";

/**
 * Ler o extrato do banco.
 *
 * Digitar meses de histórico é barreira suficiente para desistir no primeiro
 * dia — e sem histórico a projeção não tem de onde partir, a estimativa de
 * contas variáveis não tem média e os relatórios não têm série.
 *
 * O que este módulo faz é **ler e propor**. Ele nunca grava: devolve uma lista
 * de linhas para a pessoa conferir, marcar e confirmar. Um extrato traz
 * transferências entre contas próprias, estornos e duplicatas do que já foi
 * lançado à mão; importar tudo às cegas produziria um saldo errado com
 * aparência de precisão, que é pior do que não importar.
 *
 * ## Os dois formatos
 *
 * **OFX** é o que os bancos brasileiros exportam, e é SGML — tags que abrem e
 * frequentemente não fecham. Um parser de XML engasga; este lê por marcador,
 * que é como o formato foi pensado.
 *
 * **CSV** não tem padrão. Cada banco escolhe separador, ordem de colunas e
 * formato de data. Em vez de exigir um layout, o módulo procura as colunas
 * pelo cabeçalho e tenta os formatos de data e de número usados no Brasil.
 *
 * ## O terceiro caminho
 *
 * Quem não chega ao menu que gera OFX ou CSV tem, no celular, o PDF que o
 * banco mandou por e-mail. Esse arquivo é lido por IA
 * (`modules/receipts/domain/statement-reading`) e entra aqui por
 * `entriesFromRows`, já como lista conferível: a partir daí é o mesmo
 * caminho dos formatos estruturados, com a mesma impressão digital e a mesma
 * conferência antes de gravar. A diferença aparece na tela, que diz de onde
 * a lista veio — leitura de arquivo estruturado não erra número, leitura de
 * imagem pode errar.
 */

export type StatementFormat = "OFX" | "CSV" | "IA";

export interface ImportedEntry {
  /** Id estável derivado do conteúdo, para conferir duplicata entre importações. */
  readonly fingerprint: string;
  readonly date: CalendarDate;
  readonly description: string;
  /** Positivo é entrada, negativo é saída — como o extrato traz. */
  readonly amount: Money;
  /** O identificador que o banco deu à transação, quando existe. */
  readonly externalId?: string;
}

export interface StatementParseResult {
  readonly format: StatementFormat;
  readonly entries: readonly ImportedEntry[];
  /** Linhas que não deu para entender, com o motivo. Nunca descartadas em silêncio. */
  readonly rejected: readonly { readonly line: string; readonly reason: string }[];
}

/* ------------------------------------------------------------------ */
/* OFX                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Lê um valor de tag SGML.
 *
 * `<TRNAMT>-45.90` — sem fechamento, que é a norma em OFX de banco. O valor
 * termina na próxima tag ou no fim da linha.
 */
function ofxTag(block: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  return match?.[1]?.trim() || undefined;
}

/** `20260906` ou `20260906120000[-3:BRT]` viram `2026-09-06`. */
function ofxDate(raw: string | undefined): CalendarDate | null {
  if (!raw || raw.length < 8) return null;
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return tryCalendarDate(iso);
}

export function parseOfx(content: string): StatementParseResult {
  const entries: ImportedEntry[] = [];
  const rejected: { line: string; reason: string }[] = [];

  const blocks = content.split(/<STMTTRN>/i).slice(1);

  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0] ?? raw;

    const date = ofxDate(ofxTag(block, "DTPOSTED"));
    const amountRaw = ofxTag(block, "TRNAMT");
    const description =
      ofxTag(block, "MEMO") ?? ofxTag(block, "NAME") ?? ofxTag(block, "TRNTYPE") ?? "";

    if (!date) {
      rejected.push({ line: compact(block), reason: "sem data reconhecível" });
      continue;
    }
    const amount = parseDecimal(amountRaw);
    if (amount === null) {
      rejected.push({ line: compact(block), reason: "sem valor reconhecível" });
      continue;
    }
    if (amount === 0) {
      rejected.push({ line: compact(block), reason: "valor zero" });
      continue;
    }

    const externalId = ofxTag(block, "FITID");

    entries.push({
      fingerprint: fingerprintOf(date, amount, description, externalId),
      date,
      description: cleanDescription(description),
      amount: money(amount),
      ...(externalId ? { externalId } : {}),
    });
  }

  return { format: "OFX", entries, rejected };
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

const DATE_HEADERS = ["data", "date", "data lancamento", "data do lancamento", "dt"];
const DESCRIPTION_HEADERS = [
  "descricao",
  "description",
  "historico",
  "lancamento",
  "detalhes",
  "titulo",
  "memo",
];
const AMOUNT_HEADERS = ["valor", "amount", "quantia", "montante"];

function normalise(text: string): string {
  return text.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Vírgula, ponto e vírgula ou tabulação — o que aparecer mais no cabeçalho. */
function detectSeparator(headerLine: string): string {
  const candidates = [";", ",", "\t"];
  return candidates.reduce((best, candidate) =>
    headerLine.split(candidate).length > headerLine.split(best).length ? candidate : best,
  );
}

function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      // Aspas duplas dentro de campo entre aspas representam uma aspa só.
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === separator && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseCsv(content: string): StatementParseResult {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const entries: ImportedEntry[] = [];
  const rejected: { line: string; reason: string }[] = [];

  const headerLine = lines[0];
  if (!headerLine) return { format: "CSV", entries, rejected };

  const separator = detectSeparator(headerLine);
  const headers = splitCsvLine(headerLine, separator).map(normalise);

  const dateIndex = headers.findIndex((header) => DATE_HEADERS.includes(header));
  const descriptionIndex = headers.findIndex((header) => DESCRIPTION_HEADERS.includes(header));
  const amountIndex = headers.findIndex((header) => AMOUNT_HEADERS.includes(header));

  if (dateIndex < 0 || amountIndex < 0) {
    rejected.push({
      line: compact(headerLine),
      reason: "não encontrei as colunas de data e valor no cabeçalho",
    });
    return { format: "CSV", entries, rejected };
  }

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, separator);
    const date = parseBrazilianDate(cells[dateIndex]);
    const amount = parseDecimal(cells[amountIndex]);

    if (!date) {
      rejected.push({ line: compact(line), reason: "sem data reconhecível" });
      continue;
    }
    if (amount === null || amount === 0) {
      rejected.push({ line: compact(line), reason: "sem valor reconhecível" });
      continue;
    }

    const description = descriptionIndex >= 0 ? (cells[descriptionIndex] ?? "") : "";

    entries.push({
      fingerprint: fingerprintOf(date, amount, description),
      date,
      description: cleanDescription(description),
      amount: money(amount),
    });
  }

  return { format: "CSV", entries, rejected };
}

/**
 * Monta a lista a partir de linhas já lidas por outro caminho.
 *
 * Existe para que o extrato lido por IA use exatamente a mesma impressão
 * digital, a mesma limpeza de descrição e a mesma detecção de duplicata dos
 * formatos estruturados. Uma segunda forma de montar `ImportedEntry` seria
 * uma segunda forma de errar.
 */
export function entriesFromRows(
  rows: readonly { date: CalendarDate; description: string; amountCents: number }[],
): StatementParseResult {
  const entries: ImportedEntry[] = [];
  const rejected: { line: string; reason: string }[] = [];

  for (const row of rows) {
    if (row.amountCents === 0) {
      rejected.push({ line: compact(`${row.date} ${row.description}`), reason: "valor zero" });
      continue;
    }

    entries.push({
      fingerprint: fingerprintOf(row.date, row.amountCents, row.description),
      date: row.date,
      description: cleanDescription(row.description),
      amount: money(row.amountCents),
    });
  }

  return { format: "IA", entries, rejected };
}

/** Escolhe o leitor pelo conteúdo, não pela extensão do arquivo. */
export function parseStatement(content: string): StatementParseResult {
  return /<STMTTRN>/i.test(content) || /<OFX>/i.test(content)
    ? parseOfx(content)
    : parseCsv(content);
}

/* ------------------------------------------------------------------ */
/* Números e datas                                                     */
/* ------------------------------------------------------------------ */

/**
 * Centavos inteiros a partir do que o banco escreveu.
 *
 * Não há formato único: o OFX de banco brasileiro costuma vir em notação
 * americana (`-45.90`) e o CSV exportado pelo mesmo banco, em notação daqui
 * (`-45,90`). Errar isto não produz erro visível — produz um saldo errado com
 * aparência de precisão.
 *
 * As regras, em ordem:
 *
 * 1. **Dois ou mais separadores iguais** só podem ser milhar (`1.234.567`).
 * 2. **Dois separadores diferentes**: o último é o decimal (`1.234,56` e
 *    `1,234.56`).
 * 3. **Um separador só** é ambíguo, e `1.234` é o caso duro: pode ser mil
 *    duzentos e trinta e quatro ou um vírgula dois três quatro. Desempata a
 *    quantidade de dígitos — dinheiro tem duas casas decimais, então três
 *    dígitos depois do separador é milhar. Com uma ou duas casas, é decimal.
 */
export function parseDecimal(raw: string | undefined): number | null {
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;

  const negative = cleaned.startsWith("-");
  const digits = cleaned.replace(/-/g, "");
  if (!/\d/.test(digits)) return null;

  const dots = (digits.match(/\./g) ?? []).length;
  const commas = (digits.match(/,/g) ?? []).length;

  let normalised: string;

  if (dots > 0 && commas > 0) {
    // O último separador é o decimal; o outro é milhar.
    normalised =
      digits.lastIndexOf(",") > digits.lastIndexOf(".")
        ? digits.replace(/\./g, "").replace(",", ".")
        : digits.replace(/,/g, "");
  } else if (dots > 1) {
    normalised = digits.replace(/\./g, "");
  } else if (commas > 1) {
    normalised = digits.replace(/,/g, "");
  } else if (dots === 1 || commas === 1) {
    const separator = dots === 1 ? "." : ",";
    const after = digits.length - digits.lastIndexOf(separator) - 1;
    normalised =
      after === 3
        ? digits.replace(separator, "") // milhar: 1.234
        : digits.replace(separator, "."); // decimal: 45,90
  } else {
    normalised = digits;
  }

  const value = Number(normalised);
  if (!Number.isFinite(value)) return null;

  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

/** `06/09/2026`, `2026-09-06` e `06-09-2026` — o que os bancos daqui usam. */
export function parseBrazilianDate(raw: string | undefined): CalendarDate | null {
  if (!raw) return null;
  const text = raw.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return tryCalendarDate(`${iso[1]}-${iso[2]}-${iso[3]}`);

  const dmy = /^(\d{2})[/-](\d{2})[/-](\d{4})/.exec(text);
  if (dmy) return tryCalendarDate(`${dmy[3]}-${dmy[2]}-${dmy[1]}`);

  const dmyShort = /^(\d{2})[/-](\d{2})[/-](\d{2})$/.exec(text);
  if (dmyShort) return tryCalendarDate(`20${dmyShort[3]}-${dmyShort[2]}-${dmyShort[1]}`);

  return null;
}

/**
 * Identidade de uma linha, para reconhecer o que já foi importado.
 *
 * Usa o id do banco quando existe — é o único verdadeiramente estável. Sem
 * ele, data, valor e descrição juntos: duas compras iguais no mesmo dia
 * colidem, e colidir é o comportamento certo, porque a pessoa confere a lista
 * antes de confirmar.
 */
export function fingerprintOf(
  date: CalendarDate,
  amountCents: number,
  description: string,
  externalId?: string,
): string {
  if (externalId) return `id:${externalId}`;
  return `${date}|${amountCents}|${normalise(description).slice(0, 40)}`;
}

function cleanDescription(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  return text === "" ? "Lançamento importado" : text.slice(0, 120);
}

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}
