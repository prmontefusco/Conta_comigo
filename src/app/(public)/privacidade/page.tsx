import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o Conta comigo trata seus dados financeiros, o que nunca é compartilhado com " +
    "anunciantes e como exercer seus direitos previstos na LGPD.",
  alternates: { canonical: "/privacidade" },
};

export default function Page() {
  return (
    <ContentPage
      title="Política de Privacidade"
      intro="Dados financeiros são dos mais sensíveis que existem. Esta página explica, sem rodeios, o que fazemos e o que não fazemos com os seus."
      cta={false}
    >
      <Section heading="Resumo">
        <Bullets
          items={[
            "Suas informações financeiras nunca são enviadas a anunciantes ou redes de publicidade.",
            "Nenhum dado financeiro é usado para segmentar anúncios.",
            "Ninguém fora do seu grupo familiar tem acesso aos seus dados.",
            "Você pode exportar ou excluir sua conta e seus dados a qualquer momento.",
            "Não vendemos dados pessoais.",
          ]}
        />
      </Section>

      <Section heading="Quais dados coletamos">
        <p>Dados que você fornece:</p>
        <Bullets
          items={[
            "Cadastro: nome, e-mail e senha (a senha é guardada apenas na forma criptografada pelo Firebase Authentication e nunca é visível para nós).",
            "Grupo familiar: nome do grupo, membros e papéis.",
            "Informações financeiras: contas e saldos, receitas, despesas, cartões, compras, faturas, dívidas, reservas, metas e orçamentos.",
          ]}
        />
        <p>Dados coletados automaticamente:</p>
        <Bullets
          items={[
            "Registros técnicos necessários para operar e proteger o serviço, como data e origem de acesso.",
            "Dados de uso agregados, sem conteúdo financeiro, para entender quais telas são utilizadas.",
          ]}
        />
        <p>
          Não coletamos dados bancários de acesso, senhas de bancos, números completos de cartão nem
          credenciais de instituições financeiras. O aplicativo não se conecta às suas contas
          bancárias.
        </p>
      </Section>

      <Section heading="Para que usamos">
        <Bullets
          items={[
            "Operar o serviço: calcular saldos, compromissos e projeções e apresentá-los a você.",
            "Manter sua conta segura e prevenir acessos indevidos.",
            "Cumprir obrigações legais.",
            "Melhorar o produto, com base em dados de uso agregados e não identificáveis.",
          ]}
        />
        <p>
          A base legal para o tratamento é a execução do contrato entre você e o Conta comigo e,
          quando aplicável, o seu consentimento e o cumprimento de obrigações legais, nos termos da
          Lei nº 13.709/2018 (LGPD).
        </p>
      </Section>

      <Section heading="Publicidade">
        <p>
          A versão gratuita exibe anúncios do Google AdSense. Sobre isso, três compromissos
          concretos:
        </p>
        <Bullets
          items={[
            "Nenhuma informação financeira sua é enviada à rede de anúncios: nem saldos, nem renda, nem dívidas, nem categorias, nem nomes de contas, nem valores de parcelas.",
            "Nenhum comportamento financeiro individual é usado como parâmetro de segmentação.",
            "Anúncios nunca são exibidos dentro de formulários, ao lado de botões de ação, entre um rótulo e seu campo, nem de forma que possa ser confundida com recomendação financeira.",
          ]}
        />
        <p>
          O Google, como fornecedor terceiro, pode utilizar cookies para exibir anúncios com base em
          visitas anteriores a este e a outros sites. Você pode desativar a publicidade
          personalizada nas configurações de anúncios do Google.
        </p>
      </Section>

      <Section heading="Com quem compartilhamos">
        <p>
          Compartilhamos dados apenas com os provedores de infraestrutura necessários para o serviço
          funcionar, e apenas na medida necessária:
        </p>
        <Bullets
          items={[
            "Google Firebase (autenticação, banco de dados e hospedagem), como operador dos dados.",
            "Google AdSense, exclusivamente para exibição de anúncios e sem receber qualquer dado financeiro.",
          ]}
        />
        <p>Não vendemos, alugamos nem cedemos dados pessoais a terceiros.</p>
      </Section>

      <Section heading="Segurança">
        <Bullets
          items={[
            "Todo o tráfego é criptografado em trânsito.",
            "O acesso aos dados é controlado por regras de segurança no banco de dados, verificadas por testes automatizados a cada alteração.",
            "Cada grupo familiar é isolado dos demais: pertencer a um grupo é a única forma de acessar seus dados.",
            "Registros técnicos não incluem valores financeiros nem credenciais.",
          ]}
        />
      </Section>

      <Section heading="Por quanto tempo guardamos">
        <p>
          Seus dados permanecem enquanto sua conta existir. Ao excluir a conta, os dados associados
          são removidos, exceto o mínimo que a lei exigir que seja mantido.
        </p>
      </Section>

      <Section heading="Seus direitos">
        <p>Pela LGPD, você pode a qualquer momento:</p>
        <Bullets
          items={[
            "Confirmar se tratamos dados seus e acessá-los.",
            "Corrigir dados incompletos ou desatualizados.",
            "Solicitar a exportação dos seus dados em formato legível por máquina.",
            "Solicitar a exclusão da conta e dos dados.",
            "Revogar consentimentos concedidos.",
            "Obter informação sobre com quem compartilhamos seus dados.",
          ]}
        />
        <p>
          As solicitações podem ser feitas pelas configurações da conta ou pelo canal de contato
          indicado nos Termos de Uso.
        </p>
      </Section>

      <Section heading="Cookies">
        <p>
          Usamos armazenamento local do navegador para manter você autenticado e lembrar
          preferências simples, como qual grupo você estava visualizando. Cookies de publicidade são
          de responsabilidade do Google e existem apenas na versão gratuita.
        </p>
      </Section>

      <Section heading="Menores de idade">
        <p>
          O serviço é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de
          crianças e adolescentes.
        </p>
      </Section>

      <Section heading="Alterações">
        <p>
          Mudanças relevantes nesta política serão comunicadas dentro do aplicativo antes de
          entrarem em vigor.
        </p>
      </Section>
    </ContentPage>
  );
}
