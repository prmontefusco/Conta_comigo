import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Orçamento familiar: dividir contas sem transformar dinheiro em briga",
  description:
    "Como separar despesas da casa das despesas pessoais, o que compartilhar entre membros da " +
    "família e por que planejado, comprometido e realizado são três números diferentes.",
  alternates: { canonical: "/orcamento-familiar" },
};

export default function Page() {
  return (
    <ContentPage
      title="Orçamento familiar"
      intro="Duas pessoas com a mesma renda e as mesmas contas podem discordar profundamente sobre dinheiro — quase sempre porque estão olhando números diferentes."
    >
      <Section heading="Nem tudo precisa ser compartilhado">
        <p>
          Numa casa existem gastos que são de todos e gastos que são de um. A conta de energia é da
          casa. A academia de alguém é dessa pessoa. Misturar as duas coisas produz discussões que
          não são sobre dinheiro, são sobre categoria.
        </p>
        <p>
          Marcar cada despesa como &quot;da casa&quot; ou &quot;pessoal&quot; permite ver o custo
          real da moradia sem que ele fique inflado por escolhas individuais, e permite que cada
          pessoa acompanhe as próprias sem prestar contas de tudo.
        </p>
      </Section>

      <Section heading="Papéis diferentes, acesso diferente">
        <p>
          Nem todo mundo precisa poder alterar tudo. Alguém que só quer acompanhar a situação pode
          ver sem editar; quem cuida do dia a dia registra pagamentos; quem administra gerencia
          membros e configurações.
        </p>
        <p>Isso não é desconfiança. É evitar edições acidentais e deixar claro quem fez o quê.</p>
      </Section>

      <Section heading="Três números, não dois">
        <p>
          A maioria dos orçamentos compara planejado com gasto. Falta o número do meio, que é o que
          muda decisões:
        </p>
        <Bullets
          items={[
            "Planejado: quanto vocês decidiram destinar à categoria neste mês.",
            "Comprometido: contas do mês que já existem e ainda não foram pagas.",
            "Realizado: o que já saiu.",
          ]}
        />
        <p>
          Com R$ 1.500 planejados para alimentação, R$ 900 já gastos e R$ 400 de uma compra
          parcelada caindo este mês, restam R$ 200 — e não R$ 600. Essa diferença é a origem de boa
          parte dos meses que &quot;estouram do nada&quot;.
        </p>
      </Section>

      <Section heading="Comece pelo que já existe">
        <p>
          Um orçamento montado a partir de números desejados quase sempre é abandonado no segundo
          mês. Um orçamento montado a partir da média real dos últimos meses tem chance de durar.
        </p>
        <p>
          Primeiro observe. Depois ajuste, uma categoria por vez, começando pela que mais incomoda
          os dois.
        </p>
      </Section>

      <Section heading="Conversas que funcionam melhor com números na mesa">
        <Bullets
          items={[
            "Quanto custa manter esta casa por mês, sem contar gastos pessoais?",
            "Quanto de cada renda vai para despesas compartilhadas?",
            "Quanto dos próximos três meses já está comprometido?",
            "Quanto conseguimos separar por mês sem apertar o essencial?",
            "Se uma renda cair, por quanto tempo a reserva sustenta a casa?",
          ]}
        />
        <p>
          Nenhuma dessas perguntas tem resposta certa. Todas ficam mais fáceis quando as duas
          pessoas estão olhando exatamente a mesma tela.
        </p>
      </Section>

      <Section heading="Uma reserva da casa e reservas pessoais">
        <p>
          Vale ter uma reserva compartilhada para o que afeta a todos — uma emergência médica, um
          eletrodoméstico que quebra, uma perda de renda — e permitir reservas individuais para
          objetivos de cada um.
        </p>
        <p>
          Ambas saem do saldo disponível e nenhuma é gasto. Continuam sendo patrimônio da família;
          só deixaram de estar em jogo.
        </p>
      </Section>
    </ContentPage>
  );
}
