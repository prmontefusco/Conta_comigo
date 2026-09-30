import type { Metadata } from "next";
import { Bullets, Callout, ContentPage, Section, Steps } from "@/components/content-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Educação financeira para filhos: atividades por idade",
  description:
    "Ensine crianças e adolescentes a gastar, guardar, doar e planejar com mesada, combinados e atividades adequadas à idade.",
  path: "/educacao-financeira-para-filhos",
});

export default function Page() {
  return (
    <ContentPage
      title="Como ensinar seus filhos sobre dinheiro"
      intro="Crianças aprendem mais ao tomar pequenas decisões com acompanhamento do que ao ouvir longas palestras. O objetivo não é criar medo de gastar: é formar autonomia, paciência e senso de prioridade."
    >
      <Section heading="1. Comece com quatro destinos simples">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Gastar", "Escolhas do dia a dia"],
            ["Guardar", "Metas maiores"],
            ["Compartilhar", "Doar ou presentear"],
            ["Planejar", "Custos futuros"],
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-xl border border-[color:var(--card-border)] p-3 text-center"
            >
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
        <p>
          Os percentuais não precisam ser iguais. Uma divisão fixa, como 50% para gastar, 40% para
          guardar e 10% para compartilhar, pode ser um ponto de partida — depois a família ajusta à
          idade, às metas e aos próprios valores.
        </p>
      </Section>

      <Section heading="2. Mesada não precisa ser salário por tarefa">
        <p>
          Tarefas básicas fazem parte da convivência familiar. Você pode usar uma mesada regular
          para treinar planejamento e oferecer pagamentos extras apenas por trabalhos realmente
          adicionais e previamente combinados. O valor deve caber no orçamento dos adultos e ter
          regras claras.
        </p>
        <Callout title="Evite o “imposto da casa” obrigatório" tone="warning">
          <p>
            Cobrar da criança uma parcela fictícia das despesas pode ensinar orçamento, mas também
            gerar insegurança. Prefira uma contribuição simbólica e voluntária para uma meta
            coletiva, com transparência e participação na decisão.
          </p>
        </Callout>
      </Section>

      <Section heading="3. Um método prático em quatro passos">
        <Steps
          items={[
            {
              title: "Escolham uma meta",
              body: "Dê nome, preço e data ao que a criança deseja comprar.",
            },
            {
              title: "Separem o dinheiro",
              body: "Use potes, envelopes ou saldos visuais para cada finalidade.",
            },
            {
              title: "Façam a conta juntos",
              body: "Mostre quantas semanas ou mesadas serão necessárias.",
            },
            {
              title: "Conversem sem resgatar",
              body: "Se o dinheiro acabar, acolha a frustração e espere o próximo ciclo.",
            },
          ]}
        />
      </Section>

      <Section heading="4. Atividades por fase">
        <Bullets
          items={[
            "Dos 4 aos 7: reconhecer moedas e notas, brincar de mercado e escolher entre dois itens.",
            "Dos 8 aos 11: controlar pequenos valores, comparar preços e acompanhar uma meta de curto prazo.",
            "Dos 12 aos 15: montar orçamento, entender compras por impulso, publicidade, Pix e golpes digitais.",
            "Dos 16 aos 18: conhecer juros, crédito, impostos, conta bancária, trabalho e investimentos sem promessas de ganho fácil.",
          ]}
        />
      </Section>

      <Section heading="5. Conversas que protegem">
        <Bullets
          items={[
            "Dinheiro é assunto de família, mas a criança não deve carregar a ansiedade financeira dos adultos.",
            "Nunca use dívida, renda ou consumo para humilhar ou comparar irmãos.",
            "Ensine que publicidade e influenciadores tentam provocar desejo e urgência.",
            "Explique que senhas, códigos e documentos nunca devem ser enviados a desconhecidos.",
            "Mostre os próprios erros de forma adequada à idade: corrigir decisões também é uma habilidade.",
          ]}
        />
      </Section>
    </ContentPage>
  );
}
