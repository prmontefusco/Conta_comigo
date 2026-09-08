import { describe, expect, it } from "vitest";
import { validateEmailForSignup } from "./email-validation";

describe("validateEmailForSignup", () => {
  it("aceita e-mails legítimos de provedores comuns", () => {
    const validEmails = [
      "usuario@gmail.com",
      "contato@empresa.com.br",
      "maria.silva@outlook.com",
      "joao123@yahoo.com.br",
      "ana@icloud.com",
      "dev@proton.me",
    ];

    for (const email of validEmails) {
      const result = validateEmailForSignup(email);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe("VALID");
      expect(result.normalizedEmail).toBe(email.toLowerCase());
    }
  });

  it("bloqueia e-mails descartáveis e temporários conhecidos", () => {
    const disposable = [
      "teste@mailinator.com",
      "anonimo@guerrillamail.com",
      "user@10minutemail.com",
      "fake@yopmail.com",
      "alguem@sharklasers.com",
      "test@tempmail.com",
      "drop@trashmail.com",
      "temp@dispostable.com",
    ];

    for (const email of disposable) {
      const result = validateEmailForSignup(email);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe("DISPOSABLE_DOMAIN");
      expect(result.message).toContain("temporários ou descartáveis não são permitidos");
    }
  });

  it("bloqueia padrões suspeitos de domínios descartáveis", () => {
    const suspicious = [
      "user@my-tempmail-service.com",
      "alvo@throwaway-box.org",
      "spam@disposable-inbox.net",
    ];

    for (const email of suspicious) {
      const result = validateEmailForSignup(email);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe("SUSPICIOUS_DOMAIN");
    }
  });

  it("bloqueia domínios de teste e reservados", () => {
    const reserved = [
      "usuario@example.com",
      "teste@test.com",
      "admin@teste.com.br",
      "fulano@localhost",
      "teste@invalid",
      "fake@asdf.com",
    ];

    for (const email of reserved) {
      const result = validateEmailForSignup(email);
      expect(result.isValid).toBe(false);
    }
  });

  it("rejeita formatos malformados e sem TLD válido", () => {
    const invalid = [
      "",
      "sem-arroba",
      "@semusuario.com",
      "semdominio@",
      "espaco no meio@gmail.com",
      "usuario@dominio.123",
      "usuario@dominio.c",
    ];

    for (const email of invalid) {
      const result = validateEmailForSignup(email);
      expect(result.isValid).toBe(false);
    }
  });

  it("sugere correções para erros de digitação comuns", () => {
    const typoResult = validateEmailForSignup("maria@gmil.com");
    expect(typoResult.isValid).toBe(true);
    expect(typoResult.suggestedCorrection).toBe("maria@gmail.com");

    const hotmailTypo = validateEmailForSignup("joao@hotmial.com");
    expect(hotmailTypo.isValid).toBe(true);
    expect(hotmailTypo.suggestedCorrection).toBe("joao@hotmail.com");
  });

  it("rejeita e-mails com limites de tamanho excedidos", () => {
    const longLocal = "a".repeat(65) + "@gmail.com";
    expect(validateEmailForSignup(longLocal).isValid).toBe(false);

    const longDomain = "user@" + "a".repeat(250) + ".com";
    expect(validateEmailForSignup(longDomain).isValid).toBe(false);
  });
});
