import type OpenAI from "openai";
import { getOpenAI, getModel } from "./openai";
import { toCents } from "./money";
import { contextoDataHora, TZ } from "./dates";
import { prisma } from "./prisma";
import {
  registrarTransacao,
  consultarGastos,
  consultarSaldo,
  faturaEmAberto,
  getContaSalario,
  listarContasAPagar,
  registrarPagamentoContaFixa,
} from "./finance";
import { criarEventoCalendar, googleConectado } from "./google";
import { carregarHistorico, salvarTurno } from "./memory";
import { parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

export interface EntradaAgente {
  texto: string;
  imagemBase64?: string; // data:image/...;base64,xxx OU base64 puro
  origem?: "texto" | "foto" | "audio" | "manual";
  sessao?: string; // identificador da conversa (número do WhatsApp ou "simulador")
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "registrar_transacao",
      description:
        "Registra um gasto ou uma entrada (receita). Use sempre que o usuário relatar que gastou/recebeu algo, ou ao ler um recibo.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["gasto", "entrada"] },
          valor: { type: "number", description: "Valor em reais (ex: 25.90)" },
          descricao: { type: "string", description: "O que foi (ex: 'hot dog', 'mercado Oxxo')" },
          categoria: { type: "string", description: "Categoria (ex: Alimentação, Transporte). Opcional." },
          data: {
            type: "string",
            description: "Data do gasto em ISO 8601 com fuso -03:00. Se não souber, omita (usa agora).",
          },
          forma_pagamento: {
            type: "string",
            enum: ["dinheiro", "pix", "debito", "credito"],
            description: "Como pagou. Crédito vai pra fatura do cartão.",
          },
          banco: { type: "string", description: "Nome do banco/conta (p/ dinheiro, pix, débito). Opcional." },
          cartao: { type: "string", description: "Apelido do cartão (quando forma_pagamento=credito). Opcional." },
        },
        required: ["tipo", "valor", "descricao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_gastos",
      description: "Consulta o total de gastos ou entradas em um período, com quebra por categoria.",
      parameters: {
        type: "object",
        properties: {
          periodo: {
            type: "string",
            description:
              "hoje, ontem, semana, semana_passada, mes, mes_passado, ano, 7dias, 30dias ou um mês 'YYYY-MM'.",
          },
          tipo: { type: "string", enum: ["gasto", "entrada"] },
          categoria: { type: "string" },
          banco: { type: "string" },
          cartao: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_saldo",
      description: "Mostra o saldo atual dos bancos/contas (saldo inicial + entradas - gastos não-crédito).",
      parameters: {
        type: "object",
        properties: { banco: { type: "string", description: "Opcional: nome de um banco específico." } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fatura_em_aberto",
      description: "Mostra quanto está em aberto nos cartões de crédito e quando vence.",
      parameters: {
        type: "object",
        properties: { cartao: { type: "string", description: "Opcional: apelido de um cartão específico." } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_contas_a_pagar",
      description:
        "Lista as contas fixas/recorrentes do mês: quais já foram pagas, quais faltam, valores e datas de vencimento.",
      parameters: {
        type: "object",
        properties: {
          mes: { type: "string", description: "Mês 'YYYY-MM'. Opcional (padrão: mês atual)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_pagamento_conta_fixa",
      description:
        "Registra o pagamento de uma conta fixa já cadastrada (ex: luz, água, aluguel). Cria um gasto vinculado a ela.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome da conta fixa (ex: 'luz', 'aluguel')." },
          valor: { type: "number", description: "Valor pago em reais." },
          forma_pagamento: { type: "string", enum: ["dinheiro", "pix", "debito", "credito"] },
          banco: { type: "string", description: "Banco (se débito/pix/dinheiro). Opcional." },
          cartao: { type: "string", description: "Cartão (se crédito). Opcional." },
          data: { type: "string", description: "Data do pagamento em ISO. Opcional (usa hoje)." },
        },
        required: ["nome", "valor"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_evento_agenda",
      description: "Cria um evento no Google Calendar do usuário.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          inicio: { type: "string", description: "Início em ISO 8601 com fuso -03:00 (ex: 2026-06-26T19:00:00-03:00)." },
          fim: { type: "string", description: "Fim em ISO 8601. Opcional (padrão: +1h)." },
          participantes: { type: "array", items: { type: "string" }, description: "Nomes ou e-mails. Opcional." },
          descricao: { type: "string" },
        },
        required: ["titulo", "inicio"],
      },
    },
  },
];

function parseDataHora(s?: string): Date | undefined {
  if (!s) return undefined;
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
  try {
    if (hasTz) return new Date(s);
    return fromZonedTime(parseISO(s), TZ); // trata como horário de parede em SP
  } catch {
    return undefined;
  }
}

async function executarTool(name: string, args: any, origem: string): Promise<string> {
  switch (name) {
    case "registrar_transacao": {
      const { transacao, avisos } = await registrarTransacao({
        tipo: args.tipo,
        valorCents: toCents(args.valor),
        descricao: args.descricao || "",
        categoriaNome: args.categoria,
        data: parseDataHora(args.data),
        formaPagamento: args.forma_pagamento,
        bancoNome: args.banco,
        cartaoApelido: args.cartao,
        origem: origem as any,
        rawInput: undefined,
      });
      return JSON.stringify({
        ok: true,
        id: transacao.id,
        categoria: transacao.categoria?.nome,
        banco: transacao.banco?.nome,
        cartao: transacao.cartao?.apelido,
        faturaMes: transacao.faturaMes,
        avisos,
      });
    }
    case "consultar_gastos":
      return JSON.stringify(
        await consultarGastos({
          periodo: args.periodo,
          tipo: args.tipo,
          categoriaNome: args.categoria,
          bancoNome: args.banco,
          cartaoApelido: args.cartao,
        })
      );
    case "consultar_saldo":
      return JSON.stringify(await consultarSaldo(args.banco));
    case "fatura_em_aberto":
      return JSON.stringify(await faturaEmAberto(args.cartao));
    case "listar_contas_a_pagar":
      return JSON.stringify(await listarContasAPagar(args.mes));
    case "registrar_pagamento_conta_fixa":
      return JSON.stringify(
        await registrarPagamentoContaFixa({
          nome: args.nome,
          valorCents: toCents(args.valor),
          formaPagamento: args.forma_pagamento,
          bancoNome: args.banco,
          cartaoApelido: args.cartao,
          data: parseDataHora(args.data),
          origem,
        })
      );
    case "criar_evento_agenda": {
      if (!(await googleConectado())) {
        return JSON.stringify({
          ok: false,
          erro: "Google Calendar não conectado. Conecte em /integracoes no painel.",
        });
      }
      const inicio = parseDataHora(args.inicio);
      if (!inicio) return JSON.stringify({ ok: false, erro: "Data de início inválida." });
      const fim = parseDataHora(args.fim);
      const participantes: string[] = args.participantes || [];
      const emails = participantes.filter((p) => p.includes("@"));
      const nomes = participantes.filter((p) => !p.includes("@"));
      const descricao = [args.descricao, nomes.length ? `Com: ${nomes.join(", ")}` : ""]
        .filter(Boolean)
        .join("\n");

      const r = await criarEventoCalendar({
        titulo: args.titulo,
        inicio,
        fim,
        participantes: emails,
        descricao,
      });
      await prisma.eventoAgenda.create({
        data: {
          titulo: args.titulo,
          inicio,
          fim: fim || null,
          participantes: participantes.join(", ") || null,
          descricao: descricao || null,
          googleEventId: r.id || null,
          googleLink: r.link || null,
        },
      });
      return JSON.stringify({ ok: true, link: r.link });
    }
    default:
      return JSON.stringify({ ok: false, erro: `Ferramenta desconhecida: ${name}` });
  }
}

async function montarSystemPrompt(): Promise<string> {
  const [bancos, cartoes, categorias, contasFixas, contaSalario, contasReceber] = await Promise.all([
    prisma.banco.findMany({ where: { ativo: true }, select: { nome: true } }),
    prisma.cartao.findMany({ where: { ativo: true }, select: { apelido: true } }),
    prisma.categoria.findMany({ where: { ativo: true }, select: { nome: true, tipo: true } }),
    prisma.contaFixa.findMany({ where: { ativo: true }, select: { nome: true, diaVencimento: true } }),
    getContaSalario(),
    prisma.banco.findMany({ where: { ativo: true, OR: [{ contaSalario: true }, { contaReceber: true }] }, select: { nome: true } }),
  ]);

  return [
    "Você é o Assessor Financeiro pessoal do usuário, falando pelo WhatsApp em português do Brasil.",
    `Agora é ${contextoDataHora()} (fuso ${TZ}). Moeda: Real (R$).`,
    "",
    "Suas funções:",
    "- Registrar gastos e entradas (texto, áudio transcrito ou foto de recibo).",
    "- Responder consultas: quanto gastou, saldo, fatura em aberto, contas a pagar.",
    "- Registrar pagamento de contas fixas e agendar eventos no Google Calendar.",
    "",
    "Regras de REGISTRO (importante):",
    "- Para um GASTO: você PRECISA saber a forma de pagamento (dinheiro, pix, débito ou crédito).",
    "  • Se o usuário NÃO informar a forma de pagamento, PERGUNTE antes de registrar. Não invente nem assuma.",
    "  • Se for crédito e não disser qual cartão, pergunte qual cartão.",
    "  • Se for débito/pix e houver mais de um banco, pergunte de qual conta saiu.",
    "- Para uma ENTRADA (ex: salário/recebimento): se não disser a conta — se houver só UMA conta de recebimento, use ela; se houver MAIS DE UMA, PERGUNTE em qual conta caiu antes de registrar.",
    "- Quando JÁ tiver todas as informações, registre direto (sem pedir 'confirma?').",
    "- Se o usuário relatar pagamento de uma conta fixa conhecida (luz, água, aluguel...), use registrar_pagamento_conta_fixa.",
    "- Categorize com bom senso usando as categorias existentes.",
    "- Em recibos (imagem), extraia valor total, estabelecimento e data.",
    "- Para eventos, converta 'amanhã 19h' etc. para ISO 8601 com fuso -03:00 usando a data/hora atual.",
    "- Seja breve, claro e simpático (estilo WhatsApp). Poucos emojis. Confirme o que registrou (valor + categoria + forma).",
    "- Responda SEMPRE em português. Considere o histórico da conversa para entender respostas curtas (ex: 'crédito nubank').",
    "",
    `Conta que recebe o salário: ${contaSalario?.nome || "(não definida)"}.`,
    `Contas de recebimento (entradas): ${contasReceber.map((b) => b.nome).join(", ") || "(nenhuma)"}.`,
    `Bancos/contas: ${bancos.map((b) => b.nome).join(", ") || "(nenhum)"}.`,
    `Cartões: ${cartoes.map((c) => c.apelido).join(", ") || "(nenhum)"}.`,
    `Contas fixas cadastradas: ${contasFixas.map((c) => `${c.nome} (vence dia ${c.diaVencimento})`).join(", ") || "(nenhuma)"}.`,
    `Categorias de gasto: ${categorias.filter((c) => c.tipo === "gasto").map((c) => c.nome).join(", ")}.`,
    `Categorias de entrada: ${categorias.filter((c) => c.tipo === "entrada").map((c) => c.nome).join(", ")}.`,
  ].join("\n");
}

/** Processa uma entrada e retorna a resposta em texto pra mandar de volta no WhatsApp. */
export async function processarMensagem(entrada: EntradaAgente): Promise<string> {
  const client = await getOpenAI();
  const model = await getModel();
  const origem = entrada.origem || "texto";
  const sessao = entrada.sessao || "default";

  const system = await montarSystemPrompt();
  const historico = await carregarHistorico(sessao);

  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
  if (entrada.texto) userContent.push({ type: "text", text: entrada.texto });
  if (entrada.imagemBase64) {
    const url = entrada.imagemBase64.startsWith("data:")
      ? entrada.imagemBase64
      : `data:image/jpeg;base64,${entrada.imagemBase64}`;
    userContent.push({ type: "image_url", image_url: { url } });
  }
  if (userContent.length === 0) userContent.push({ type: "text", text: "(mensagem vazia)" });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...historico.map((h) => ({ role: h.role, content: h.conteudo }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
    { role: "user", content: userContent },
  ];

  // Salva o turno do usuário na memória (imagem vira marcador textual)
  const textoUsuario = entrada.texto || (entrada.imagemBase64 ? "[enviou uma foto de recibo]" : "");
  await salvarTurno(sessao, "user", textoUsuario);

  let resposta = "Ok!";
  for (let i = 0; i < 6; i++) {
    const resp = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
    });

    const msg = resp.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      resposta = msg.content || "Ok!";
      await salvarTurno(sessao, "assistant", resposta);
      return resposta;
    }

    for (const call of msg.tool_calls) {
      let args: any = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      let resultado: string;
      try {
        resultado = await executarTool(call.function.name, args, origem);
      } catch (e: any) {
        resultado = JSON.stringify({ ok: false, erro: e?.message || String(e) });
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: resultado });
    }
  }

  resposta = "Consegui processar, mas tive dificuldade em resumir. Tenta perguntar de novo?";
  await salvarTurno(sessao, "assistant", resposta);
  return resposta;
}
