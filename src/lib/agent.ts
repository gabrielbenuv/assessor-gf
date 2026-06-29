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
  criarParcelamento,
  darBaixaParcela,
  listarParcelamentos,
  pagarFatura,
  aprenderCategoria,
  montarSnapshotFinanceiro,
  normDominio,
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
        "Registra um gasto ou uma entrada (receita) avulsa. Use sempre que o usuário relatar que gastou/recebeu algo, ou ao ler um recibo. NÃO use para compras parceladas (use registrar_parcelamento).",
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
      name: "registrar_parcelamento",
      description:
        "Registra uma compra PARCELADA (gera todas as parcelas com seus vencimentos). Ex: 'parcelei o colchão em 30x de 500 no pix'. SEMPRE confirme com um resumo antes de chamar (ex: 'Colchão, 30x de R$500 = R$15.000, categoria Casa. Confirma?').",
      parameters: {
        type: "object",
        properties: {
          descricao: { type: "string", description: "O que foi comprado (ex: 'colchão')" },
          valor_parcela: { type: "number", description: "Valor de CADA parcela em reais (ex: 500)" },
          num_parcelas: { type: "integer", description: "Número de parcelas (ex: 30)" },
          forma: {
            type: "string",
            enum: ["cartao", "avulso"],
            description:
              "cartao = cai na fatura do cartão; avulso = carnê/boleto/pix pago no mês de cada parcela.",
          },
          cartao: { type: "string", description: "Apelido do cartão (se forma=cartao)." },
          banco: { type: "string", description: "Conta sugerida de pagamento (se forma=avulso). Opcional." },
          categoria: { type: "string", description: "Categoria sugerida. Opcional." },
          data_primeira: { type: "string", description: "Vencimento da 1ª parcela em ISO (YYYY-MM-DD). Opcional (usa hoje)." },
        },
        required: ["descricao", "valor_parcela", "num_parcelas", "forma"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dar_baixa_parcela",
      description:
        "Dá baixa (pagamento) na PRÓXIMA parcela em aberto de um parcelamento AVULSO. Ex: 'paguei a parcela do colchão'. SEMPRE capture de qual conta saiu o dinheiro — se o usuário não disser e houver mais de uma conta, PERGUNTE antes.",
      parameters: {
        type: "object",
        properties: {
          descricao: { type: "string", description: "Descrição do parcelamento (ex: 'colchão')." },
          banco: { type: "string", description: "Conta de onde saiu o dinheiro." },
          forma_pagamento: { type: "string", enum: ["dinheiro", "pix", "debito"] },
          valor: { type: "number", description: "Valor pago em reais. Opcional (padrão: valor previsto da parcela)." },
        },
        required: ["descricao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pagar_fatura",
      description:
        "Paga a fatura de um cartão de crédito (quita o CICLO inteiro de uma vez). Ex: 'paguei a fatura do nubank'.",
      parameters: {
        type: "object",
        properties: {
          cartao: { type: "string", description: "Apelido do cartão." },
          valor: { type: "number", description: "Valor pago em reais. Opcional (padrão: total da fatura)." },
          banco: { type: "string", description: "Conta de onde saiu o dinheiro. Opcional." },
          mes: { type: "string", description: "Mês da fatura 'YYYY-MM'. Opcional (padrão: a mais antiga em aberto)." },
        },
        required: [],
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
      name: "listar_parcelamentos",
      description: "Lista os parcelamentos em andamento, com progresso (parcela X de N) e quanto falta.",
      parameters: { type: "object", properties: {} },
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
      name: "exportar_planilha",
      description:
        "Gera uma planilha (.xlsx) com o resumo financeiro completo (transações, parcelas, faturas, contas fixas, previsão) e ENVIA como documento no WhatsApp. Use quando o usuário pedir 'exporta a planilha', 'me manda em excel', etc.",
      parameters: { type: "object", properties: {} },
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

// Sinaliza ao webhook/simulador que esta resposta deve disparar o envio da planilha.
export const PLANILHA_FLAG = "[[EXPORTAR_PLANILHA]]";

async function executarTool(name: string, args: any, origem: string): Promise<string> {
  const dominio = normDominio(args?.dominio);
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
        origemEntrada: origem as any,
        dominio,
      });
      // Aprende a categoria pra próxima vez acertar sozinho.
      if (transacao.categoriaId && args.descricao) {
        await aprenderCategoria(args.descricao, transacao.categoriaId, dominio);
      }
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
    case "registrar_parcelamento": {
      const r = await criarParcelamento({
        descricao: args.descricao,
        valorParcelaCents: toCents(args.valor_parcela),
        numParcelas: Number(args.num_parcelas),
        forma: args.forma === "cartao" ? "cartao" : "avulso",
        cartaoApelido: args.cartao,
        bancoNome: args.banco,
        categoriaNome: args.categoria,
        dataPrimeira: parseDataHora(args.data_primeira),
        dominio,
      });
      return JSON.stringify(r);
    }
    case "dar_baixa_parcela": {
      const r = await darBaixaParcela({
        descricao: args.descricao,
        bancoNome: args.banco,
        formaPagamento: args.forma_pagamento,
        valorCents: args.valor != null ? toCents(args.valor) : undefined,
        origemEntrada: origem,
        dominio,
      });
      return JSON.stringify(r);
    }
    case "pagar_fatura": {
      const r = await pagarFatura({
        cartaoApelido: args.cartao,
        valorCents: args.valor != null ? toCents(args.valor) : undefined,
        bancoNome: args.banco,
        mes: args.mes,
        origemEntrada: origem,
        dominio,
      });
      return JSON.stringify(r);
    }
    case "listar_parcelamentos":
      return JSON.stringify(await listarParcelamentos(dominio));
    case "consultar_gastos":
      return JSON.stringify(
        await consultarGastos({
          periodo: args.periodo,
          tipo: args.tipo,
          categoriaNome: args.categoria,
          bancoNome: args.banco,
          cartaoApelido: args.cartao,
          dominio,
        })
      );
    case "consultar_saldo":
      return JSON.stringify(await consultarSaldo(args.banco, dominio));
    case "fatura_em_aberto":
      return JSON.stringify(await faturaEmAberto(args.cartao, dominio));
    case "listar_contas_a_pagar":
      return JSON.stringify(await listarContasAPagar(args.mes, dominio));
    case "registrar_pagamento_conta_fixa":
      return JSON.stringify(
        await registrarPagamentoContaFixa({
          nome: args.nome,
          valorCents: toCents(args.valor),
          formaPagamento: args.forma_pagamento,
          bancoNome: args.banco,
          cartaoApelido: args.cartao,
          data: parseDataHora(args.data),
          origemEntrada: origem,
          dominio,
        })
      );
    case "exportar_planilha":
      // O envio real do arquivo é feito pelo webhook/simulador ao ver a flag na resposta.
      return JSON.stringify({ ok: true, instrucao: `Responda confirmando o envio e inclua o marcador ${PLANILHA_FLAG} no fim da mensagem.` });
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
  const [bancos, cartoes, categorias, contasFixas, contaSalario, contasReceber, snapshot] = await Promise.all([
    prisma.banco.findMany({ where: { ativo: true, dominio: "pessoal" }, select: { nome: true } }),
    prisma.cartao.findMany({ where: { ativo: true, dominio: "pessoal" }, select: { apelido: true } }),
    prisma.categoria.findMany({ where: { ativo: true, dominio: "pessoal" }, select: { nome: true, tipo: true } }),
    prisma.contaFixa.findMany({ where: { ativo: true, dominio: "pessoal" }, select: { nome: true, diaVencimento: true } }),
    getContaSalario("pessoal"),
    prisma.banco.findMany({
      where: { ativo: true, dominio: "pessoal", OR: [{ contaSalario: true }, { contaReceber: true }] },
      select: { nome: true },
    }),
    montarSnapshotFinanceiro("pessoal").catch(() => ""),
  ]);

  return [
    "Você é o Assessor — o estrategista financeiro pessoal do usuário, falando pelo WhatsApp em português do Brasil.",
    "Personalidade: pensa como um CFO de elite (nível Harvard) — direto, prático e honesto sobre dinheiro, mas gentil e sem jargão. Quando vir algo importante (estouro de teto, saldo baixo previsto, assinatura cara), comente em 1 linha. Não enrole.",
    `Agora é ${contextoDataHora()} (fuso ${TZ}). Moeda: Real (R$). Domínio padrão: pessoal.`,
    "",
    "RETRATO FINANCEIRO ATUAL (use para dar contexto às respostas, sem despejar tudo):",
    snapshot || "(sem dados ainda)",
    "",
    "Suas funções:",
    "- Registrar gastos/entradas avulsos, COMPRAS PARCELADAS, e dar baixa em parcelas.",
    "- Pagar faturas de cartão (quita o ciclo inteiro).",
    "- Responder consultas: quanto gastou, saldo, fatura em aberto, parcelamentos, contas a pagar.",
    "- Registrar pagamento de contas fixas, exportar planilha e agendar eventos no Google Calendar.",
    "",
    "Regras de REGISTRO (importante):",
    "- GASTO avulso: você PRECISA saber a forma de pagamento (dinheiro, pix, débito ou crédito). Se não informar, PERGUNTE. Não invente.",
    "  • Crédito sem cartão → pergunte qual cartão. Débito/pix com mais de um banco → pergunte de qual conta saiu.",
    "- ENTRADA (salário/recebimento): sem conta informada — se houver só UMA conta de recebimento, use ela; se houver MAIS DE UMA, PERGUNTE.",
    "- PARCELAMENTO: ao detectar 'parcelei/em Nx de R$Y', use registrar_parcelamento. SEMPRE confirme com um resumo curto antes (total, nº de parcelas, categoria). 'avulso' = pix/boleto/carnê; 'cartao' = vai pra fatura.",
    "- BAIXA de parcela ('paguei a parcela do X'): use dar_baixa_parcela e SEMPRE capture de qual conta saiu (pergunte se preciso).",
    "- FATURA ('paguei a fatura do cartão'): use pagar_fatura — isso quita o ciclo todo, não uma parcela isolada.",
    "- Quando JÁ tiver todas as informações (fora parcelamento), registre direto, sem pedir 'confirma?'.",
    "",
    "CATEGORIZAÇÃO:",
    "- Categorize sozinho usando as categorias existentes. Só PERGUNTE a categoria se estiver realmente em dúvida.",
    "- Em recibos (imagem), extraia valor total, estabelecimento e data.",
    "",
    "ESTILO:",
    "- Seja breve, claro e simpático (estilo WhatsApp). Poucos emojis. Confirme o que registrou (valor + categoria + forma).",
    "- Para eventos, converta 'amanhã 19h' para ISO 8601 com fuso -03:00 usando a data/hora atual.",
    "- Responda SEMPRE em português. Use o histórico pra entender respostas curtas (ex: 'crédito nubank').",
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
