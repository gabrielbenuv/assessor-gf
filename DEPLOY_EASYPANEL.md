# 🚀 Deploy no EasyPanel — passo a passo

Este guia sobe o Assessor GF no **EasyPanel** usando o **domínio grátis do próprio EasyPanel**
(não precisa de domínio próprio) e o **Postgres** dele. O EasyPanel **gera a imagem Docker
sozinho** a partir do `Dockerfile` quando você conecta o repositório — você **não precisa ter
Docker na sua máquina**.

> Tempo estimado: ~15 min. Você faz os cliques; o projeto já está 100% preparado.

---

## Pré-requisitos
- Conta no **GitHub** (grátis).
- Acesso ao seu **EasyPanel**.
- Sua **OpenAI API Key** e os dados da **Evolution** (URL, API Key, instância) — você já tem.

---

## Passo 0 — Código no GitHub ✅ (já feito)

O código já está publicado em (repositório privado):
**https://github.com/gabrielbenuv/assessor-gf** (branch `main`).

Para atualizações futuras, basta `git push` que o EasyPanel re-deploya.

---

## Passo 1 — Criar o banco Postgres no EasyPanel
1. No seu projeto do EasyPanel → **+ Service** → **Postgres**.
2. Nome: `assessor-db`. Defina uma **senha forte**.
3. Crie. Depois abra o serviço e anote a **connection string interna**, algo como:
   ```
   postgresql://postgres:SUA_SENHA@assessor-db:5432/postgres
   ```
   (o host é o nome do serviço; a porta interna é 5432.)

---

## Passo 2 — Criar o App (a partir do GitHub)
1. **+ Service** → **App**. Nome: `assessor-app`.
2. Em **Source**, escolha **GitHub**, conecte sua conta (autorize o EasyPanel a acessar o
   repositório `gabrielbenuv/assessor-gf`) e selecione a branch `main`.
3. Em **Build**, escolha **Dockerfile** (o EasyPanel detecta o `Dockerfile` automaticamente).
4. Em **Port / Network**, deixe a porta **3000** (é a que o app expõe).
5. **Ainda não faça deploy** — primeiro configure as variáveis (Passo 3).

---

## Passo 3 — Variáveis de ambiente do App
Na aba **Environment** do app `assessor`, cole (ajustando o que estiver em MAIÚSCULAS):

```env
DATABASE_URL=COLE_A_CONNECTION_URL_DO_PASSO_1
APP_SECRET=3e5f75091e127953c93474afe7334153ab33eeaa67f144992ff01d1c0b9b9538
ADMIN_EMAIL=pedrodantas@grupochess.com.br
ADMIN_PASSWORD=TROQUE_POR_UMA_SENHA_FORTE
TZ=America/Sao_Paulo
APP_URL=https://assessor.37.27.82.91.sslip.io
```

> O `DATABASE_URL` deve ser **a mesma string** que o EasyPanel mostra no serviço Postgres (Passo 1).
> O `APP_SECRET` acima já é uma chave aleatória válida (pode usar ou gerar outra).

---

## Passo 4 — Domínio (grátis, via sslip.io)
Como o servidor usa IP puro (37.27.82.91), usamos o **sslip.io** para ter uma URL com HTTPS
sem comprar domínio.
1. Na aba **Domains** do app `assessor-app` → **Add Domain**:
   ```
   assessor.37.27.82.91.sslip.io
   ```
   - Porta: **3000** · HTTPS/SSL: **ativado** (Let's Encrypt).
2. O `APP_URL` no Environment já está como `https://assessor.37.27.82.91.sslip.io`.
3. Salve.

---

## Passo 5 — Deploy e primeiro acesso
1. Clique em **Deploy**. O EasyPanel vai **buildar a imagem** (instala deps, gera o client
   Postgres, builda o Next) e subir. (Primeira vez leva alguns minutos.)
2. Quando ficar verde, acesse a **URL do Passo 4**.
3. Faça login com `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
4. No primeiro boot o app **cria as tabelas e as categorias padrão** sozinho.

---

## Passo 6 — Ligar o WhatsApp (webhook da Evolution) 🔌
É isto que faz o assessor **responder** no WhatsApp.
1. No painel do assessor → **Integrações / Chaves** → cole **OpenAI**, **Evolution (URL, API
   Key, instância)** e salve.
2. Na sua **Evolution**, configure o **webhook** da instância `assessor` para:
   ```
   https://assessor.37.27.82.91.sslip.io/api/webhook
   ```
   Evento: **messages.upsert** (mensagens recebidas).
3. No painel → **Números autorizados** → cadastre o **seu número** (com DDI+DDD).
4. Mande uma mensagem de teste no WhatsApp do bot. 🎉

---

## Passo 7 — Lembretes automáticos (cron) 🔔
Para o relatório mensal e os lembretes (cartão/contas fixas) dispararem:
1. EasyPanel → no app, aba **Scheduled Tasks** (ou um cron do sistema).
2. Comando, **de hora em hora** (`0 * * * *`):
   ```
   curl -s "https://assessor.37.27.82.91.sslip.io/api/cron/run?key=3e5f75091e127953c93474afe7334153ab33eeaa67f144992ff01d1c0b9b9538"
   ```
   (use o mesmo valor do `APP_SECRET`). O app decide a hora/dia certos conforme a aba **Notificações**.

---

## Passo 8 — Google Calendar (opcional)
1. No Google Cloud, crie credenciais **OAuth 2.0** e adicione o redirect URI:
   ```
   https://assessor.37.27.82.91.sslip.io/api/google/callback
   ```
2. No painel → **Integrações** → cole Client ID/Secret → **Conectar Google**.

---

## Atualizações futuras
Sempre que mudar o código: `git push`. No EasyPanel, clique em **Deploy** de novo (ou ative
auto-deploy). As tabelas são atualizadas automaticamente no boot.

## Resolução de problemas
- **Bot não responde:** confira o webhook na Evolution (Passo 6) e se o seu número está em
  *Números autorizados*. Veja os **Logs** do app no EasyPanel.
- **Erro de banco no boot:** confira o `DATABASE_URL` (host = nome do serviço Postgres).
- **500 ao usar IA:** confira a OpenAI Key em *Integrações*.
