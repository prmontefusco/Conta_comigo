"use client";

import { useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { fromDecimalString } from "@/core/money/money";
import {
  Badge,
  Button,
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
  type AccountType,
} from "@/modules/accounts/domain/account";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { MemberField } from "@/modules/household/ui/member-field";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * Bank accounts and balances.
 *
 * Balances are always derived from the opening balance plus every recorded
 * movement, so what is shown here can be reconciled line by line against a real
 * bank statement.
 */
export default function AccountsPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const [creating, setCreating] = useState(false);

  if (finance.loading) return <Spinner label="Carregando suas contas" />;

  const balances = computeBalances(finance.accounts, finance.transactions, finance.asOf);
  const active = finance.accounts.filter((account) => !account.archived);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Contas e saldos</h1>
        {canWrite ? <Button onClick={() => setCreating(true)}>Nova conta</Button> : null}
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
        <Card>
          <CardTitle>Suas contas</CardTitle>
          <ul className="divide-y divide-[color:var(--card-border)]">
            {active.map((account) => (
              <li key={account.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{account.name}</p>
                  <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {ACCOUNT_TYPE_LABELS[account.type]}
                    {account.institution ? ` · ${account.institution}` : ""} · saldo inicial em{" "}
                    {formatCalendarDate(account.openingBalanceDate)}
                  </p>
                  {account.visibility === "PERSONAL" ? (
                    <span className="mt-1 inline-block">
                      <Badge>Pessoal</Badge>
                    </span>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <MoneyText
                    value={balances.get(account.id) ?? { amount: 0, currency: "BRL" }}
                    size="lg"
                  />
                  {account.overdraftLimit ? (
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      Cheque especial disponível de{" "}
                      <span className="tabular">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(account.overdraftLimit.amount / 100)}
                      </span>
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs" style={{ color: "var(--muted-fg)" }}>
            O limite do cheque especial não é dinheiro seu: aparece separado do saldo de propósito.
          </p>
        </Card>
      )}

      <NewAccountDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function NewAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household } = useSession();
  const { asOf } = useFinance();
  const collections = useCollections();

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("CHECKING");
  const [institution, setInstitution] = useState("");
  const [balanceText, setBalanceText] = useState("");
  const [balanceDate, setBalanceDate] = useState<string>(asOf);
  const [overdraftText, setOverdraftText] = useState("");
  const [visibility, setVisibility] = useState("HOUSEHOLD");
  const [ownerMemberId, setOwnerMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household) return;

    if (name.trim().length < 2) {
      setError("Dê um nome para a conta.");
      return;
    }
    const openingBalance = fromDecimalString(balanceText || "0");
    if (!openingBalance) {
      setError("Informe um saldo válido. Pode ser zero.");
      return;
    }

    setSaving(true);
    try {
      await collections.accounts.create({
        householdId: household.id,
        name: name.trim(),
        type,
        institution: institution.trim() || undefined,
        openingBalance,
        openingBalanceDate: balanceDate as never,
        overdraftLimit: overdraftText ? (fromDecimalString(overdraftText) ?? undefined) : undefined,
        visibility: visibility as never,
        ...(ownerMemberId ? { ownerMemberId } : {}),
        includeInTotals: true,
        archived: false,
      } as never);
      setName("");
      setBalanceText("");
      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova conta"
      description="O saldo informado passa a valer a partir da data escolhida. Não é preciso cadastrar o histórico."
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

        <MoneyField
          label="Saldo atual"
          required
          value={balanceText}
          onChange={(event) => setBalanceText(event.target.value)}
          placeholder="0,00"
        />

        <DateField
          label="Saldo na data de"
          required
          value={balanceDate}
          onChange={(event) => setBalanceDate(event.target.value)}
        />

        <MoneyField
          label="Limite de cheque especial"
          value={overdraftText}
          onChange={(event) => setOverdraftText(event.target.value)}
          placeholder="0,00"
          hint="Opcional. É crédito, não saldo: fica sempre separado do seu dinheiro."
        />

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

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
