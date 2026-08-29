/**
 * Firebase Auth error codes, translated.
 *
 * Two rules shape these messages. They never blame the person, and they never
 * reveal whether an email address exists in the system - that would turn the
 * login form into an account-enumeration oracle (docs/SECURITY.md).
 */
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-email":
      return "Esse endereço de e-mail não parece válido.";
    case "auth/missing-password":
      return "Informe sua senha.";
    case "auth/weak-password":
      return "Use uma senha com pelo menos 8 caracteres.";
    case "auth/email-already-in-use":
      // Deliberately vague: confirming the address exists would let anyone
      // test which emails have accounts here.
      return "Não foi possível criar a conta com esses dados. Se você já tem cadastro, entre na sua conta.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha não conferem.";
    case "auth/too-many-requests":
      return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
    case "auth/network-request-failed":
      return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
    case "auth/requires-recent-login":
      return "Por segurança, entre novamente antes de continuar.";
    default:
      return "Não foi possível concluir agora. Tente novamente em instantes.";
  }
}
