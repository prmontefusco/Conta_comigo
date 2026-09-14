"use client";

import Link from "next/link";
import { Button, Card, CardTitle } from "@/components/ui/primitives";

export default function LoanRegistrationPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Empréstimos</h1>
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Cadastre contratos, financiamentos e renegociações. A análise de risco e recuperação fica
          na área Dívidas.
        </p>
      </div>

      <Card>
        <CardTitle>Cadastro de contratos</CardTitle>
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          O cadastro detalhado ainda usa a tela de Dívidas e Empréstimos. A nova rota deixa claro
          que cadastro base e jornada de recuperação não precisam disputar o mesmo menu.
        </p>
        <Link href="/app/dividas" className="mt-4 inline-block">
          <Button>Abrir cadastro de empréstimos</Button>
        </Link>
      </Card>
    </div>
  );
}
