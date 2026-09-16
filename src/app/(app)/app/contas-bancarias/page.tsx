"use client";

import { useEffect, useState } from "react";
import { deleteField } from "firebase/firestore";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { add, fromDecimalString, type Money, zero } from "@/core/money/money";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  EmptyState,
  MoneyText,
  Spinner,
  Stat,
} from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import {
  ACCOUNT_TYPE_LABELS,
  computeBalances,
  type Account,
  type AccountType,
} from "@/modules/accounts/domain/account";
import { overdraftGraceStatus } from "@/modules/accounts/domain/overdraft-grace";
import { accountReferencePatch } from "@/modules/accounts/domain/account-reference-edit";
import { useFinance } from "@/modules/household/ui/finance-provider";
import type { Transaction } from "@/modules/transactions/domain/transaction";
import { MemberField } from "@/modules/household/ui/member-field";
import { useSession } from "@/modules/household/ui/session-provider";
import { HelpTip } from "@/modules/education/ui/help-tip";
import { useCollections } from "@/modules/shared/ui/use-collections";
import { SourceColorField, SourceColorMark, sourceColor } from "@/modules/shared/ui/source-color";

/**
 * Bank accounts and balances.
 *
 * Balances are always derived from the opening balance plus every recorded
 * movement, so what is shown here can be reconciled line by line against a real
 * bank statement.
 *
 * Correções cadastrais não devem mexer no ponto de partida do saldo.
 */
export default function AccountsPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [transferring, setTransferring] = useState(false);

  if (finance.loading) return <Spinner label="Carregando suas contas" />;

  const balances = computeBalances(finance.accounts, finance.transactions, finance.asOf);
  const active = finance.accounts.filter((account) => !account.archived);
  const archived = finance.accounts.filter((account) => account.archived);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Informações bancárias e Saldos</h1>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setTransferring(true)}>
              Transferir entre contas
            </Button>
            <Button onClick={() => setCreating(true)}>Nova conta</Button>
          </div>
        ) : null}
      </div>

      <Card>
        <CardTitle>Total</CardTitle>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Saldo somado" value={finance.totalCash} size="xl" />
          <Stat
            label="Reserva protegida"
            value={finance.protectedReserve}
            tone="outflow"
            hint="Está dentro do saldo, mas você definiu que não está disponível."
          />
          <Stat label="Saldo livre" value={finance.overview.today.spendableCash} tone="positive" />
        </dl>
      </Card>

      {active.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma conta cadastrada"
            description="Cadastre onde seu dinheiro está: conta corrente, poupança, carteira digital ou dinheiro em espécie."
            action={
              canWrite ? <Button onClick={() => setCreating(true)}>Nova conta</Button> : undefined
            }
          />
        </Card>
      ) : (
        <>
          <h2 className="text-sm font-semibold">Suas contas</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((account) => (
              <AccountBalanceCard
                key={account.id}
                account={account}
                balance={balances.get(account.id) ?? zero()}
                transactions={finance.transactions}
                asOf={finance.asOf}
                onEdit={canWrite ? () => setEditing(account) : undefined}
              />
            ))}
          </ul>
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Saldo + limite inclui crédito do cheque especial, não é dinheiro próprio. Confirme a
            disponibilidade no banco.
          </p>
        </>
      )}

      {archived.length > 0 ? (
        <Card>
          <CardTitle hint="Ficam fora dos totais, mas os lançamentos antigos continuam valendo. Dá para reativar.">
            Contas arquivadas
          </CardTitle>
          <ul className="divide-y divide-[color:var(--card-border)]">
            {archived.map((account) => (
              <li key={account.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{account.name}</p>
                  <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {ACCOUNT_TYPE_LABELS[account.type]}
                    {account.institution ? ` · ${account.institution}` : ""}
                  </p>
                </div>
                {canWrite ? (
                  <Button
                    variant="ghost"
                    className="shrink-0 text-xs"
                    onClick={() => setEditing(account)}
                    aria-label={`Editar ${account.name}`}
                  >
                    Editar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <AccountDialog
        open={creating || editing !== null}
        account={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <TransferDialog
        open={transferring}
        accounts={active}
        onClose={() => setTransferring(false)}
        onCreateAccount={() => {
          setTransferring(false);
          setCreating(true);
        }}
      />
    </div>
  );
}

function AccountBalanceCard({
  account,
  balance,
  transactions,
  asOf,
  onEdit,
}: {
  account: Account;
  balance: Money;
  transactions: readonly Transaction[];
  asOf: ReturnType<typeof useFinance>["asOf"];
  onEdit?: () => void;
}) {
  const limit = account.overdraftLimit ?? zero();
  const grace = overdraftGraceStatus(account, transactions, asOf);
  return (
    <Card as="li">
      {account.color ? (
        <div
          aria-hidden="true"
          className="mb-3 h-1 rounded-full"
          style={{ backgroundColor: sourceColor(account.color) }}
        />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold">
            <SourceColorMark color={account.color} />
            {account.name}
          </h3>
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            {ACCOUNT_TYPE_LABELS[account.type]}
            {account.institution ? ` · ${account.institution}` : ""}
          </p>
          {account.visibility === "PERSONAL" ? <Badge>Pessoal</Badge> : null}
        </div>
        {onEdit ? (
          <Button
            variant="ghost"
            className="text-xs"
            onClick={onEdit}
            aria-label={`Editar ${account.name}`}
          >
            Editar
          </Button>
        ) : null}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[color:var(--card-border)] pt-3">
        <div className="col-span-2">
          <dt className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Saldo atual da conta
          </dt>
          <dd>
            <MoneyText value={balance} size="lg" />
          </dd>
        </div>
        <div>
          <dt className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Limite de cheque especial
          </dt>
          <dd>
            <MoneyText value={limit} size="sm" />
          </dd>
        </div>
        <div>
          <dt className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Saldo + limite
          </dt>
          <dd>
            <MoneyText value={add(balance, limit)} size="sm" />
          </dd>
        </div>
      </dl>
      <p className="text-2xs mt-3" style={{ color: "var(--muted-fg)" }}>
        Referência inicial em {formatCalendarDate(account.openingBalanceDate)}
      </p>
      {grace ? (
        <p
          className="mt-2 text-xs font-medium"
          style={{
            color: grace.withinGracePeriod ? "var(--muted-fg)" : "var(--color-critical-700)",
          }}
        >
          {grace.withinGracePeriod
            ? `Usando o limite há ${grace.daysUsed} dias; restam ${grace.daysRemaining} dias de carência.`
            : `Uso do limite passou dos ${grace.graceDays} dias de carência; confira os juros cobrados.`}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * Dinheiro que muda de lugar, não que entra ou sai da casa.
 *
 * Sacar da conta corrente para levar na carteira, ou guardar na poupança, não
 * é gasto nem receita — as duas pontas continuam sendo dinheiro do grupo. Sem
 * esta tela, a única forma de representar isso era um gasto de um lado e uma
 * receita do outro, e cada uma delas mentia: uma dizia que o dinheiro tinha
 * sido consumido, a outra que a casa tinha ficado mais rica. `TRANSFER` já
 * existia no domínio (dois efeitos de caixa que se cancelam,
 * `cashEffect` em transaction.ts) - faltava só a tela.
 */
function TransferDialog({
  open,
  accounts,
  onClose,
  onCreateAccount,
}: {
  open: boolean;
  accounts: readonly Account[];
  onClose: () => void;
  onCreateAccount: () => void;
}) {
  const { household } = useSession();
  const { asOf } = useFinance();
  const collections = useCollections();

  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [date, setDate] = useState<string>(asOf);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFromAccountId(accounts[0]?.id ?? "");
    setToAccountId(accounts[1]?.id ?? "");
    setAmountText("");
    setDate(asOf);
    setDescription("");
    setError(null);
  }, [open, accounts, asOf]);

  if (!open) return null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household) return;

    const amount = fromDecimalString(amountText);
    if (!amount || amount.amount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (!fromAccountId || !toAccountId) {
      setError("Escolha de onde e para onde o dinheiro vai.");
      return;
    }
    if (fromAccountId === toAccountId) {
      setError("Escolha duas contas diferentes.");
      return;
    }
    const when = date as never;

    setSaving(true);
    try {
      await collections.transactions.create({
        householdId: household.id,
        kind: "TRANSFER",
        amount,
        fromAccountId,
        toAccountId,
        transactionDate: when,
        competenceDate: when,
        description: description.trim() || "Transferência entre contas",
        visibility: "HOUSEHOLD",
      } as never);
      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (accounts.length < 2) {
    return (
      <Modal open={open} onClose={onClose} title="Transferir entre contas">
        <div className="space-y-4">
          <Callout tone="attention" title="Falta uma segunda conta">
            Uma transferência precisa de origem e destino. Cadastre outra conta — por exemplo, uma
            Carteira para o dinheiro físico — e volte aqui.
          </Callout>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={onCreateAccount}>
              Cadastrar conta
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transferir entre contas"
      description="Dinheiro que muda de lugar, não gasto nem receita. O total da casa não muda."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <SelectField
          label="De onde sai"
          required
          value={fromAccountId}
          onChange={(event) => setFromAccountId(event.target.value)}
          options={accounts.map((account) => ({ value: account.id, label: account.name }))}
        />

        <SelectField
          label="Para onde vai"
          required
          value={toAccountId}
          onChange={(event) => setToAccountId(event.target.value)}
          options={accounts.map((account) => ({ value: account.id, label: account.name }))}
        />

        <MoneyField
          label="Valor"
          required
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          placeholder="0,00"
        />

        <DateField
          label="Data"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />

        <TextField
          label="Descrição"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Saque para carteira"
          hint="Opcional."
        />

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Salvando…" : "Transferir"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Cadastrar ou corrigir uma conta.
 *
 * O saldo de referência só pode ser corrigido em uma ação administrativa
 * explícita, nunca numa edição comum do nome ou do limite.
 * - **Arquivar não é excluir.** Uma conta encerrada continua sendo dona de
 *   lançamentos antigos, que precisam continuar existindo para o histórico
 *   fechar. Excluir de verdade fica com o administrador, e só quando não há
 *   nenhum lançamento apontando para ela.
 */
function AccountDialog({
  open,
  account,
  onClose,
}: {
  open: boolean;
  account: Account | null;
  onClose: () => void;
}) {
  const { household, canAdminister } = useSession();
  const { asOf, transactions } = useFinance();
  const collections = useCollections();

  const editing = account !== null;

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("CHECKING");
  const [institution, setInstitution] = useState("");
  const [balanceText, setBalanceText] = useState("");
  const [balanceDate, setBalanceDate] = useState<string>(asOf);
  const [overdraftText, setOverdraftText] = useState("");
  const [graceDaysText, setGraceDaysText] = useState("");
  const [visibility, setVisibility] = useState("HOUSEHOLD");
  const [ownerMemberId, setOwnerMemberId] = useState("");
  const [archived, setArchived] = useState(false);
  const [color, setColor] = useState("#64748b");
  const [correctingReference, setCorrectingReference] = useState(false);
  const [confirmedReference, setConfirmedReference] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Abrir o diálogo é o que traz os dados: sem isto, editar uma conta depois
  // de outra mostraria os números da anterior.
  useEffect(() => {
    if (!open) return;

    setError(null);
    setConfirmingDelete(false);
    setCorrectingReference(false);
    setConfirmedReference(false);

    if (!account) {
      setName("");
      setType("CHECKING");
      setInstitution("");
      setBalanceText("");
      setBalanceDate(asOf);
      setOverdraftText("");
      setGraceDaysText("");
      setVisibility("HOUSEHOLD");
      setOwnerMemberId("");
      setArchived(false);
      setColor("#64748b");
      return;
    }

    setName(account.name);
    setType(account.type);
    setInstitution(account.institution ?? "");
    setBalanceText(moneyField(account.openingBalance.amount));
    setBalanceDate(account.openingBalanceDate);
    setOverdraftText(account.overdraftLimit ? moneyField(account.overdraftLimit.amount) : "");
    setGraceDaysText(account.overdraftGraceDays ? String(account.overdraftGraceDays) : "");
    setVisibility(account.visibility);
    setOwnerMemberId(account.ownerMemberId ?? "");
    setArchived(account.archived);
    setColor(sourceColor(account.color));
  }, [open, account, asOf]);

  /** Quantos lançamentos deixariam de ter conta se esta fosse excluída. */
  const linkedCount = account
    ? transactions.filter((transaction) => touchesAccount(transaction, account.id)).length
    : 0;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household) return;

    if (name.trim().length < 2) {
      setError("Dê um nome para a conta.");
      return;
    }
    const openingBalance =
      !account || correctingReference
        ? fromDecimalString(balanceText || "0")
        : account.openingBalance;
    if (!openingBalance) {
      setError("Informe um saldo válido. Pode ser zero.");
      return;
    }
    const referenceChanged =
      account &&
      correctingReference &&
      (openingBalance.amount !== account.openingBalance.amount ||
        balanceDate !== account.openingBalanceDate);
    if (referenceChanged && !confirmedReference) {
      setError(
        "Confirme que deseja corrigir o saldo de referência e recalcular os saldos posteriores.",
      );
      return;
    }

    // Sem limite não há o que ficar negativo sem juros — a carência não tem
    // sentido sozinha, então some junto se o limite for removido.
    const graceDays = overdraftText && graceDaysText ? Number(graceDaysText) : undefined;
    if (
      graceDays !== undefined &&
      (!Number.isInteger(graceDays) || graceDays < 1 || graceDays > 31)
    ) {
      setError("Informe um número de dias entre 1 e 31.");
      return;
    }

    setSaving(true);
    try {
      const fields = {
        name: name.trim(),
        type,
        institution: institution.trim() || undefined,
        ...accountReferencePatch(
          account,
          correctingReference,
          openingBalance,
          balanceDate as never,
        ),
        overdraftLimit: overdraftText ? (fromDecimalString(overdraftText) ?? undefined) : undefined,
        overdraftGraceDays: graceDays,
        visibility: visibility as never,
        ownerMemberId: ownerMemberId || undefined,
        includeInTotals: true,
        archived,
        color,
      };

      if (account) {
        // `undefined` some do payload antes de chegar ao Firestore, então um
        // campo apagado no formulário ficaria com o valor antigo.
        // `blankToDeleted` troca por `deleteField()`, que é o que "tirei o
        // limite do cheque especial" precisa significar de verdade.
        await collections.accounts.update(account.id, blankToDeleted(fields) as never);
      } else {
        await collections.accounts.create({ householdId: household.id, ...fields } as never);
      }
      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!account) return;
    setError(null);
    setSaving(true);
    try {
      await collections.accounts.remove(account.id);
      onClose();
    } catch (deleteError) {
      console.error(deleteError);
      setError("Não foi possível excluir agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar conta" : "Nova conta"}
      description={
        editing
          ? "Edite os dados da conta. O saldo de referência fica protegido para não alterar o dinheiro mostrado por engano."
          : "O saldo informado passa a valer a partir da data escolhida. Não é preciso cadastrar o histórico."
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <TextField
          label="Nome"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Conta corrente"
        />

        <SelectField
          label="Tipo"
          value={type}
          onChange={(event) => setType(event.target.value as AccountType)}
          options={Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />

        <TextField
          label="Banco ou instituição"
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
          placeholder="Opcional"
        />

        <SourceColorField value={color} onChange={setColor} />

        {editing && !correctingReference ? (
          <div className="rounded-lg border border-[color:var(--card-border)] p-3 text-sm">
            <p className="font-medium">Saldo de referência protegido</p>
            <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
              {moneyField(account!.openingBalance.amount)} em{" "}
              {formatCalendarDate(account!.openingBalanceDate)}. Alterar nome, banco, cor ou limite
              não muda esse valor nem o saldo atual.
            </p>
            {canAdminister ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-2 text-xs"
                onClick={() => setCorrectingReference(true)}
              >
                Corrigir saldo de referência
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            {editing ? (
              <Callout tone="critical" title="Correção excepcional de saldo">
                Isso recalcula o saldo desta conta desde a data escolhida. Para registrar dinheiro
                que entrou ou saiu depois, faça um lançamento; não altere a referência.
              </Callout>
            ) : null}
            <MoneyField
              label={editing ? "Saldo de referência" : "Saldo atual"}
              required
              value={balanceText}
              onChange={(event) => {
                setBalanceText(event.target.value);
                setConfirmedReference(false);
              }}
              placeholder="0,00"
            />
            <DateField
              label="Saldo na data de"
              help={<HelpTip term="SALDO_NA_DATA" label="a data do saldo" />}
              required
              value={balanceDate}
              onChange={(event) => {
                setBalanceDate(event.target.value);
                setConfirmedReference(false);
              }}
            />
            {editing ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmedReference}
                  onChange={(event) => setConfirmedReference(event.target.checked)}
                  className="mt-1 size-4"
                />
                Confirmo que estou corrigindo o valor de referência, não registrando uma
                movimentação.
              </label>
            ) : null}
          </>
        )}

        <MoneyField
          label="Limite de cheque especial"
          help={<HelpTip term="CHEQUE_ESPECIAL" />}
          value={overdraftText}
          onChange={(event) => setOverdraftText(event.target.value)}
          placeholder="0,00"
          hint="Opcional. É crédito, não saldo: fica sempre separado do seu dinheiro."
        />

        {overdraftText ? (
          <TextField
            label="Dias sem juros no cheque especial"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={graceDaysText}
            onChange={(event) => setGraceDaysText(event.target.value)}
            placeholder="Ex.: 10"
            hint="Alguns bancos (como o Santander) não cobram juros nos primeiros dias em que a conta fica negativa. Deixe em branco se o seu não oferecer isso."
          />
        ) : null}

        <MemberField
          label="Titular"
          hint="De quem é esta conta. Deixe no grupo se for conjunta."
          value={ownerMemberId}
          onChange={setOwnerMemberId}
          emptyLabel="Do grupo (conjunta)"
        />

        <SelectField
          label="Esta conta é"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
          options={[
            { value: "HOUSEHOLD", label: "Do grupo" },
            { value: "PERSONAL", label: "Pessoal" },
          ]}
        />

        {editing ? (
          <SelectField
            label="Situação"
            value={archived ? "ARCHIVED" : "ACTIVE"}
            onChange={(event) => setArchived(event.target.value === "ARCHIVED")}
            options={[
              { value: "ACTIVE", label: "Em uso" },
              { value: "ARCHIVED", label: "Arquivada (conta encerrada)" },
            ]}
            hint="Arquivar tira a conta dos totais e das listas de escolha, sem apagar nenhum lançamento."
          />
        ) : null}

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>

        {editing && canAdminister ? (
          <div className="border-t border-[color:var(--card-border)] pt-4">
            {confirmingDelete ? (
              <Callout tone="critical" title="Excluir esta conta?">
                <p className="text-sm">
                  {linkedCount > 0
                    ? `${linkedCount} ${linkedCount === 1 ? "lançamento aponta" : "lançamentos apontam"} para esta conta e ${linkedCount === 1 ? "ficaria" : "ficariam"} sem conta nenhuma. Arquivar mantém o histórico inteiro e tira a conta dos totais — é quase sempre o que você quer.`
                    : "Nenhum lançamento aponta para esta conta, então excluir não deixa buraco no histórico."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void onDelete()}
                    disabled={saving}
                  >
                    Excluir mesmo assim
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={saving}
                  >
                    Manter
                  </Button>
                </div>
              </Callout>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
              >
                Excluir conta
              </Button>
            )}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

/** Centavos no formato que o campo de dinheiro espera. */
function moneyField(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Se um lançamento pertence à conta.
 *
 * Não basta olhar `accountId`: uma transferência tem dois lados e uma
 * movimentação de reserva tem conta de contrapartida. Contar só um deles
 * diria "nenhum lançamento aponta para esta conta" a quem está prestes a
 * apagar a origem de metade das transferências do ano.
 */
function touchesAccount(transaction: Transaction, accountId: string): boolean {
  const fields = transaction as unknown as Record<string, unknown>;
  return (
    fields.accountId === accountId ||
    fields.fromAccountId === accountId ||
    fields.toAccountId === accountId ||
    fields.counterAccountId === accountId
  );
}

/**
 * Faz `undefined` apagar o campo de verdade, em vez de só sumir do payload.
 *
 * `deleteField()`, não `null`: o schema desses campos opcionais aceita o
 * campo ausente, não um `null` literal. Gravar `null` pareceria funcionar,
 * mas quebraria a leitura do documento na próxima sincronização.
 */
function blankToDeleted(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value === undefined ? deleteField() : value,
    ]),
  );
}
