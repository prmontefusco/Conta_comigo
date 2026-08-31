# ADR 0010 — Preço é configuração, e o servidor é a única fonte dele

**Data:** 2026-08-31
**Estado:** aceito
**Relação:** detalha a [ADR 0009](0009-server-side-payments.md)

## Contexto

A assinatura custa R$ 5,00 por mês ou R$ 50,00 por ano. Esse número vai mudar —
por inflação, por concorrência, por promoção, por decisão de negócio tomada numa
tarde. Nenhuma dessas razões é técnica.

Havia três lugares plausíveis para guardá-lo:

1. **No código.** Simples de ler, e cada reajuste vira um commit, um code
   review, um build e um deploy. O preço passa a ser um problema de engenharia.
2. **No Firestore.** Editável em produção, mas o preço vira um documento que
   precisa de regra própria, de cache e de um caminho de erro para quando a
   leitura falhar — no meio do checkout.
3. **Em variáveis de ambiente.** Editável sem tocar no código, lido sem I/O,
   versionado junto de `apphosting.yaml`.

Há uma segunda pergunta, independente: se o navegador precisa mostrar o preço,
ele deveria receber uma cópia (`NEXT_PUBLIC_…`) ou perguntar ao servidor?

## Decisão

**Preço vive em variável de ambiente, em centavos inteiros**, e apenas no
servidor:

```
SUBSCRIPTION_PRICE_MONTHLY_CENTS=500
SUBSCRIPTION_PRICE_YEARLY_CENTS=5000
```

Centavos e não reais porque `"5.00"` e `"5,00"` são a mesma intenção e o mesmo
tropeço; um inteiro não tem separador decimal para errar. É a mesma razão pela
qual o domínio inteiro usa unidades menores ([ADR 0003](0003-money-as-integer-minor-units.md)).

**Um valor ausente ou inválido fecha a venda daquele ciclo.** Não vira zero, não
cai num padrão, não emite aviso e segue. `parsePlanPrice` devolve `null`,
`buildPlanCatalogue` omite o ciclo, e o checkout responde que o plano não está
disponível. É melhor não vender do que vender pelo preço errado.

**O navegador não recebe cópia do preço.** Ele consulta
`GET /api/assinatura/planos`, que lê o mesmo catálogo que o checkout usa para
cobrar. Uma variável `NEXT_PUBLIC_` criaria duas fontes que podem divergir, e a
divergência apareceria como uma tela anunciando um valor e uma fatura cobrando
outro.

**O corpo do checkout não tem campo de valor.** `checkoutRequestSchema` aceita
`cycle`, `method` e `cpfCnpj`, e nada mais. Não é validação: é ausência. Um
campo que não existe não precisa ser defendido.

## Consequências

Reajustar preço é editar `apphosting.yaml` e reimplantar. Não passa por revisão
de código, o que é adequado — não é uma decisão de código.

Um deploy sem as variáveis derruba a venda em vez de cobrar errado. É o
comportamento desejado, e é ruidoso o bastante para ser notado: a tela diz que a
assinatura não está disponível.

Promoção por pessoa, cupom e preço regional **não cabem** neste desenho. Quando
forem necessários, o catálogo passa a ser dado — e aí a opção 2 volta à mesa,
com a regra e o caminho de erro que ela exige. Este ADR não fecha essa porta;
apenas não paga hoje o custo de abri-la.
