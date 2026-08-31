import { z } from "zod";

/**
 * O que o cliente pode dizer ao abrir uma cobrança.
 *
 * Deliberadamente curto: ciclo, forma de pagamento e — quando o provedor exigir
 * — o CPF/CNPJ do pagador. Valor e identidade **não** estão aqui, e não estarem
 * é a proteção: o preço vem do catálogo do servidor e a pessoa vem do token.
 */
export const checkoutRequestSchema = z.object({
  cycle: z.enum(["MONTHLY", "YEARLY"]),
  method: z.enum(["PIX", "CARD"]),
  // Só dígitos: 11 (CPF) ou 14 (CNPJ). A máscara é assunto da interface.
  cpfCnpj: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value === "" || value.length === 11 || value.length === 14, {
      message: "Informe um CPF ou CNPJ válido.",
    })
    .optional(),
});

export type CheckoutRequestInput = z.infer<typeof checkoutRequestSchema>;
