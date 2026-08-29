/**
 * Explicit result type for application use cases.
 *
 * Financial operations fail for mundane, expected reasons (insufficient
 * permission, an obligation already settled, a closed statement). Those are
 * modelled as values so the UI can render a specific, non-judgemental message,
 * instead of being thrown and caught generically.
 */

export type Result<T, E = AppError> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/** Unwraps or throws. Only for tests and for code paths that already checked. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(
    `Attempted to unwrap a failed Result: ${
      result.error instanceof Error ? result.error.message : JSON.stringify(result.error)
    }`,
  );
}

/* ------------------------------------------------------------------ */
/* Application errors                                                  */
/* ------------------------------------------------------------------ */

export type AppErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "UNAUTHENTICATED"
  | "CONFLICT"
  | "INVARIANT_VIOLATED"
  | "UNSUPPORTED"
  | "INFRASTRUCTURE_FAILURE";

export interface AppError {
  readonly code: AppErrorCode;
  /** Message intended for the person using the app, in pt-BR, never blaming. */
  readonly message: string;
  /** Machine-readable field-level detail for forms. */
  readonly details?: Readonly<Record<string, string[]>>;
  /** Internal context. Never rendered, never logged with financial values. */
  readonly cause?: unknown;
}

export function appError(
  code: AppErrorCode,
  message: string,
  extra: { details?: Readonly<Record<string, string[]>>; cause?: unknown } = {},
): AppError {
  return { code, message, ...extra };
}

export const validationError = (
  message: string,
  details?: Readonly<Record<string, string[]>>,
): AppError => appError("VALIDATION_FAILED", message, details ? { details } : {});

export const notFound = (message: string): AppError => appError("NOT_FOUND", message);

export const permissionDenied = (message: string): AppError =>
  appError("PERMISSION_DENIED", message);

export const conflict = (message: string): AppError => appError("CONFLICT", message);

export const invariantViolated = (message: string): AppError =>
  appError("INVARIANT_VIOLATED", message);
