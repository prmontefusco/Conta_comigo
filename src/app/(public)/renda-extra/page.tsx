import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Renda extra: ideias práticas e seguras para aumentar seu orçamento",
  description:
    "Estratégias reais, viáveis e de rápida execução para gerar dinheiro adicional honesto, estancar o aperto financeiro e acelerar a saída das dívidas.",
  alternates: { canonical: "/renda-extra" },
};

export default function Page() {
  return (
    <ContentPage
      title="Renda extra: como aumentar o dinheiro que entra"
      intro="Cortar gastos tem um limite biológico e prático: ninguém pode cortar mais de 100% das despesas. Mas o potencial de aumentar a renda não tem teto."
    >
      <Section heading="1. Por que focar na renda em momentos de aperto?">
        <p>
          Quando as contas estão muito apertadas, uma economia de R$ 50 exige um sacrifício enorme. Por outro lado,
          gerar R$ 300, R$ 500 ou R$ 1.000 a mais por mês no tempo livre pode liquidar dívidas meses mais rápido e
          devolver a tranquilidade à família.
        </p>
      </Section>

      <Section heading="2. O dinheiro parado dentro de casa (Desapego imediato)">
        <p>
          A forma mais rápida de fazer caixa em 48 horas é transformar itens parados em dinheiro vivo.
          Roupas em bom estado que não servem mais, móveis encostados, eletrônicos antigos, ferramentas e brinquedos
          das crianças podem ser anunciados em plataformas como OLX, Enjoei e Mercado Livre.
        </p>
        <p>
          Além de liberar espaço físico na casa e reduzir a sensação de sufoco, o valor arrecadado pode quitar
          imediatamente uma conta atrasada ou criar a sua primeira reserva de emergência.
        </p>
      </Section>

      <Section heading="3. Serviços baseados em habilidades que você já possui">
        <Bullets
          items={[
            "Alimentação e doces: marmitas fitness, bolos para o café da tarde, salgados sob encomenda para vizinhos e comércios locais.",
            "Aulas particulares e reforço: matemática, português, idiomas, música ou informática básica para crianças ou idosos.",
            "Serviços manuais e domésticos: pequenos reparos elétricos/hidráulicos ('marido de aluguel'), costura, jardinagem e organização de armários.",
            "Cuidados com animais (Pet sitting / Dog walking): passear com cachorros de vizinhos ou hospedar pets aos finais de semana.",
            "Prestação de serviços digitais: digitação, edição de vídeo para redes sociais, atendimento remoto e suporte ao cliente em plataformas freelance (Workana, 99Freelas).",
          ]}
        />
      </Section>

      <Section heading="4. Atenção aos golpes de 'dinheiro fácil'">
        <p>
          Em momentos de vulnerabilidade financeira, o desespero atrai golpistas. Desconfie imediatamente de:
        </p>
        <Bullets
          items={[
            "'Trabalhe em casa curtindo vídeos ou avaliando produtos e ganhe R$ 300 por dia': golpe de pirâmide e roubo de dados.",
            "Promessas de lucro garantido em apostas esportivas ('bets') ou jogos online: são desenhados matematicamente para você perder.",
            "Qualquer 'oportunidade de emprego' que exija que você pague uma taxa prévia para começar.",
          ]}
        />
      </Section>

      <Section heading="5. E se a renda extra for uma ponte para um emprego melhor?">
        <p>
          Muitas vezes, a necessidade de renda extra revela que o emprego atual paga abaixo do que você merece
          ou que sua área estagnou. Se você está desempregado ou busca uma vaga formal de trabalho com salário digno,
          é essencial ter um currículo profissional alinhado.
        </p>
        <p>
          Conheça nosso guia completo sobre{" "}
          <Link href="/como-procurar-emprego" className="font-medium text-teal-700 underline underline-offset-2">
            Como procurar emprego com método
          </Link>{" "}
          e confira como criar um currículo moderno e gratuito no{" "}
          <Link href="/como-fazer-curriculo" className="font-medium text-teal-700 underline underline-offset-2">
            Guia de Criação de Currículo
          </Link>
          .
        </p>
      </Section>
    </ContentPage>
  );
}
