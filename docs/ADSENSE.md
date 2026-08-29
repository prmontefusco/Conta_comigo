# Publicidade

## Modelo

**FREE** — funcionalidades principais, com anúncios do Google AdSense.
**PREMIUM** — sem anúncios. Arquitetura preparada; cobrança não implementada.

`plan = FREE | PREMIUM` vive em `users/{uid}`, é imutável pelo cliente (as
regras impedem a alteração) e será escrito pelo fluxo de cobrança quando existir.

## A regra que não se negocia

**Nenhuma informação financeira do usuário chega a qualquer serviço de
publicidade.** Nem como parâmetro de segmentação, nem como canal personalizado,
nem na URL.

Isso inclui: saldo, renda, dívidas, despesas, categorias, nomes de contas, dados
familiares, informações de cartão, valores de parcelas e comportamento
financeiro individual.

Como isso é garantido na prática: **`AdSlot` não recebe nenhuma prop
financeira.** Sua interface inteira é:

```ts
interface AdSlotProps {
  placement: AdPlacement;
  slotId?: string;
  hidden?: boolean;
}
```

Não há o que vazar, porque não há o que passar. É uma garantia estrutural, não
uma promessa de code review.

## Desenvolvimento nunca carrega anúncio real

```ts
const shouldLoadRealAds =
  firebaseEnv.adsEnabled &&
  process.env.NODE_ENV === "production" &&
  Boolean(firebaseEnv.adsenseClientId) &&
  Boolean(slotId);
```

As quatro condições precisam ser verdadeiras. Localmente, `NODE_ENV` não é
`production` e `NEXT_PUBLIC_ADS_ENABLED` é `false`, então renderiza-se um
placeholder:

```
[ Espaço publicitário ]
```

Nenhuma requisição sai da máquina do desenvolvedor. `AdSenseScript` também não
renderiza nada fora de produção.

## Posicionamento

Anúncio nunca deve competir com uma decisão financeira nem ser confundido com
uma recomendação.

**Nunca:**

- parecendo botão;
- próximo demais de ações críticas;
- entre um rótulo e seu campo;
- dentro de formulários;
- de forma que provoque clique acidental;
- encobrindo informação;
- simulando recomendação financeira.

**Posições permitidas** (`AdPlacement`):

| Placement          | Onde                                            |
| ------------------ | ----------------------------------------------- |
| `dashboard-inline` | Entre dois blocos informativos do painel        |
| `app-rail`         | Lateral, apenas em desktop                      |
| `content-footer`   | Depois do corpo do artigo, nas páginas públicas |

No painel, o único anúncio fica entre "Este mês" e "Próximos 30 dias" — dois
blocos de leitura, longe de qualquer botão de ação.

Nas páginas de conteúdo, o anúncio fica **depois** do artigo inteiro, nunca no
meio do texto.

Todo anúncio real é rotulado com "Publicidade" acima dele.

## Configuração

| Variável                        | Local   | Produção     |
| ------------------------------- | ------- | ------------ |
| `NEXT_PUBLIC_ADS_ENABLED`       | `false` | `true`       |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | vazio   | `ca-pub-...` |

Definidas em `.env.development` e `apphosting.emulator.yaml` (local) e em
`apphosting.yaml` (produção).

## ads.txt

Servido por `src/app/ads.txt/route.ts`, gerado a partir do publisher id
configurado — não é um arquivo estático commitado. Assim um build de
desenvolvimento nunca publica um publisher id real.

Fora de produção, responde:

```
# Sem publicidade configurada neste ambiente.
```

## Site público

O site público existe para descoberta orgânica e para dar contexto ao produto.
As páginas são conteúdo original e útil, escritas para serem lidas.

Não foram geradas dezenas de páginas artificiais para ocupar palavras-chave. O
`sitemap.ts` lista dez URLs, todas com conteúdo que responde a uma pergunta
real.

A área autenticada é `noindex` e está bloqueada no `robots.txt`.

## Consentimento

O Google, como fornecedor terceiro, pode usar cookies para exibir anúncios com
base em visitas anteriores. Isso está declarado em `/privacidade`, junto com o
caminho para desativar publicidade personalizada nas configurações do Google.

Um mecanismo de consentimento (CMP) será necessário antes de operar em mercados
que o exijam. Ainda não implementado — está no [`ROADMAP.md`](ROADMAP.md).

Nenhum dark pattern: nada de recusa escondida atrás de vários cliques, nada de
botão de aceitar mais destacado que o de recusar.

## Checklist antes de ativar em produção

- [ ] Conta AdSense aprovada
- [ ] `NEXT_PUBLIC_ADSENSE_CLIENT_ID` no `apphosting.yaml`
- [ ] `ads.txt` acessível na raiz do domínio
- [ ] Ad units criadas e ids preenchidos por placement
- [ ] Revisão de posicionamento em telas reais, mobile e desktop
- [ ] Confirmação de que nenhuma requisição de anúncio carrega dado financeiro
- [ ] CMP, se o mercado exigir
- [ ] Política de privacidade revisada
