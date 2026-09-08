"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Callout, Card } from "@/components/ui/primitives";
import { FormError, TextField } from "@/components/ui/form";
import { getAuthClient } from "@/lib/firebase/client";
import {
  evaluateDeviceCooldown,
  generateClientFingerprint,
  getStoredDeviceRegistration,
  persistDeviceRegistration,
  type DeviceCooldownCheck,
} from "@/modules/auth/domain/device-fingerprint";
import { validateEmailForSignup } from "@/modules/auth/domain/email-validation";
import { authErrorMessage } from "@/modules/auth/ui/auth-errors";
import { AuthDivider, GoogleSignInButton } from "@/modules/auth/ui/google-sign-in-button";
import { createHousehold, ensureUserProfile } from "@/modules/household/application/onboarding";

const schema = z
  .object({
    displayName: z.string().trim().min(2, "Como podemos chamar você?").max(80),
    householdName: z
      .string()
      .trim()
      .min(2, "Dê um nome ao seu grupo. Pode ser só o seu nome.")
      .max(80),
    email: z
      .string()
      .trim()
      .min(1, "Informe seu e-mail.")
      .superRefine((val, ctx) => {
        const check = validateEmailForSignup(val);
        if (!check.isValid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: check.message ?? "Esse e-mail não parece válido.",
          });
        }
      }),
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
  const [cooldownCheck, setCooldownCheck] = useState<DeviceCooldownCheck | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const watchedEmail = watch("email");

  // Verifica sugestões de erro de digitação no e-mail (ex: @gmil.com -> @gmail.com)
  useEffect(() => {
    if (!watchedEmail || !watchedEmail.includes("@")) {
      setEmailSuggestion(null);
      return;
    }
    const res = validateEmailForSignup(watchedEmail);
    if (res.suggestedCorrection && res.suggestedCorrection !== watchedEmail.toLowerCase().trim()) {
      setEmailSuggestion(res.suggestedCorrection);
    } else {
      setEmailSuggestion(null);
    }
  }, [watchedEmail]);

  // Checa se o dispositivo já realizou cadastro recente para alertar o usuário
  useEffect(() => {
    const record = getStoredDeviceRegistration();
    const check = evaluateDeviceCooldown(record);
    if (!check.isAllowed) {
      setCooldownCheck(check);
    }
  }, []);

  async function onSubmit(values: FormValues) {
    setFormError(null);

    const deviceHash = generateClientFingerprint();

    // 1. Verificação prévia no servidor (Anti-Abuso, Rate Limit por IP e E-mail descartável)
    try {
      const verifyRes = await fetch("/api/auth/verificar-cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          deviceHash,
          action: "CHECK",
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.allowed) {
        setFormError(
          verifyData.message ??
            "Não foi possível validar seu cadastro no momento. Tente novamente mais tarde.",
        );
        return;
      }
    } catch {
      // Falha de rede na checagem não interrompe completamente o fluxo legítimo
    }

    // 2. Criação da Conta no Firebase Auth
    try {
      const credential = await createUserWithEmailAndPassword(
        getAuthClient(),
        values.email,
        values.password,
      );

      await updateProfile(credential.user, { displayName: values.displayName });

      // Envia confirmação de e-mail imediatamente
      await sendEmailVerification(credential.user).catch(() => undefined);
      await ensureUserProfile(credential.user.uid, values.displayName, values.email);
      await createHousehold(
        credential.user.uid,
        values.displayName,
        values.householdName,
        values.email,
      );

      // 3. Registra dispositivo para controle de cooldown e proteção do teste grátis
      persistDeviceRegistration(deviceHash);
      void fetch("/api/auth/verificar-cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          deviceHash,
          action: "RECORD",
        }),
      }).catch(() => undefined);

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

      {cooldownCheck && !cooldownCheck.isAllowed ? (
        <div className="mt-4">
          <Callout tone="attention">
            <p className="font-medium text-sm">Conta recente identificada neste dispositivo</p>
            <p className="mt-1 text-xs">
              Já existe uma conta cadastrada neste dispositivo. Caso já tenha uma conta, você pode{" "}
              <Link href="/entrar" className="font-semibold underline">
                fazer login aqui
              </Link>
              . O período de teste de 30 dias é concedido apenas para novos usuários.
            </p>
          </Callout>
        </div>
      ) : null}

      <div className="mt-6 space-y-2">
        <GoogleSignInButton label="Criar conta com o Google" />
        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
          Ao continuar com o Google você aceita os{" "}
          <Link href="/termos" className="underline underline-offset-2">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className="underline underline-offset-2">
            Política de Privacidade
          </Link>
          . Seu grupo é criado com um nome que você pode trocar depois.
        </p>
      </div>

      <AuthDivider>ou crie com e-mail e senha</AuthDivider>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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

        <div>
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register("email")}
          />
          {emailSuggestion ? (
            <p className="mt-1 text-xs text-[color:var(--color-brand-700)]">
              Você quis dizer{" "}
              <button
                type="button"
                className="font-bold underline cursor-pointer"
                onClick={() => {
                  setValue("email", emailSuggestion, { shouldValidate: true });
                  setEmailSuggestion(null);
                }}
              >
                {emailSuggestion}
              </button>
              ? Clique para corrigir.
            </p>
          ) : null}
        </div>

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
