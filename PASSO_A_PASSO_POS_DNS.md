# 🚀 Passo a Passo Pós-Propagação de DNS: Lançamento do Conta Comigo

Este guia reúne exatamente o que você precisa executar assim que a propagação de DNS do domínio `contacomigo.api.br` for concluída.

---

## 📌 Índice de Ações
1. [Verificar se o DNS já propagou](#1-como-saber-se-o-dns-já-propagou)
2. [Concluir a Verificação no Google Search Console](#2-concluir-a-verificação-no-google-search-console)
3. [Enviar o Sitemap ao Google](#3-enviar-o-sitemap-ao-google)
4. [Solicitar Indexação Prioritária das Páginas Pilares](#4-solicitar-indexação-prioritária-das-páginas-pilares)
5. [Realizar o Deploy de Produção (Firebase)](#5-realizar-o-deploy-de-produção-firebase)
6. [Conferir e Ativar o Webhook no Painel do Asaas](#6-conferir-e-ativar-o-webhook-no-painel-do-asaas)
7. [Checklist Final de Saúde da Aplicação](#7-checklist-final-de-saúde-da-aplicação)

---

## 1. Como saber se o DNS já propagou?

Você não precisa esperar 24 horas às cegas. Na maioria dos casos, propaga em menos de 1 a 2 horas.

### Opção Rápida no Terminal (PowerShell):
Abra o PowerShell e digite:
```powershell
Resolve-DnsName -Type TXT contacomigo.api.br
```
Se a resposta contiver `google-site-verification=8wthYwMneAEpCHlAPegGy5TZixSp8EvZ2iaQVTddnWk`, o DNS **já está ativo em todo o mundo**.

### Opção pelo Navegador:
Acesse [WhatsMyDNS (Registro TXT de contacomigo.api.br)](https://www.whatsmydns.net/#TXT/contacomigo.api.br) e verifique se a maioria dos pontos no mapa mundial já exibe o sinal verde `✓`.

---

## 2. Concluir a Verificação no Google Search Console

Assim que o DNS responder positivamente:

1. Volte à aba do **Google Search Console** onde está a janela *"Verify domain ownership via DNS record"*.
2. Clique no botão **VERIFY** no canto inferior direito.
3. Você verá a mensagem verde: **"Ownership verified"** (Propriedade verificada).
4. Clique em **"Go to property"** (Ir para a propriedade).

> *Dica*: Caso dê erro de primeira, aguarde mais 15 a 30 minutos (tempo de cache do Google) e clique novamente em Verificar.

---

## 3. Enviar o Sitemap ao Google

Para que o Google comece a indexar imediatamente todas as 30+ páginas públicas e os guias sobre superendividamento:

1. No menu lateral esquerdo do Search Console, clique em **Sitemaps** (em "Indexação").
2. No campo **"Adicionar um novo sitemap"**, digite apenas:
   ```text
   sitemap.xml
   ```
3. Clique em **Enviar** (Submit).
4. O Google lerá o arquivo em `https://contacomigo.api.br/sitemap.xml` e exibirá o status **"Sucesso"**.

---

## 4. Solicitar Indexação Prioritária das Páginas Pilares

Não espere o robô do Google descobrir os conteúdos sozinho. Force o rastreamento das páginas principais para ranquear mais rápido:

1. No topo do Search Console, há uma barra de pesquisa: **"Inspecionar qualquer URL em contacomigo.api.br"**.
2. Cole cada uma das URLs abaixo (uma por vez), aperte `Enter` e clique no botão **"Solicitar indexação"**:
   - `https://contacomigo.api.br/`
   - `https://contacomigo.api.br/lei-do-superendividamento`
   - `https://contacomigo.api.br/minimo-existencial`
   - `https://contacomigo.api.br/como-provar-superendividamento`
   - `https://contacomigo.api.br/como-sair-das-dividas`
   - `https://contacomigo.api.br/orcamento-familiar`
   - `https://contacomigo.api.br/acao-de-repactuacao-de-dividas`

---

## 5. Realizar o Deploy de Produção (Firebase)

Como já configuramos `NEXT_PUBLIC_SITE_URL: https://contacomigo.api.br`, `NEXT_PUBLIC_ALLOW_INDEXING: "true"` e os segredos do Asaas no `apphosting.yaml`:

1. Salve e envie os commits mais recentes para a branch principal (`main`):
   ```bash
   git add .
   git commit -m "feat(prod): configuracao de dominio contacomigo.api.br, seo estruturado e verificacao google"
   git push origin main
   ```
2. O Firebase App Hosting iniciará o build automático de produção.
3. No [Console do Firebase](https://console.firebase.google.com/project/conta-comigo-a318a/apphosting), acompanhe o status até exibir **"Live / Pronto"**.
4. Verifique se o domínio customizado `contacomigo.api.br` está com o certificado SSL verde e ativo.

---

## 6. Conferir e Ativar o Webhook no Painel do Asaas

Para que as confirmações de pagamento via Pix, Boleto e Cartão liberem o plano Premium instantaneamente:

1. Acesse o painel do [Asaas](https://www.asaas.com/).
2. Vá em **Configurações** (ou Minha Conta) ➡️ **Integrações** ➡️ **Webhooks**.
3. Verifique a configuração da URL:
   - **URL do Webhook**: `https://contacomigo.api.br/api/webhook/pagamento`
   - **Email para notificações de erro**: Seu e-mail de administrador.
   - **Versão da API**: v3
   - **Token de Autenticação (`asaas-access-token`)**: Certifique-se de que o token informado aqui seja o mesmo cadastrado no segredo `PAYMENT_WEBHOOK_SECRET` do Firebase.
4. **Eventos que devem ser marcados**:
   - `PAYMENT_RECEIVED` (Pagamento recebido)
   - `PAYMENT_CONFIRMED` (Pagamento confirmado)
   - `PAYMENT_OVERDUE` (Pagamento vencido)
   - `PAYMENT_DELETED` (Pagamento cancelado)
5. Clique em **Salvar** e, se desejar, utilize o botão **"Enviar teste"** do Asaas para confirmar que sua API responde com HTTP `200 OK`.

---

## 7. Checklist Final de Saúde da Aplicação

Antes de divulgar amplamente nas redes e anúncios, faça essa checagem rápida pelo celular e pelo computador:

- [ ] Acessar `https://contacomigo.api.br` e ver se o cadeado SSL (HTTPS) está ativo.
- [ ] Testar a instalação do PWA no celular ("Adicionar à tela inicial" ou "Instalar aplicativo").
- [ ] Acessar `https://contacomigo.api.br/robots.txt` e checar se `Allow: /` e o link do `sitemap.xml` aparecem limpos.
- [ ] Acessar `https://contacomigo.api.br/sitemap.xml` e checar se todas as rotas públicas estão listadas.
- [ ] Criar uma conta de teste real e testar a geração do Dossiê de Superendividamento em `/app/superendividamento`.
- [ ] Simular um pagamento no valor de R$ 11,99 para confirmar a ativação imediata do Plano Premium.

---

🎉 **Pronto! Com esses passos, o Conta Comigo estará completamente no ar, cobrando com segurança e escalando organicamente nas buscas do Google.**
