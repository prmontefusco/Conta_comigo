"use client";

import { useEffect, useState } from "react";
import { calendarDate, formatCalendarDate } from "@/core/date/calendar-date";
import { DateField, FormError, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Badge, Button, Card, CardTitle, EmptyState } from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import type { VehicleDoc } from "@/modules/shared/infrastructure/schemas";
import { useCollections } from "@/modules/shared/ui/use-collections";

interface VehicleForm {
  name: string;
  brand: string;
  model: string;
  year: string;
  plate: string;
  ipvaDueDate: string;
}

const EMPTY_FORM: VehicleForm = {
  name: "",
  brand: "",
  model: "",
  year: "",
  plate: "",
  ipvaDueDate: "",
};

export default function VehiclesPage() {
  const finance = useFinance();
  const [editing, setEditing] = useState<VehicleDoc | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const vehicles = finance.vehicles.filter((vehicle) => !vehicle.archived);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Veículos</h1>
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Cadastre veículos uma vez e vincule abastecimento, IPVA, seguro e manutenções nos
            lançamentos normais.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          Novo veículo
        </Button>
      </div>

      <Card>
        <CardTitle hint="Use o lançamento rápido em Hoje ou Movimentos e escolha o veículo no campo opcional.">
          Veículos cadastrados
        </CardTitle>
        {vehicles.length === 0 ? (
          <EmptyState
            title="Nenhum veículo cadastrado"
            description="Comece pelo nome do veículo. Marca, modelo, ano e placa ficam opcionais para reduzir preenchimento."
            action={<Button onClick={() => setDialogOpen(true)}>Cadastrar veículo</Button>}
          />
        ) : (
          <ul className="divide-y divide-[color:var(--card-border)]">
            {vehicles.map((vehicle) => (
              <li key={vehicle.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{vehicle.name}</p>
                  <p className="truncate text-sm" style={{ color: "var(--muted-fg)" }}>
                    {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ") ||
                      "Sem detalhes"}
                  </p>
                  {vehicle.ipvaDueDate ? (
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      IPVA vence em {formatCalendarDate(vehicle.ipvaDueDate)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {vehicle.plate ? <Badge tone="neutral">{vehicle.plate}</Badge> : null}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(vehicle);
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

      <VehicleDialog
        open={dialogOpen}
        vehicle={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function VehicleDialog({
  open,
  vehicle,
  onClose,
}: {
  open: boolean;
  vehicle: VehicleDoc | null;
  onClose: () => void;
}) {
  const { household } = useSession();
  const collections = useCollections();
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      vehicle
        ? {
            name: vehicle.name,
            brand: vehicle.brand ?? "",
            model: vehicle.model ?? "",
            year: vehicle.year ? String(vehicle.year) : "",
            plate: vehicle.plate ?? "",
            ipvaDueDate: vehicle.ipvaDueDate ?? "",
          }
        : EMPTY_FORM,
    );
  }, [open, vehicle]);

  async function save() {
    if (!household) return;
    const name = form.name.trim();
    if (!name) {
      setError("Informe um nome para o veículo.");
      return;
    }

    const year = form.year.trim() ? Number(form.year) : undefined;
    if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
      setError("Informe um ano válido.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const fields = {
        name,
        brand: blankToUndefined(form.brand),
        model: blankToUndefined(form.model),
        year,
        plate: blankToUndefined(form.plate.toUpperCase()),
        ipvaDueDate: dateToUndefined(form.ipvaDueDate),
        archived: false,
      };
      if (vehicle) await collections.vehicles.update(vehicle.id, fields);
      else await collections.vehicles.create({ householdId: household.id, ...fields });
      onClose();
    } catch {
      setError("Não foi possível salvar o veículo agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={vehicle ? "Editar veículo" : "Novo veículo"}
      description="Só o nome é obrigatório. Os detalhes ajudam na identificação, mas podem ficar para depois."
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
          placeholder="Carro da família"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Marca"
            value={form.brand}
            onChange={(event) => setForm({ ...form, brand: event.target.value })}
            placeholder="Toyota"
          />
          <TextField
            label="Modelo"
            value={form.model}
            onChange={(event) => setForm({ ...form, model: event.target.value })}
            placeholder="Corolla"
          />
          <TextField
            label="Ano"
            inputMode="numeric"
            value={form.year}
            onChange={(event) => setForm({ ...form, year: event.target.value })}
            placeholder="2024"
          />
          <TextField
            label="Placa"
            value={form.plate}
            onChange={(event) => setForm({ ...form, plate: event.target.value })}
            placeholder="ABC1D23"
          />
          <DateField
            label="Vencimento do IPVA"
            value={form.ipvaDueDate}
            onChange={(event) => setForm({ ...form, ipvaDueDate: event.target.value })}
            hint="Opcional. Ajuda a prever impostos do veículo."
          />
        </div>
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
