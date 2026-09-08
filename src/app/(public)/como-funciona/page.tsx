import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Como funciona — Planejamento Financeiro e Lei do Superendividamento",
  description:
    "Descubra como o Conta Comigo organiza suas finanças em três dimensões de tempo, calcula o Mínimo Existencial e gera o Dossiê Técnico de Repactuação pela Lei 14.181/2021.",
  alternates: { canonical: "/como-funciona" },
};

export default function Page() {
  return (
    <ContentPage
      title="Como funciona o Conta Comigo"
      intro="Um método financeiro construído para transformar ansiedade em clareza: mostramos sua situação real sem distorcer números e fornecemos as ferramentas legais para proteger sua família contra o endividamento."
    >
      <Section heading="O que você conquista na prática com o aplicativo">
        <p>
          A maioria das pessoas se sente perdida com finanças não por falta de vontade, mas porque
          planilhas e aplicativos tradicionais apenas registram o passado (&quot;onde você gastou&quot;) sem
          fornecer nenhuma orientação prática para as decisões de hoje e de amanhã.
        </p>
        <p>Com o Conta Comigo, você conquista:</p>
        <Bullets
          items={[
            "Clareza do Saldo Livre Real: saiba exatamente quanto dinheiro pode gastar hoje sem comprometer boletos que vencem semana que vem ou sua reserva de emergência.",
            "Previsão de Meses no Vermelho: descubra apertos financeiros com 3 a 12 meses de antecedência, tempo suficiente para renegociar ou remanejar despesas.",
            "Simulador de Decisões: pergunte ao aplicativo se uma compra parcelada, um novo plano ou um corte de renda cabe no orçamento antes de tomar a decisão.",
            "Runway de Fôlego Financeiro: saiba por quantos meses sua família mantém o padrão essencial de vida caso a renda principal seja interrompida.",
            "Gestão Familiar sem Atritos: divida custos da residência com seu cônjuge com permissões personalizadas de privacidade.",
            "Proteção Jurídica contra Dívidas Abusivas: identifique se seu salário está sendo confiscado ilegalmente e gere o dossiê para repactuação.",
          ]}
        />
      </Section>

      {/* SEÇÃO PRINCIPAL: SUPERENDIVIDAMENTO */}
      <Section heading="Módulo de Proteção ao Superendividamento (Lei nº 14.181/2021)">
        <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-4 text-cyan-950 mb-4">
          <p className="font-semibold text-sm">
            ⚖️ Você sabia que a lei brasileira protege o seu salário contra o confisco bancário?
          </p>
          <p className="mt-1 text-xs text-cyan-800 leading-relaxed">
            A <strong>Lei nº 14.181/2021</strong> (conhecida como a Lei do Superendividamento) alterou o Código de Defesa do Consumidor
            para garantir que nenhuma família seja forçada a passar fome ou privações básicas para pagar juros abusivos e empréstimos consignados.
          </p>
        </div>

        <p>
          O Conta Comigo foi o primeiro sistema de gestão financeira a integrar integralmente os parâmetros
          do <strong>Mínimo Existencial (Decreto nº 11.567/2023)</strong> ao orçamento diário do consumidor.
        </p>

        <h3 className="mt-6 text-base font-bold text-neutral-900">
          1. Diagnóstico Automático e Proteção da Renda
        </h3>
        <p>
          O sistema cruza a renda líquida mensal do seu núcleo familiar com as despesas essenciais
          de subsistência (moradia, luz, água, alimentação, medicamentos contínuos e transporte) e o
          total de parcelas de dívidas cobradas no mês.
        </p>
        <p>
          Se o total cobrado pelos credores ultrapassar a margem que garante o sustento digno da família,
          o sistema classifica a situação e ativa o protocolo de proteção ao superendividamento.
        </p>

        <h3 className="mt-6 text-base font-bold text-neutral-900">
          2. Comprovação da Boa-Fé (Artigo 54-A do Código de Defesa do Consumidor)
        </h3>
        <p>
          Para que o juiz ou o conciliador conceda a repactuação das dívidas, a lei exige que o consumidor
          demonstre boa-fé — provando que contraiu as dívidas para a manutenção familiar e que não agiu
          com dolo ou fraude.
        </p>
        <p>
          O Conta Comigo permite que você registre os <strong>gastos que já cortou</strong> (cancelamento de assinaturas,
          interrupção de lazer, refeições fora de casa) e declare formalmente o motivo imprevisto da crise
          (perda de emprego, doença na família, juros compostos ou inflação).
        </p>

        <h3 className="mt-6 text-base font-bold text-neutral-900">
          3. O Dossiê Técnico para Juizado Especial, Defensoria ou Procon
        </h3>
        <p>
          Com um clique, o aplicativo consolida todos os dados em um <strong>Dossiê Técnico Contábil</strong> pronto
          para impressão e anexo processual, contendo:
        </p>
        <Bullets
          items={[
            "Qualificação Completa: nome, CPF, ocupação, endereço com CEP e lista de dependentes familiares.",
            "Declaração Formal de Boa-Fé com descrição fática da crise.",
            "Quadro Detalhado do Mínimo Existencial: despesas essenciais discriminadas e piso legal preservado.",
            "Comprovação de Esforço Próprio: relação de despesas e supérfluos já eliminados pelo consumidor.",
            "Relação de Credores e Dívidas: saldo devedor atualizado, número de parcelas e valor mensal.",
            "Plano de Pagamento e Rateio Equitativo: divisão proporcional da margem livre mensal entre todos os bancos, respeitando o prazo legal de até 5 anos e carência de até 180 dias.",
            "Fundamentação Técnica com Inteligência Artificial: redação jurídica e contábil contextualizada pronta para os autos.",
          ]}
        />

        <h3 className="mt-6 text-base font-bold text-neutral-900">
          4. Onde apresentar o seu Dossiê do Conta Comigo?
        </h3>
        <p>
          Com o documento impresso ou em PDF, você pode protocolar o pedido de repactuação em:
        </p>
        <Bullets
          items={[
            "Procon do seu município ou Estado: abertura de audiência de conciliação com a presença de todos os credores reunidos em bloco.",
            "Defensoria Pública Estadual (Núcleo de Defesa do Consumidor - NUDECON): assistência jurídica gratuita caso não possa arcar com advogado.",
            "CEJUSC (Centro Judiciário de Solução de Conflitos e Cidadania) ou Juizado Especial Cível (JEC): instauração do processo judicial de repactuação compulsória caso algum banco recuse a conciliação voluntária.",
          ]}
        />
      </Section>

      <Section heading="O Método dos Três Tempos: Passado, Presente e Futuro">
        <p>
          A maioria dos aplicativos financeiros olha apenas para o passado. Isso responde &quot;o que aconteceu?&quot;,
          mas não responde &quot;o que vai acontecer?&quot; — que é a pergunta fundamental para tomar decisões.
        </p>
        <p>O Conta Comigo combina três dimensões em tempo real:</p>
        <Bullets
          items={[
            "Passado: receitas confirmadas, contas pagas, transferências e faturas quitadas.",
            "Presente: saldo real em caixa, contas pendentes no mês, boletos vencidos e quanto está reservado.",
            "Futuro: salários previstos, contas recorrentes, parcelas do cartão, empréstimos e despesas sazonais (IPVA, IPTU).",
          ]}
        />
        <p>
          O valor real surge da combinação: partindo do saldo de hoje, somando o que entra e
          subtraindo o que já está contratado, o sistema calcula a projeção exata de cada mês.
        </p>
      </Section>

      <Section heading="Regras Contábeis Transparentes: Sem Distorção dos Fatos">
        <p>
          Muitos sistemas tratam qualquer movimentação como &quot;despesa&quot;. Isso produz números fantasiosos.
          No Conta Comigo seguimos princípios contábeis rigorosos:
        </p>
        <Bullets
          items={[
            "Transferência entre contas não é despesa: mover dinheiro da conta corrente para a poupança não empobrece você.",
            "Empréstimo não é receita: receber um empréstimo aumenta o dinheiro em caixa, mas cria uma obrigação futura correspondente.",
            "A fatura do cartão não é uma segunda despesa: as compras parceladas são registradas no mês do consumo, e o pagamento da fatura apenas liquida o compromisso bancário sem duplicar o gasto.",
            "Saldo total é diferente de saldo livre: o dinheiro que está guardado para emergências ou boletos da semana não pode ser considerado disponível para compras por impulso.",
          ]}
        />
      </Section>

      <Section heading="Como começar em 4 passos simples">
        <Bullets
          items={[
            "1. Crie sua conta gratuita: defina seu nome e o nome da sua família ou grupo familiar.",
            "2. Cadastre suas contas e saldo atual: informe onde seu dinheiro está (contas bancárias, carteira) e quanto tem hoje.",
            "3. Cadastre sua renda principal e contas fixas: salário, aluguel, energia, internet e condomínio.",
            "4. Acompanhe a projeção e seu diagnóstico: veja imediatamente o seu runway, a previsão dos próximos meses e se há necessidade de proteção por superendividamento.",
          ]}
        />
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/criar-conta"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[color:var(--color-brand-600)] px-6 font-semibold text-white shadow-md hover:bg-[color:var(--color-brand-700)]"
          >
            Criar conta e começar agora
          </Link>
          <Link
            href="/lei-do-superendividamento"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[color:var(--card-border)] bg-white px-6 font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Entenda a Lei 14.181/2021 &rarr;
          </Link>
        </div>
      </Section>
    </ContentPage>
  );
}
