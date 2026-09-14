"use client";

import Link from "next/link";
import { Button, Card, CardTitle } from "@/components/ui/primitives";

const ACTIONS = [
  {
    href: "/app/dia-a-dia",
    title: "Registrar gasto",
    description: "Mercado, farmácia, combustível, pix enviado ou compra do dia.",
    action: "Abrir gastos",
  },
  {
    href: "/app/entradas",
    title: "Registrar recebimento",
    description: "Salário, diária, comissão, benefício, aluguel recebido ou renda extra.",
    action: "Abrir entradas",
  },
  {
    href: "/app/contas",
    title: "Conta a pagar",
    description: "Boleto, aluguel, luz, água, internet ou uma despesa futura.",
    action: "Abrir contas",
  },
  {
    href: "/app/cartoes",
    title: "Fatura do cartão",
    description: "Importe uma fatura, veja parcelas futuras ou cadastre uma compra.",
    action: "Abrir cartões",
  },
] as const;

export default function QuickAddPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Adicionar rápido</h1>
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Escolha o que aconteceu. O cadastro detalhado pode ficar para depois.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((item) => (
          <Card key={item.href}>
            <CardTitle>{item.title}</CardTitle>
            <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
              {item.description}
            </p>
            <Link href={item.href} className="mt-4 inline-block">
              <Button>{item.action}</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
