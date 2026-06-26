# Plano de Ação — Assessor Financeiro & Agenda (WhatsApp + IA)

> Documento vivo. Última atualização: 2026-06-25

Um assistente pessoal ("assessor") que conversa com você pelo **WhatsApp**, entende
**texto, foto (recibo) e áudio**, registra e categoriza seus **gastos e entradas** num
**Postgres**, controla **bancos, cartões de crédito, vencimentos e saldo**, responde
perguntas ("quanto gastei essa semana?", "quanto está em aberto?") e **agenda eventos
no Google Calendar**. Tudo rodando no seu **EasyPanel**, com um **painel web simples**
pra cadastrar bancos, cartões, categorias e suas chaves de API.

---

## 1. Decisões já tomadas

| Tema | Decisão |
|------|---------|
| Arquitetura | **Código próprio em Node.js** (backend + painel, um projeto só) |
| Canal de conversa | **WhatsApp via Evolution API** |
| Escopo | **Single-user** (só você) — sem multiusuário por enquanto |
| IA / LLM | **OpenAI**: `gpt-4o` (texto + visão p/ recibos) + `Whisper` (áudio). Key já existe |
| Banco de dados | **PostgreSQL** (no EasyPanel) |
| Hospedagem | **EasyPanel** (seu ambiente atual) |
| Fuso / Moeda | **America/Sao_Paulo** / **BRL (R$)** |

---

## 2. Visão geral da arquitetura

```
┌──────────────┐    mensagem (texto/foto/áudio)
│   WhatsApp    │ ─────────────────────────────┐
└──────────────┘                               ▼
                                      ┌────────────────────┐
                                      │   Evolution API     │  (recebe/envia WhatsApp)
                                      └─────────┬──────────┘
                                       webhook  │  (POST)
                                                ▼
┌──────────────────────────────────────────────────────────────┐
│                  APP NODE.JS (nosso projeto)                    │
│                                                                │
│  1. Webhook recebe a mensagem                                  │
│  2. Detecta tipo: texto / imagem / áudio                       │
│     • imagem  → gpt-4o (visão) lê o recibo                     │
│     • áudio   → Whisper transcreve                             │
│  3. Manda pro "cérebro" (LLM + ferramentas/tools)             │
│  4. LLM decide a ação e chama a TOOL certa:                   │
│       ┌─ TOOL 1: Finanças (add/consultar gastos e entradas)   │
│       └─ TOOL 2: Agenda (criar evento no Google Calendar)     │
│  5. Executa, grava no Postgres, responde em linguagem natural │
│                                                                │
│  + Painel web (admin): bancos, cartões, categorias, chaves,   │
│    transações, dashboard, conexão Google                      │
└───────────────┬───────────────────────────────┬──────────────┘
                ▼                                 ▼
        ┌──────────────┐                 ┌────────────────┐
        │  PostgreSQL   │                 │ Google Calendar │
        └──────────────┘                 └────────────────┘
```

### Stack proposta
- **Linguagem:** Node.js + TypeScript
- **Framework:** Next.js (App Router) — entrega **API + webhook + painel** num único container (deploy simples no EasyPanel). *(Alternativa: Fastify + React separados — só se você preferir.)*
- **ORM / DB:** Prisma + PostgreSQL
- **IA:** SDK oficial da OpenAI (`gpt-4o`, `whisper-1`) com *function calling* (tools)
- **WhatsApp:** Evolution API (webhook de entrada + endpoint de envio)
- **Agenda:** Google Calendar API via OAuth2
- **Segurança:** chaves/segredos **criptografados** no banco; **login** simples no painel

---

## 3. Modelo de dados (Postgres)

Tabelas principais (nomes/colunas finais podem ajustar na implementação):

### `banco` (contas / carteiras)
- `id`, `nome` (ex.: "Nubank", "Itaú", "Carteira")
- `tipo` (conta_corrente | poupanca | carteira)
- `saldo_inicial` (R$), `saldo_inicial_data`
- `ativo`

### `cartao` (cartões de crédito)
- `id`, `banco_id` (vínculo opcional ao banco), `apelido` (ex.: "Nubank Roxinho")
- `bandeira` (visa/master/...)
- **`dia_fechamento`** (dia que a fatura fecha) ⚠️ *ver seção 4*
- **`dia_vencimento`** (dia que vence o pagamento)
- `limite` (opcional), `ativo`

### `categoria`
- `id`, `nome` (ex.: Alimentação, Mercado, Transporte...)
- `tipo` (gasto | entrada)
- `emoji`/`cor` (opcional, pro painel), `ativo`

### `transacao` (coração do sistema)
- `id`, `tipo` (gasto | entrada)
- `valor` (R$), `descricao`, `categoria_id`
- `data` (data real do gasto/entrada)
- `forma_pagamento` (dinheiro | pix | debito | **credito**)
- `banco_id` (se dinheiro/pix/débito → afeta saldo na hora)
- `cartao_id` (se crédito → entra na fatura, **não** mexe no saldo agora)
- `fatura_mes` (competência da fatura — calculada pelo `dia_fechamento`)
- `origem` (texto | foto | audio | manual)
- `raw_input` (texto original / link do recibo / transcrição — pra auditoria)
- `created_at`

### `fatura` (controle de cartão — pode ser calculada ou materializada)
- `cartao_id`, `mes_referencia`, `valor_total`, `vencimento`
- `status` (aberta | paga), `pago_em`, `pago_via_banco_id`

### `evento_agenda` (log dos agendamentos criados)
- `id`, `titulo`, `inicio`, `fim`, `participantes`, `google_event_id`, `created_at`

### `integracao` / `config` (chaves criptografadas)
- OpenAI key, Evolution (URL/instância/token), Google OAuth (client id/secret/refresh token)

### `numero_autorizado` (whitelist — quem a IA responde) 🔒
- `id`, `numero` (ex.: 5511999998888), `apelido`, `ativo`
- **A IA só responde números que estiverem nesta lista.** Qualquer outra pessoa que mandar mensagem pro número da Evolution é **ignorada** (sem resposta e sem gravar nada).

### `usuario_admin` (login do painel — mesmo sendo só você)
- `email`, `senha_hash`

> **Lógica de saldo:** `saldo do banco = saldo_inicial + entradas − gastos (dinheiro/pix/débito) − pagamentos de fatura debitados nele`. Compras no **crédito não reduzem o saldo na hora** — elas entram na **fatura** e só baixam quando a fatura é paga.

---

## 4. ⚠️ Ponto importante que faltou: fechamento × vencimento do cartão

Você citou só o **vencimento**, mas pra responder certo *"quanto tenho que pagar nesse cartão e até quando"* o sistema precisa também da **data de fechamento** da fatura.

Exemplo: cartão fecha dia **28** e vence dia **5**.
- Compra em **20/jun** → entra na fatura que **fecha 28/jun** e **vence 05/jul**.
- Compra em **29/jun** (após o fechamento) → vai pra fatura que **fecha 28/jul** e **vence 05/ago**.

Sem o `dia_fechamento`, o assessor erraria em qual fatura o gasto cai e o valor "em aberto" ficaria incorreto perto da virada do mês.

➡️ **Proposta:** no cadastro do cartão você informa **fechamento** e **vencimento**. (Se preferir, dá pra começar só com o vencimento e refinar depois — confirme na seção 9.)

---

## 5. As duas ferramentas (tools) da IA

A IA recebe a mensagem e escolhe sozinha qual ferramenta usar (*function calling*).

### TOOL 1 — Finanças
- `registrar_transacao` — cria gasto/entrada (valor, categoria, data, forma de pagamento, banco/cartão). Usado a partir de texto, foto ou áudio.
- `consultar_gastos` — agregações por período/categoria/cartão/banco ("quanto gastei essa semana?", "quanto gastei de comida esse mês?").
- `fatura_em_aberto` — "quanto está em aberto no cartão X e quando vence".
- `saldo` — saldo atual de um banco/carteira.

### TOOL 2 — Agenda (Google Calendar)
- `criar_evento` — "agenda reunião amanhã 19h com Fulano" → cria no Google Calendar.
- `listar_eventos` / `checar_disponibilidade` (opcional, fase posterior).

---

## 6. Pipeline de uma mensagem (passo a passo)

1. Evolution API chama nosso **webhook** com a mensagem.
2. **🔒 Filtro de número autorizado:** se o remetente **não** estiver na whitelist (`numero_autorizado`), a mensagem é **ignorada** — sem resposta, sem registro. Só seu(s) número(s) passam adiante.
3. App identifica o tipo:
   - **Texto** → segue direto.
   - **Imagem** → baixa a mídia e manda pro `gpt-4o` (visão) ler o recibo (valor, estabelecimento, data).
   - **Áudio** → baixa e transcreve com `Whisper`.
4. Conteúdo vai pro **LLM com as tools** + contexto (categorias, bancos e cartões cadastrados, data/hora atual no fuso BR).
5. LLM decide: registrar gasto/entrada, consultar, ou agendar evento → chama a tool.
6. Executa a ação, **grava no Postgres** (com data/hora) e gera uma **resposta natural**.
7. App envia a resposta de volta pelo WhatsApp via Evolution API.

> Volume baixo (single-user) → processamento **síncrono** no webhook é suficiente. Se um dia crescer, dá pra colocar uma fila (BullMQ/Redis).

---

## 7. Painel web (admin, bem simples)

Telas:
1. **Login** (e-mail + senha).
2. **Dashboard** — resumo do mês: total gasto, gastos por categoria, faturas em aberto, saldos.
3. **Bancos** — CRUD + **saldo inicial**.
4. **Cartões** — CRUD + **fechamento, vencimento, limite, banco vinculado**.
5. **Categorias** — CRUD (já vem com um conjunto padrão editável).
6. **Transações** — listar/editar/excluir manualmente (corrigir algo que a IA registrou errado).
7. **Números autorizados** 🔒 — cadastra o(s) número(s) de WhatsApp que a IA pode responder. Fora dessa lista, ninguém recebe resposta.
8. **Integrações / Chaves** — OpenAI, Evolution (URL/instância/token), **conectar Google** (botão de OAuth).

Categorias padrão sugeridas (editáveis): Alimentação, Mercado, Transporte, Moradia/Contas, Saúde, Lazer, Assinaturas, Educação, Compras, Outros · (entradas) Salário, Reembolso, Transferência.

---

## 8. Plano de execução por fases

> Cada fase é entregável e testável de forma isolada.

- [ ] **Fase 0 — Infra**
  - Subir **Postgres** no EasyPanel (template oficial).
  - Subir **Evolution API** no EasyPanel + conectar o número de WhatsApp (QR code).
  - Criar o repositório do projeto + serviço do app no EasyPanel (deploy a partir do GitHub).
  - Configurar domínio/SSL do app (pro webhook e pro painel).

- [ ] **Fase 1 — Esqueleto + WhatsApp "eco"**
  - App Node/Next no ar, webhook recebendo mensagem da Evolution e respondendo "recebi: ...". Valida a integração ponta a ponta.

- [ ] **Fase 2 — Banco de dados + painel**
  - Migrations (Prisma), CRUD de bancos/cartões/categorias, tela de chaves (criptografadas), login.

- [ ] **Fase 3 — IA por texto**
  - LLM + Tool de finanças: "gastei 10 no hot dog" → categoriza, grava data e mostra confirmação.

- [ ] **Fase 4 — Multimodal**
  - Foto de recibo (visão `gpt-4o`) + áudio (`Whisper`) → mesmo fluxo de registro.

- [ ] **Fase 5 — Consultas e relatórios**
  - "quanto gastei essa semana / de comida / no cartão X", "quanto está em aberto", "qual meu saldo".

- [ ] **Fase 6 — Google Calendar**
  - OAuth no painel (colar Client ID/Secret + autorizar) + Tool de agenda: "agenda amanhã 19h com Fulano".

- [ ] **Fase 7 — Polimento**
  - Dashboard, backups do Postgres, ajustes de prompt, tratamento de erros, logs.

---

## 9. Perguntas em aberto (me confirma quando puder)

1. ~~**Fechamento do cartão:** topa cadastrar **fechamento + vencimento**?~~ ✅ **RESOLVIDO:** cadastra **fechamento + vencimento** no painel.
2. **WhatsApp:** vai usar um **número dedicado** pro assessor (recomendado) ou o seu número pessoal? Conversa **direta** ou dentro de um **grupo** só seu?
3. **Confirmação antes de gravar:** quando você mandar um gasto, o assessor **grava direto** e avisa, ou **pergunta "confirma?"** antes? (Recomendo gravar direto + permitir corrigir depois.)
4. **Período da "semana":** semana = **seg→dom**, **dom→sáb**, ou **últimos 7 dias**?
5. **Categorias:** a lista padrão da seção 7 está boa ou quer adicionar/remover algo?
6. **Google Calendar:** usar seu calendário **principal** ou criar um calendário separado ("Assessor")?
7. **Domínio:** já tem um domínio/subdomínio pra apontar pro app (ex.: `assessor.seudominio.com`)? É necessário pro webhook e pro painel.

---

## 10. O que eu vou precisar de você

> Você não precisa entregar tudo de uma vez — vou pedindo conforme as fases. Aqui fica a lista completa.

**Acessos / ambiente**
- [ ] Acesso (ou que você execute, eu guiando) ao **EasyPanel**.
- [ ] Um **domínio/subdomínio** pro app.
- [ ] Repositório **GitHub** pro código (posso te orientar a criar).

**Chaves / credenciais**
- [ ] **OpenAI API key** (você já tem).
- [ ] **Evolution API:** URL da instância, nome da instância e token/API key (geramos ao subir no EasyPanel).
- [ ] **Número de WhatsApp** pro assessor (de preferência dedicado).
- [ ] **Google Cloud — OAuth2:** criar um projeto, ativar a **Google Calendar API** e gerar **Client ID + Client Secret** (eu te passo o passo a passo). Não precisa mandar agora — só na Fase 6.

**Decisões**
- [ ] Respostas das **perguntas da seção 9**.

---

## 11. Estimativa de custos (ordem de grandeza)

| Item | Custo aproximado |
|------|------------------|
| EasyPanel/VPS | o que você já paga hoje (app + Postgres + Evolution cabem no mesmo servidor) |
| OpenAI (`gpt-4o` + Whisper) | uso pessoal costuma ficar em **poucos dólares/mês** (depende do volume de fotos/áudios) |
| Google Calendar API | **grátis** nas cotas normais |
| Evolution API | **open-source / grátis** (você hospeda) |

---

## 12. Próximo passo

1. Você responde as **perguntas da seção 9**.
2. Eu fecho os detalhes finais e começamos pela **Fase 0 (infra)** — eu te guio no EasyPanel (Postgres + Evolution) e já deixo o esqueleto do projeto pronto.

> Quando você confirmar, eu já começo a escrever o código do projeto (estrutura, migrations e webhook) pra rodar a Fase 1.
