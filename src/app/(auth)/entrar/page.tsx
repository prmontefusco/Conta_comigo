"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Card } from "@/components/ui/primitives";
import { FormError, TextField } from "@/components/ui/form";
import { getAuthClient } from "@/lib/firebase/client";
import { authErrorMessage } from "@/modules/auth/ui/auth-errors";
import { useSession } from "@/modules/household/ui/session-provider";

const schema = z.object({
  email: z.string().min(1, "Informe seu e-mail.").email("Esse e-mail não parece válido."),
  password: z.string().min(1, "Informe sua senha."),
});

type FormValues = z.infer<typeof schema>;

export default function SignInPage() {
  const router = useRouter();
  const { status } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (status === "authenticated") router.replace("/app");
  }, [status, router]);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await signInWithEmailAndPassword(getAuthClient(), values.email, values.password);
      router.replace("/app");
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  }

  async function onResetPassword() {
    const email = getValues("email");
    if (!email) {
      setFormError("Informe seu e-mail para receber o link de redefinição.");
      return;
    }
    try {
      await sendPasswordResetEmail(getAuthClient(), email);
    } catch {
      // Deliberately silent: telling the caller whether the address exists
      // would leak which emails have accounts.
    }
    setResetSent(true);
    setFormError(null);
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">Entrar</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted-fg)" }}>
        Acesse suas contas, cartões e projeções.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        {formError ? <FormError>{formError}</FormError> : null}

        {resetSent ? (
          <p
            role="status"
            className="rounded-lg border-l-4 border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] p-3 text-sm text-[color:var(--color-ink-900)]"
          >
            Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.
          </p>
        ) : null}

        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register("email")}
        />

        <TextField
          label="Senha"
          type="password"
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Entrando…" : "Entrar"}
        </Button>

        <button
          type="button"
          onClick={() => void onResetPassword()}
          className="w-full text-sm underline underline-offset-2"
          style={{ color: "var(--muted-fg)" }}
        >
          Esqueci minha senha
        </button>
      </form>

      <p className="mt-6 text-center text-sm">
        Ainda não tem conta?{" "}
        <Link
          href="/criar-conta"
          className="font-medium text-[color:var(--color-brand-700)] underline underline-offset-2"
        >
          Criar conta
        </Link>
      </p>
    </Card>
  );
}
