/**
 * Validação rigorosa e sanitização de e-mails para cadastro.
 *
 * Previne a criação de contas com e-mails descartáveis, temporários,
 * domínios fictícios de teste ou com erros graves de digitação.
 */

/**
 * Lista curada dos principais provedores de e-mail temporário/descartável.
 */
export const DISPOSABLE_DOMAINS = new Set([
  // Mailinator & aliases
  "mailinator.com",
  "mailinater.com",
  "suremail.info",
  "binkmail.com",
  "safetymail.info",
  "chogmail.com",
  "spamherelots.com",
  "bobmail.info",
  "notmailinator.com",
  "veryrealemail.com",
  // Guerrilla Mail & aliases
  "guerrillamail.com",
  "guerrillamailblock.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "sharklasers.com",
  "grr.la",
  "pokemail.net",
  "spam4.me",
  // 10 Minute Mail
  "10minutemail.com",
  "10minutemail.net",
  "10minemail.com",
  "10minutemail.org",
  // YopMail & aliases
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "cool.fr.nf",
  "jetable.fr.nf",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  // TempMail & clones
  "tempmail.com",
  "temp-mail.org",
  "tempmail.net",
  "tempmailaddress.com",
  "temp-mail.io",
  "tempmail.ninja",
  "tempail.com",
  "dispostable.com",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.net",
  "trashmail.org",
  "fakeinbox.com",
  "fakemailgenerator.com",
  "getnada.com",
  "maildrop.cc",
  "inboxkitten.com",
  "emailondeck.com",
  "mohmal.com",
  "crazymailing.com",
  "mintemail.com",
  "generator.email",
  "disposablemail.com",
  "burnerdelivery.com",
  "burnermail.io",
  "dropmail.me",
  "getairmail.com",
  "mytemp.email",
  "anonymousemail.me",
  "tmail.ws",
  "minuteinbox.com",
  "mailcatch.com",
  "nada.ltd",
  "inboxbear.com",
  "tempinbox.com",
]);

/**
 * Domínios fictícios, reservados pelo RFC 2606 ou frequentemente usados em testes falsos.
 */
export const RESERVED_OR_TEST_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "example.edu",
  "test.com",
  "teste.com",
  "teste.com.br",
  "localhost",
  "invalid",
  "local",
  "asdf.com",
  "sample.com",
  "fakemail.com",
  "naoexiste.com",
  "naoexiste.com.br",
]);

/**
 * Mapa de correções de digitação frequentes para provedores populares.
 */
export const COMMON_TYPO_DOMAINS: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gmil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmeil.com": "gmail.com",
  "gmail.com.br": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlock.com": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yaho.com.br": "yahoo.com.br",
  "icoud.com": "icloud.com",
  "iclud.com": "icloud.com",
};

export type EmailValidationStatus =
  | "VALID"
  | "INVALID_FORMAT"
  | "DISPOSABLE_DOMAIN"
  | "RESERVED_DOMAIN"
  | "SUSPICIOUS_DOMAIN"
  | "INVALID_TLD";

export interface EmailValidationResult {
  readonly isValid: boolean;
  readonly status: EmailValidationStatus;
  readonly message?: string;
  readonly normalizedEmail: string;
  readonly domain: string;
  readonly suggestedCorrection?: string;
}

/**
 * Regex RFC 5322 simplificada e compatível com navegadores modernos.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Valida a legitimidade de um e-mail antes do cadastro.
 */
export function validateEmailForSignup(rawEmail: string): EmailValidationResult {
  const normalized = rawEmail.trim().toLowerCase();

  if (!normalized || !EMAIL_REGEX.test(normalized)) {
    return {
      isValid: false,
      status: "INVALID_FORMAT",
      message: "Formato de e-mail inválido. Verifique o endereço digitado.",
      normalizedEmail: normalized,
      domain: "",
    };
  }

  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return {
      isValid: false,
      status: "INVALID_FORMAT",
      message: "O e-mail deve conter exatamente um '@'.",
      normalizedEmail: normalized,
      domain: "",
    };
  }

  const [localPart, domain] = parts;
  if (!localPart || !domain) {
    return {
      isValid: false,
      status: "INVALID_FORMAT",
      message: "Formato de e-mail incompleto.",
      normalizedEmail: normalized,
      domain: domain ?? "",
    };
  }

  if (localPart.length === 0 || localPart.length > 64) {
    return {
      isValid: false,
      status: "INVALID_FORMAT",
      message: "O nome de usuário do e-mail é inválido.",
      normalizedEmail: normalized,
      domain,
    };
  }

  if (domain.length < 3 || domain.length > 255) {
    return {
      isValid: false,
      status: "INVALID_FORMAT",
      message: "O domínio do e-mail é inválido.",
      normalizedEmail: normalized,
      domain,
    };
  }

  // Verificar TLD (Top-Level Domain)
  const domainParts = domain.split(".");
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return {
      isValid: false,
      status: "INVALID_TLD",
      message: "O final do e-mail (extensão do domínio) é inválido.",
      normalizedEmail: normalized,
      domain,
    };
  }

  // Checar domínios reservados ou de teste
  if (RESERVED_OR_TEST_DOMAINS.has(domain)) {
    return {
      isValid: false,
      status: "RESERVED_DOMAIN",
      message: "Por favor, informe um endereço de e-mail real e acessível.",
      normalizedEmail: normalized,
      domain,
    };
  }

  // Checar provedores de e-mail descartável/temporário
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      isValid: false,
      status: "DISPOSABLE_DOMAIN",
      message:
        "E-mails temporários ou descartáveis não são permitidos. Use seu e-mail principal para garantir acesso à sua conta.",
      normalizedEmail: normalized,
      domain,
    };
  }

  // Checar padrões heurísticos suspeitos em domínios descartáveis
  const isSuspiciousPattern =
    domain.includes("tempmail") ||
    domain.includes("throwaway") ||
    domain.includes("disposable") ||
    domain.includes("fakemail") ||
    domain.includes("trashmail") ||
    domain.includes("guerrillamail") ||
    domain.includes("10minute");

  if (isSuspiciousPattern) {
    return {
      isValid: false,
      status: "SUSPICIOUS_DOMAIN",
      message: "Este provedor de e-mail parece temporário. Utilize um e-mail válido e permanente.",
      normalizedEmail: normalized,
      domain,
    };
  }

  // Verificar se há sugestão de typo
  let suggestedCorrection: string | undefined;
  if (COMMON_TYPO_DOMAINS[domain]) {
    suggestedCorrection = `${localPart}@${COMMON_TYPO_DOMAINS[domain]}`;
  }

  return {
    isValid: true,
    status: "VALID",
    normalizedEmail: normalized,
    domain,
    suggestedCorrection,
  };
}
