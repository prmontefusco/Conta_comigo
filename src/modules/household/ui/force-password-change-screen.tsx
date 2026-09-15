"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Card } from "@/components/ui/primitives";
import { FormError, TextField } from "@/components/ui/form";
import { getAuthClient } from "@/lib/firebase/client";
import { changeInitialPassword } from "../application/change-initial-password";
import { useSession } from "./session-provider";

/**
 * Bloqueia o app até quem entrou com uma senha gerada por um administrador
 * escolher a própria. Ver `criar-membro/route.ts` para onde essa senha nasce
 * e `trocar-senha-inicial/route.ts` para a troca em si.
 */

const schema = z
  .object({
    newPassword: z.string().min(8, "Use pelo menos 8 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não são iguais.",
  });

type FormValues = z.infer<typeof schema>;

export function ForcePasswordChangeScreen({
  householdId,
  onDone,
}: {
  householdId: string;
  onDone: () => void;
}) {
  const { logout } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const idToken = await getAuthClient().currentUser?.getIdToken();
    if (!idToken) {
      setFormError("Sua sessão expirou. Entre novamente.");
      return;
    }

    const outcome = await changeInitialPassword({
      idToken,
      householdId,
      newPassword: values.newPassword,
    });

    if (!outcome.ok) {
      setFormError(outcome.error.message);
      return;
    }

    onDone();
  }

  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-16">
      <Card className="w-full">
        <h1 className="text-xl font-semibold">Escolha sua senha</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-fg)" }}>
          Sua conta foi criada com uma senha temporária. Antes de continuar, escolha uma senha só
          sua.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          {formError ? <FormError>{formError}</FormError> : null}

          <TextField
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            required
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />

          <TextField
            label="Confirme a nova senha"
            type="password"
            autoComplete="new-password"
            required
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar e continuar"}
          </Button>

          <button
            type="button"
            onClick={() => void logout()}
            className="w-full text-sm underline underline-offset-2"
            style={{ color: "var(--muted-fg)" }}
          >
            Sair
          </button>
        </form>
      </Card>
    </main>
  );
}
