import "server-only";

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { describeError, logger } from "@/lib/observability/logger";

/**
 * Server-side authentication for the payments routes.
 *
 * The browser sends the Firebase ID token as a bearer; the Admin SDK verifies
 * its signature, issuer and expiry. Nothing else identifies the caller - a uid
 * in the body would just be a claim the caller made about themselves.
 *
 * `checkRevoked` is on so that signing out everywhere, or disabling an account,
 * takes effect immediately rather than at the token's natural expiry. It costs
 * a lookup, which is the right trade on a route that grants a paid plan.
 */

export interface AuthenticatedCaller {
  readonly uid: string;
  readonly email?: string;
  readonly name?: string;
}

export type AuthResult =
  { readonly caller: AuthenticatedCaller } | { readonly errorResponse: NextResponse };

export async function requireAuth(request: Request): Promise<AuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    return {
      errorResponse: NextResponse.json(
        { error: "UNAUTHENTICATED", message: "Entre na sua conta para continuar." },
        { status: 401 },
      ),
    };
  }

  try {
    const decoded = await adminAuth().verifyIdToken(token, true);

    return {
      caller: {
        uid: decoded.uid,
        ...(typeof decoded.email === "string" ? { email: decoded.email } : {}),
        ...(typeof decoded.name === "string" ? { name: decoded.name } : {}),
      },
    };
  } catch (error) {
    // The code is useful (expired, revoked, malformed); the token never is.
    logger.warn("Token rejeitado numa rota de pagamento.", {
      operation: "requireAuth",
      ...describeError(error),
    });

    return {
      errorResponse: NextResponse.json(
        { error: "UNAUTHENTICATED", message: "Sua sessão expirou. Entre novamente." },
        { status: 401 },
      ),
    };
  }
}
