"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Card } from "@/components/ui/primitives";
import { FormError, TextField } from "@/components/ui/form";
import { getAuthClient } from "@/lib/firebase/client";
import { authErrorMessage } from "@/modules/auth/ui/auth-errors";
import { createHousehold, ensureUserProfile } from "@/modules/household/application/onboarding";

const schema = z
  .object({
    displayName: z.string().trim().min(2, "Como podemos chamar você?").max(80),
    householdName: z
      .string()
      .trim()
      .min(2, "Dê um nome ao seu grupo. Pode ser só o seu nome.")
      .max(80),
    email: z.string().min(1, "Informe seu e-mail.").email("Esse e-mail não parece válido."),
    password: z.string().min(8, "Use pelo menos 8 caracteres."),
    passwordConfirmation: z.string(),
    acceptedTerms: z.literal(true, {
      message: "É preciso aceitar os termos e a política de privacidade.",
    }),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "As senhas não são iguais.",
  });

type FormValues = z.infer<typeof schema>;

export default function SignUpPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const credential = await createUserWithEmailAndPassword(
        getAuthClient(),
        values.email,
        values.password,
      );

      await updateProfile(credential.user, { displayName: values.displayName });
      await ensureUserProfile(credential.user.uid, values.displayName, values.email);
      await createHousehold(
        credential.user.uid,
        values.displayName,
        values.householdName,
        values.email,
      );

      router.replace("/app/comecar");
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">Criar conta</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted-fg)" }}>
        Leva menos de um minuto. Você pode cadastrar suas contas e despesas aos poucos.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        {formError ? <FormError>{formError}</FormError> : null}

        <TextField
          label="Seu nome"
          autoComplete="name"
          required
          error={errors.displayName?.message}
          {...register("displayName")}
        />

        <TextField
          label="Nome do grupo"
          hint="Pode ser sua família, seu casal ou só as suas finanças."
          required
          error={errors.householdName?.message}
          {...register("householdName")}
        />

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
          autoComplete="new-password"
          hint="Pelo menos 8 caracteres."
          required
          error={errors.password?.message}
          {...register("password")}
        />

        <TextField
          label="Repita a senha"
          type="password"
          autoComplete="new-password"
          required
          error={errors.passwordConfirmation?.message}
          {...register("passwordConfirmation")}
        />

        <div className="space-y-1.5">
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0"
              aria-invalid={errors.acceptedTerms ? true : undefined}
              {...register("acceptedTerms")}
            />
            <span>
              Li e aceito os{" "}
              <Link href="/termos" className="underline underline-offset-2">
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" className="underline underline-offset-2">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>
          {errors.acceptedTerms ? (
            <p role="alert" className="text-xs font-medium text-[color:var(--tone-critical)]">
              {errors.acceptedTerms.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Criando…" : "Criar conta"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        Já tem conta?{" "}
        <Link
          href="/entrar"
          className="font-medium text-[color:var(--color-brand-700)] underline underline-offset-2"
        >
          Entrar
        </Link>
      </p>
    </Card>
  );
}
