# Assessor GF 💸

Assessor financeiro + agenda que conversa pelo **WhatsApp** (via Evolution API), entende
**texto, foto de recibo e áudio**, registra/categoriza **gastos e entradas**, controla
**bancos, cartões, vencimentos e saldo**, responde consultas e **agenda eventos no Google
Calendar**. Painel web para cadastrar tudo. Stack: **Next.js + Prisma + OpenAI**.

> Plano de produto e decisões: ver [PLANO_DE_ACAO.md](PLANO_DE_ACAO.md).

---

## 🚀 Rodar localmente (localhost, sem Docker)

Pré-requisitos: **Node 18+** (testado no Node 25).

```bash
# 1. Instalar dependências
npm install

# 2. Criar o banco local (SQLite) e popular categorias padrão
npm run setup        # = prisma generate + db push + seed

# 3. Subir o servidor
npm run dev
```

Acesse **http://localhost:3000** e entre com:

- **E-mail:** `admin@assessor.local`
- **Senha:** `admin123`

(definidos no `.env` — `ADMIN_EMAIL` / `ADMIN_PASSWORD`)

### Primeiros passos no painel
1. **Integrações** → cole sua **OpenAI API Key** e salve.
2. **Simulador** → teste: *"gastei 32 reais num hot dog hoje"*, *"quanto gastei essa semana?"*.
3. **Bancos / Cartões / Categorias** → cadastre suas contas (com saldo inicial) e cartões (fechamento + vencimento).
4. **Números autorizados** → cadastre seu número de WhatsApp (a IA só responde a esses).

> O **Simulador** funciona sem WhatsApp/Evolution — é a forma de "ver" o assessor agora.

---

## 🧱 Estrutura

```
prisma/schema.prisma   modelo de dados (Banco, Cartao, Categoria, Transacao, ...)
src/lib/               agent (IA+tools), finance, openai, evolution, google, dates, crypto...
src/app/api/           webhook do WhatsApp, simulador, CRUD, google oauth, config
src/app/(painel)/      telas do painel (dashboard, bancos, cartoes, ...)
Dockerfile             imagem de produção
docker-compose.yml     app + Postgres (para testar a imagem / referência EasyPanel)
```

### Ferramentas da IA
- **Finanças:** `registrar_transacao`, `consultar_gastos`, `consultar_saldo`, `fatura_em_aberto`
- **Agenda:** `criar_evento_agenda` (Google Calendar)

---

## 🐳 Docker / Produção (Postgres)

O build **troca o banco para Postgres automaticamente** (`scripts/gen-prod-schema.mjs` gera
`prisma/schema.prod.prisma` com `provider=postgresql`). Você **não precisa editar o schema**.
O desenvolvimento local continua em SQLite.

```bash
# Build da imagem (precisa de Docker instalado)
docker build -t assessor-gf .

# OU subir app + Postgres juntos (ajuste as senhas no docker-compose.yml antes):
docker compose up --build
```

> **Subindo no EasyPanel?** Veja o passo a passo completo em [DEPLOY_EASYPANEL.md](DEPLOY_EASYPANEL.md).

---

## ☁️ Subir no EasyPanel

1. **Postgres**: crie um serviço Postgres (template do EasyPanel). Anote host, usuário, senha e banco.
2. **Evolution API**: crie o serviço (template), conecte seu número (QR code) e anote `URL`, `API Key` e `Instância`.
3. **App (este projeto)**:
   - Crie um serviço a partir do repositório Git (ou suba a imagem `assessor-gf`).
   - Variáveis de ambiente:
     ```
     DATABASE_URL=postgresql://USUARIO:SENHA@HOST:5432/assessor?schema=public
     APP_SECRET=<64 hex aleatórios>   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ADMIN_EMAIL=voce@email.com
     ADMIN_PASSWORD=<senha forte>
     TZ=America/Sao_Paulo
     APP_URL=https://assessor.seudominio.com
     ```
   - Use o **domínio do EasyPanel** (subdomínio grátis) ou aponte um domínio próprio com SSL.
   - O schema vira Postgres automaticamente no build (não precisa editar nada).
4. **Webhook**: na Evolution, configure o webhook para `https://assessor.seudominio.com/api/webhook` (evento `messages.upsert`).
5. **Google Calendar** (opcional): no painel `/integracoes`, cole Client ID/Secret e clique em **Conectar Google**.
   - No Google Cloud, crie credenciais OAuth e adicione o redirect URI:
     `https://assessor.seudominio.com/api/google/callback`
6. **Notificações (cron)**: para o relatório mensal (dia 1º) e os lembretes de vencimento funcionarem,
   crie uma **tarefa agendada** (EasyPanel → Scheduled Tasks, ou cron do sistema) que chame **de hora em hora**:
   ```
   curl -s "https://assessor.seudominio.com/api/cron/run?key=SEU_APP_SECRET"
   ```
   (use o mesmo valor de `APP_SECRET`). O app decide sozinho a hora/dia de enviar conforme a aba **Notificações**.

---

## 🔐 Segurança
- As chaves de integração ficam **criptografadas** (AES-256-GCM) no banco.
- O painel exige login. O webhook só responde **números autorizados** (whitelist).
- **Troque** `APP_SECRET`, `ADMIN_PASSWORD` e as senhas do Postgres em produção.

---

## ⚙️ Scripts
| Script | O que faz |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run setup` | Gera client, cria tabelas e popula categorias |
| `npm run db:studio` | Abre o Prisma Studio (ver/editar dados) |
| `npm run build` / `npm start` | Build e execução de produção |
