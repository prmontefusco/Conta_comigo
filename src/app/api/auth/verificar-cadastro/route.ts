import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { describeError, logger } from "@/lib/observability/logger";
import {
  isDeviceInCooldown,
  calculateCooldownDaysRemaining,
  SIGNUP_COOLDOWN_MS,
} from "@/modules/auth/domain/device-fingerprint";
import { validateEmailForSignup } from "@/modules/auth/domain/email-validation";
import { checkSharedRateLimit } from "@/server/rate-limit-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Limite de até 3 novos cadastros por IP a cada 24 horas. */
const IP_SIGNUP_LIMIT = 3;
const IP_WINDOW_MS = 24 * 60 * 60 * 1000;

const requestSchema = z.object({
  email: z.string().trim().min(1, "E-mail não informado."),
  deviceHash: z.string().trim().min(4).max(64).optional(),
  action: z.enum(["CHECK", "RECORD"]).default("CHECK"),
});

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const candidate = forwarded.split(",")[0]?.trim();
    if (candidate) return candidate;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  // 1. Limitação de taxa de cadastros por IP
  const ipRateLimit = await checkSharedRateLimit(`signup_ip:${ip}`, IP_SIGNUP_LIMIT, IP_WINDOW_MS);

  if (!ipRateLimit.allowed) {
    logger.warn("Tentativa de cadastro bloqueada por limite de IP.", {
      operation: "verificar-cadastro",
      ip,
    });
    return NextResponse.json(
      {
        allowed: false,
        error: "IP_RATE_LIMITED",
        message:
          "Muitas tentativas de cadastro a partir deste endereço IP. Aguarde antes de tentar novamente.",
      },
      {
        status: 429,
        headers: { "retry-after": String(ipRateLimit.retryAfterSeconds) },
      },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        allowed: false,
        error: "INVALID_REQUEST",
        message: "Dados de cadastro inválidos.",
      },
      { status: 400 },
    );
  }

  const { email, deviceHash, action } = parsed.data;

  // 2. Validação profunda de e-mail (descartáveis, formato, domínios fictícios)
  const emailValidation = validateEmailForSignup(email);
  if (!emailValidation.isValid) {
    return NextResponse.json(
      {
        allowed: false,
        error: emailValidation.status,
        message: emailValidation.message,
      },
      { status: 400 },
    );
  }

  // 3. Verificação de Cooldown por Dispositivo
  if (deviceHash) {
    try {
      const deviceDocRef = adminDb().collection("deviceRegistrations").doc(deviceHash);
      const snapshot = await deviceDocRef.get();

      if (snapshot.exists) {
        const data = snapshot.data();
        const lastSignupAt = typeof data?.lastSignupAt === "number" ? data.lastSignupAt : 0;
        const now = Date.now();

        if (action === "CHECK" && isDeviceInCooldown(lastSignupAt, SIGNUP_COOLDOWN_MS, now)) {
          const daysRemaining = calculateCooldownDaysRemaining(lastSignupAt, SIGNUP_COOLDOWN_MS, now);
          return NextResponse.json(
            {
              allowed: false,
              error: "DEVICE_COOLDOWN",
              daysRemaining,
              message:
                "Já existe uma conta recente cadastrada neste dispositivo. Entre com sua conta existente ou recupere seu acesso.",
            },
            { status: 403 },
          );
        }
      }

      // Se a ação for de gravação pós-sucesso no cadastro, atualiza o registro no Firestore
      if (action === "RECORD") {
        const now = Date.now();
        await deviceDocRef.set(
          {
            deviceHash,
            lastSignupAt: now,
            lastIp: ip,
            updatedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + SIGNUP_COOLDOWN_MS),
          },
          { merge: true },
        );

        return NextResponse.json({ success: true });
      }
    } catch (error) {
      // Fallback gracioso caso Firestore esteja indisponível: não quebra a UX do cliente
      logger.warn("Falha ao consultar registro de dispositivo no servidor.", {
        operation: "verificar-cadastro",
        deviceHash,
        ...describeError(error),
      });
    }
  }

  return NextResponse.json({
    allowed: true,
    normalizedEmail: emailValidation.normalizedEmail,
    suggestedCorrection: emailValidation.suggestedCorrection,
  });
}
