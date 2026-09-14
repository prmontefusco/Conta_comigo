"use client";

import { useEffect, useState } from "react";
import { calendarDate, formatCalendarDate } from "@/core/date/calendar-date";
import { DateField, FormError, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Badge, Button, Card, CardTitle, EmptyState } from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import type { PropertyDoc } from "@/modules/shared/infrastructure/schemas";
import { useCollections } from "@/modules/shared/ui/use-collections";

type PropertyKind = PropertyDoc["kind"];

const PROPERTY_KIND_LABELS: Record<PropertyKind, string> = {
  HOME: "Moradia",
  RENTAL: "Aluguel",
  COMMERCIAL: "Comercial",
  LAND: "Terreno",
  OTHER: "Outro",
};

interface PropertyForm {
  name: string;
  kind: PropertyKind;
  address: string;
  iptuDueDate: string;
}

const EMPTY_FORM: PropertyForm = {
  name: "",
  kind: "HOME",
  address: "",
  iptuDueDate: "",
};

export default function PropertiesPage() {
  const finance = useFinance();
  const [editing, setEditing] = useState<PropertyDoc | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const properties = finance.properties.filter((property) => !property.archived);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Imóveis</h1>
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Cadastre residências, imóveis alugados ou terrenos e vincule despesas nos lançamentos
            normais.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          Novo imóvel
        </Button>
      </div>

      <Card>
        <CardTitle hint="IPTU, condomínio, água, luz, reformas e aluguel recebido podem ser vinculados ao imóvel no lançamento.">
          Imóveis cadastrados
        </CardTitle>
        {properties.length === 0 ? (
          <EmptyState
            title="Nenhum imóvel cadastrado"
            description="Cadastre apenas um nome agora. Tipo e endereço ajudam na organização, mas não travam o lançamento."
            action={<Button onClick={() => setDialogOpen(true)}>Cadastrar imóvel</Button>}
          />
        ) : (
          <ul className="divide-y divide-[color:var(--card-border)]">
            {properties.map((property) => (
              <li key={property.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{property.name}</p>
                  <p className="truncate text-sm" style={{ color: "var(--muted-fg)" }}>
                    {property.address || "Sem endereço informado"}
                  </p>
                  {property.iptuDueDate ? (
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      IPTU vence em {formatCalendarDate(property.iptuDueDate)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="neutral">{PROPERTY_KIND_LABELS[property.kind]}</Badge>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(property);
                      setDialogOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PropertyDialog
        open={dialogOpen}
        property={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function PropertyDialog({
  open,
  property,
  onClose,
}: {
  open: boolean;
  property: PropertyDoc | null;
  onClose: () => void;
}) {
  const { household } = useSession();
  const collections = useCollections();
  const [form, setForm] = useState<PropertyForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      property
        ? {
            name: property.name,
            kind: property.kind,
            address: property.address ?? "",
            iptuDueDate: property.iptuDueDate ?? "",
          }
        : EMPTY_FORM,
    );
  }, [open, property]);

  async function save() {
    if (!household) return;
    const name = form.name.trim();
    if (!name) {
      setError("Informe um nome para o imóvel.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const fields = {
        name,
        kind: form.kind,
        address: blankToUndefined(form.address),
        iptuDueDate: dateToUndefined(form.iptuDueDate),
        archived: false,
      };
      if (property) await collections.properties.update(property.id, fields);
      else await collections.properties.create({ householdId: household.id, ...fields });
      onClose();
    } catch {
      setError("Não foi possível salvar o imóvel agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={property ? "Editar imóvel" : "Novo imóvel"}
      description="Mantenha simples: o imóvel serve para agrupar despesas e receitas lançadas no dia a dia."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <FormError>{error}</FormError>
        <TextField
          label="Nome"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Casa principal"
        />
        <SelectField
          label="Tipo"
          value={form.kind}
          onChange={(event) => setForm({ ...form, kind: event.target.value as PropertyKind })}
          options={Object.entries(PROPERTY_KIND_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <TextField
          label="Endereço"
          value={form.address}
          onChange={(event) => setForm({ ...form, address: event.target.value })}
          placeholder="Rua, número, bairro"
        />
        <DateField
          label="Vencimento do IPTU"
          value={form.iptuDueDate}
          onChange={(event) => setForm({ ...form, iptuDueDate: event.target.value })}
          hint="Opcional. Ajuda a lembrar impostos do imóvel."
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !collections.ready}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function dateToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? calendarDate(trimmed) : undefined;
}
