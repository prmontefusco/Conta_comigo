"use client";

import Link from "next/link";
import { Button, Card, CardTitle } from "@/components/ui/primitives";

export default function CardRegistrationPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Cartões de crédito</h1>
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Cadastre ou corrija os cartões usados pela família. Faturas, parcelas e importação
          continuam na área Cartões.
        </p>
      </div>

      <Card>
        <CardTitle>Cadastro dos cartões</CardTitle>
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          O cadastro detalhado ainda usa a tela de Cartões, onde ficam os botões de novo cartão e
          edição. Esta separação no menu prepara a experiência para, depois, deixar cadastro e
          operação em telas diferentes.
        </p>
        <Link href="/app/cartoes" className="mt-4 inline-block">
          <Button>Abrir cadastro de cartões</Button>
        </Link>
      </Card>
    </div>
  );
}
