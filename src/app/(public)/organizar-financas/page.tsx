import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Como organizar as finanças quando tudo parece confuso",
  description:
    "Um roteiro prático para retomar o controle: levantar o que existe, separar o que é " +
    "compromisso do que é escolha e descobrir quanto realmente sobra.",
  alternates: { canonical: "/organizar-financas" },
};

export default function Page() {
  return (
    <ContentPage
      title="Como organizar as finanças quando tudo parece confuso"
      intro="Não começa por cortar gastos. Começa por enxergar. É impossível decidir bem sobre uma situação que você não consegue ver inteira."
    >
      <Section heading="Por que a confusão acontece">
        <p>
          Raramente o problema é uma única decisão ruim. Costuma ser um acúmulo: uma parcela aqui,
          uma anuidade ali, um aumento de aluguel, uma conta que mudou de valor. Cada item, sozinho,
          cabia. Somados, não cabem mais — e ninguém percebeu porque nunca estiveram todos na mesma
          tela.
        </p>
        <p>
          A sensação de estar perdido geralmente não vem de falta de disciplina. Vem de falta de
          visão de conjunto.
        </p>
      </Section>

      <Section heading="Passo 1: levante o que existe, sem julgar">
        <p>
          Anote tudo o que você tem e tudo o que deve, mesmo o que for desconfortável. Nesta etapa
          não se decide nada nem se corta nada. Só se olha.
        </p>
        <Bullets
          items={[
            "Onde está seu dinheiro: contas, poupança, carteira digital, dinheiro em espécie.",
            "O que entra: salário, benefícios, renda variável, aluguéis recebidos.",
            "O que sai todo mês: moradia, energia, água, internet, escola, transporte, alimentação.",
            "Cartões: limite, fechamento, vencimento e, principalmente, as parcelas em aberto.",
            "Dívidas: empréstimos, financiamentos, parcelamentos negociados, cheque especial.",
          ]}
        />
        <p>
          Parcelas futuras de cartão são a parte mais frequentemente esquecida. Elas já são dinheiro
          comprometido, mesmo que a fatura ainda não tenha chegado.
        </p>
      </Section>

      <Section heading="Passo 2: separe compromissos de escolhas">
        <p>
          Um aluguel e um jantar fora não são a mesma categoria de gasto, ainda que apareçam juntos
          no extrato. Vale marcar cada despesa como:
        </p>
        <Bullets
          items={[
            "Fixa: o valor é previsível e a obrigação já existe (aluguel, escola, plano de saúde).",
            "Variável: acontece todo mês, mas o valor oscila (energia, mercado, combustível).",
            "Eventual: aparece de vez em quando (IPVA, presentes, manutenção).",
          ]}
        />
        <p>
          Essa separação muda a conversa. Despesas fixas não se resolvem em uma semana; variáveis
          respondem rápido a mudanças de hábito; eventuais pedem reserva, não corte.
        </p>
      </Section>

      <Section heading="Passo 3: descubra quanto realmente sobra">
        <p>A conta que interessa não é receita menos despesas do mês passado. É:</p>
        <p className="rounded-lg border border-[color:var(--card-border)] p-4 text-sm">
          saldo atual − reservas protegidas − contas que ainda vencem no mês = o que você pode
          decidir usar
        </p>
        <p>
          Esse número costuma ser bem menor que o saldo bancário. Ver isso não é desanimador; é o
          que impede a próxima compra que não cabia.
        </p>
      </Section>

      <Section heading="Passo 4: olhe três meses à frente">
        <p>
          Quase todo aperto é previsível com antecedência. Um mês com IPVA, material escolar e a
          última parcela de um financiamento vai apertar — e isso já se sabe hoje.
        </p>
        <p>
          Projetar não muda o valor das contas. Muda o número de opções que você tem: com três meses
          de aviso, dá para ajustar; com três dias, quase sempre sobra só o crédito caro.
        </p>
      </Section>

      <Section heading="Passo 5: construa uma reserva, mesmo pequena">
        <p>
          Uma reserva não precisa cobrir seis meses de despesas para servir. Cobrir uma troca de
          pneu ou uma consulta inesperada já evita que um imprevisto vire dívida rotativa.
        </p>
        <p>
          Guardar dinheiro não é gastar. É mudar o dinheiro de estado: de disponível para protegido.
          Ele continua sendo seu.
        </p>
      </Section>

      <Section heading="O que não ajuda">
        <Bullets
          items={[
            "Planilhas que exigem meia hora por semana: quase ninguém sustenta.",
            "Metas de corte drásticas logo no início, antes de entender de onde o dinheiro sai.",
            "Registrar cada café e ignorar as parcelas dos próximos oito meses.",
            "Confundir limite de cartão ou cheque especial com dinheiro disponível.",
          ]}
        />
      </Section>
    </ContentPage>
  );
}
