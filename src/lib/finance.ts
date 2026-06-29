import { prisma } from "./prisma";
import { resolvePeriodo, calcularFatura, formatBR, nowZoned, TZ } from "./dates";
import { formatBRL } from "./money";
import { addMonths, format } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

// ===== Domínios =====
export const DOMINIOS = ["pessoal", "chess", "klivy"] as const;
export type Dominio = (typeof DOMINIOS)[number];
export function normDominio(d?: string | null): string {
  return d && (DOMINIOS as readonly string[]).includes(d) ? d : "pessoal";
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// ===== Resolvers (escopados por domínio) =====

/** Acha categoria por nome (tolerante a acento/caixa) ou cria; cai em "Outros". */
export async function resolverCategoria(
  nome: string | undefined,
  tipo: string,
  dominio = "pessoal"
): Promise<string | null> {
  const cats = await prisma.categoria.findMany({ where: { tipo, dominio } });
  if (nome) {
    const alvo = normalize(nome);
    const match =
      cats.find((c) => normalize(c.nome) === alvo) ||
      cats.find((c) => normalize(c.nome).includes(alvo) || alvo.includes(normalize(c.nome)));
    if (match) return match.id;
    // cria nova categoria com esse nome
    const nova = await prisma.categoria.create({
      data: { nome: nome.slice(0, 40), tipo, dominio },
    });
    return nova.id;
  }
  const outros = cats.find((c) => normalize(c.nome) === "outros");
  return outros?.id ?? null;
}

/**
 * Categoriza uma descrição usando o MAPA DE APRENDIZADO primeiro (termos já confirmados),
 * caindo no resolvedor por nome. Retorna { categoriaId, viaMapa }.
 */
export async function categorizarPorDescricao(
  descricao: string,
  tipo: string,
  dominio = "pessoal"
): Promise<{ categoriaId: string | null; viaMapa: boolean }> {
  const desc = normalize(descricao);
  if (desc) {
    const mapas = await prisma.mapaCategoria.findMany({
      where: { dominio },
      include: { categoria: true },
      orderBy: { hits: "desc" },
    });
    const hit = mapas.find((m) => m.categoria.tipo === tipo && desc.includes(m.termo));
    if (hit) return { categoriaId: hit.categoriaId, viaMapa: true };
  }
  return { categoriaId: await resolverCategoria(undefined, tipo, dominio), viaMapa: false };
}

/** Persiste o aprendizado "termo -> categoria" para próximas vezes acertar sozinho. */
export async function aprenderCategoria(termo: string, categoriaId: string, dominio = "pessoal") {
  const t = normalize(termo).slice(0, 40);
  if (!t) return;
  await prisma.mapaCategoria.upsert({
    where: { termo_dominio: { termo: t, dominio } },
    update: { categoriaId, hits: { increment: 1 } },
    create: { termo: t, categoriaId, dominio, hits: 1 },
  });
}

export async function resolverBanco(nome?: string, dominio = "pessoal"): Promise<{ id: string; nome: string } | null> {
  if (!nome) return null;
  const bancos = await prisma.banco.findMany({ where: { ativo: true, dominio } });
  const alvo = normalize(nome);
  const match =
    bancos.find((b) => normalize(b.nome) === alvo) ||
    bancos.find((b) => normalize(b.nome).includes(alvo) || alvo.includes(normalize(b.nome)));
  return match ? { id: match.id, nome: match.nome } : null;
}

export async function resolverCartao(apelido?: string, dominio = "pessoal") {
  const cartoes = await prisma.cartao.findMany({ where: { ativo: true, dominio } });
  if (!apelido) {
    return cartoes.length === 1 ? cartoes[0] : null;
  }
  const alvo = normalize(apelido);
  return (
    cartoes.find((c) => normalize(c.apelido) === alvo) ||
    cartoes.find((c) => normalize(c.apelido).includes(alvo) || alvo.includes(normalize(c.apelido))) ||
    null
  );
}

export async function resolverContaFixa(nome?: string, dominio = "pessoal") {
  if (!nome) return null;
  const contas = await prisma.contaFixa.findMany({ where: { ativo: true, dominio } });
  const alvo = normalize(nome);
  return (
    contas.find((c) => normalize(c.nome) === alvo) ||
    contas.find((c) => normalize(c.nome).includes(alvo) || alvo.includes(normalize(c.nome))) ||
    null
  );
}

/** Retorna a conta marcada como "recebe salário" no domínio, se houver. */
export async function getContaSalario(dominio = "pessoal") {
  return prisma.banco.findFirst({ where: { ativo: true, contaSalario: true, dominio } });
}

// ===== Faturas (garantia/derivação) =====

/** Garante que existe a Fatura do ciclo desse cartão (upsert por cartão+mês). */
export async function garantirFatura(
  cartao: { id: string; diaFechamento: number; diaVencimento: number; dominio: string },
  dataCompra: Date
) {
  const f = calcularFatura(dataCompra, cartao.diaFechamento, cartao.diaVencimento);
  return prisma.fatura.upsert({
    where: { cartaoId_mesReferencia: { cartaoId: cartao.id, mesReferencia: f.mesReferencia } },
    update: {},
    create: {
      cartaoId: cartao.id,
      dominio: cartao.dominio,
      mesReferencia: f.mesReferencia,
      dataVencimento: f.vencimento,
    },
  });
}

// ===== Registro de transações =====

export interface RegistroInput {
  tipo: "gasto" | "entrada";
  valorCents: number;
  descricao: string;
  categoriaNome?: string;
  data?: Date;
  formaPagamento?: "dinheiro" | "pix" | "debito" | "credito";
  bancoNome?: string;
  cartaoApelido?: string;
  contaFixaId?: string;
  parcelaId?: string;
  faturaId?: string;
  origemTipo?: string; // avulso | baixa_parcela | pagamento_fatura | conta_fixa | recebimento
  origemId?: string;
  origemEntrada?: string; // texto | foto | audio | manual
  rawInput?: string;
  dominio?: string;
}

export async function registrarTransacao(input: RegistroInput) {
  const dominio = normDominio(input.dominio);
  const data = input.data || new Date();
  const forma = input.formaPagamento || "dinheiro";
  const avisos: string[] = [];

  // Categoria: usa a informada; senão tenta o mapa de aprendizado pela descrição.
  let categoriaId: string | null;
  if (input.categoriaNome) {
    categoriaId = await resolverCategoria(input.categoriaNome, input.tipo, dominio);
  } else {
    categoriaId = (await categorizarPorDescricao(input.descricao, input.tipo, dominio)).categoriaId;
  }

  let bancoId: string | null = null;
  let cartaoId: string | null = null;
  let faturaMes: string | null = null;
  let faturaId: string | null = input.faturaId || null;

  if (forma === "credito") {
    const cartao = await resolverCartao(input.cartaoApelido, dominio);
    if (cartao) {
      cartaoId = cartao.id;
      const f = calcularFatura(data, cartao.diaFechamento, cartao.diaVencimento);
      faturaMes = f.mesReferencia;
      if (!faturaId && input.origemTipo !== "pagamento_fatura") {
        const fat = await garantirFatura(cartao, data);
        faturaId = fat.id;
      }
    } else {
      avisos.push(
        input.cartaoApelido
          ? `Não encontrei o cartão "${input.cartaoApelido}". Cadastre-o no painel.`
          : "Forma de pagamento crédito, mas nenhum cartão informado/cadastrado."
      );
    }
  } else {
    const banco = await resolverBanco(input.bancoNome, dominio);
    if (banco) bancoId = banco.id;
    else if (input.bancoNome) avisos.push(`Não encontrei o banco "${input.bancoNome}".`);

    // Entrada sem banco informado → usa a conta de salário; senão, a única conta de recebimento.
    if (!bancoId && input.tipo === "entrada") {
      const salario = await getContaSalario(dominio);
      if (salario) {
        bancoId = salario.id;
      } else {
        const receber = await prisma.banco.findMany({ where: { ativo: true, contaReceber: true, dominio } });
        if (receber.length === 1) bancoId = receber[0].id;
      }
    }
  }

  const t = await prisma.transacao.create({
    data: {
      dominio,
      tipo: input.tipo,
      valorCents: input.valorCents,
      descricao: input.descricao,
      data,
      formaPagamento: forma,
      faturaMes,
      origemTipo: input.origemTipo || "avulso",
      origemId: input.origemId || null,
      origemEntrada: input.origemEntrada || "manual",
      rawInput: input.rawInput,
      categoriaId,
      bancoId,
      cartaoId,
      contaFixaId: input.contaFixaId || null,
      parcelaId: input.parcelaId || null,
      faturaId,
    },
    include: { categoria: true, banco: true, cartao: true },
  });

  return { transacao: t, avisos };
}

// ===== Consultas agregadas =====

/** Consulta agregada de gastos/entradas em um período. */
export async function consultarGastos(opts: {
  periodo?: string;
  tipo?: "gasto" | "entrada";
  categoriaNome?: string;
  bancoNome?: string;
  cartaoApelido?: string;
  dominio?: string;
}) {
  const dominio = normDominio(opts.dominio);
  const { start, end, label } = resolvePeriodo(opts.periodo);
  const tipo = opts.tipo || "gasto";

  const where: any = { tipo, dominio, data: { gte: start, lte: end } };
  if (opts.categoriaNome) {
    const catId = await resolverCategoria(opts.categoriaNome, tipo, dominio);
    if (catId) where.categoriaId = catId;
  }
  if (opts.bancoNome) {
    const b = await resolverBanco(opts.bancoNome, dominio);
    if (b) where.bancoId = b.id;
  }
  if (opts.cartaoApelido) {
    const c = await resolverCartao(opts.cartaoApelido, dominio);
    if (c) where.cartaoId = c.id;
  }

  const txs = await prisma.transacao.findMany({
    where,
    include: { categoria: true },
    orderBy: { data: "desc" },
  });

  const total = txs.reduce((acc, t) => acc + t.valorCents, 0);
  const porCategoria: Record<string, number> = {};
  for (const t of txs) {
    const nome = t.categoria?.nome || "Sem categoria";
    porCategoria[nome] = (porCategoria[nome] || 0) + t.valorCents;
  }

  return {
    periodoLabel: label,
    totalCents: total,
    totalFormatado: formatBRL(total),
    quantidade: txs.length,
    porCategoria: Object.entries(porCategoria)
      .map(([nome, cents]) => ({ nome, cents, formatado: formatBRL(cents) }))
      .sort((a, b) => b.cents - a.cents),
  };
}

/** Saldo atual por banco (saldo inicial + entradas - saídas não-crédito). */
export async function consultarSaldo(bancoNome?: string, dominio = "pessoal") {
  const bancos = await prisma.banco.findMany({ where: { ativo: true, dominio } });
  const alvo = bancoNome ? normalize(bancoNome) : null;
  const selecionados = alvo
    ? bancos.filter((b) => normalize(b.nome).includes(alvo) || alvo.includes(normalize(b.nome)))
    : bancos;

  const result = [];
  for (const b of selecionados) {
    const txs = await prisma.transacao.findMany({
      where: { bancoId: b.id, formaPagamento: { not: "credito" } },
    });
    let saldo = b.saldoInicialCents;
    for (const t of txs) {
      saldo += t.tipo === "entrada" ? t.valorCents : -t.valorCents;
    }
    result.push({ nome: b.nome, saldoCents: saldo, formatado: formatBRL(saldo) });
  }
  const totalCents = result.reduce((a, r) => a + r.saldoCents, 0);
  return { bancos: result, totalCents, totalFormatado: formatBRL(totalCents) };
}

// ===== Faturas em aberto (status DERIVADO) =====

/** Faturas de cartão em aberto, agregando compras de crédito + parcelas de cartão do ciclo. */
export async function faturaEmAberto(cartaoApelido?: string, dominio = "pessoal") {
  const cartoes = await prisma.cartao.findMany({ where: { ativo: true, dominio } });
  const alvo = cartaoApelido ? normalize(cartaoApelido) : null;
  const selecionados = alvo
    ? cartoes.filter((c) => normalize(c.apelido).includes(alvo) || alvo.includes(normalize(c.apelido)))
    : cartoes;

  const result = [];
  for (const c of selecionados) {
    // compras de crédito (exclui a própria transação de pagamento de fatura)
    const compras = await prisma.transacao.findMany({
      where: { cartaoId: c.id, formaPagamento: "credito", origemTipo: { not: "pagamento_fatura" } },
      orderBy: { data: "asc" },
    });
    // parcelas de parcelamentos no cartão
    const parcelas = await prisma.parcela.findMany({
      where: { parcelamento: { cartaoId: c.id, forma: "cartao", ativo: true } },
    });
    // pagamentos já feitos (por mês de fatura)
    const pagamentos = await prisma.transacao.findMany({
      where: { cartaoId: c.id, origemTipo: "pagamento_fatura" },
    });
    const mesesPagos = new Set(pagamentos.map((p) => p.faturaMes).filter(Boolean) as string[]);

    const porFatura: Record<string, { cents: number; vencimento: Date | null }> = {};
    const add = (mes: string, cents: number, venc: Date | null) => {
      if (!porFatura[mes]) porFatura[mes] = { cents: 0, vencimento: venc };
      porFatura[mes].cents += cents;
      if (!porFatura[mes].vencimento && venc) porFatura[mes].vencimento = venc;
    };
    for (const t of compras) {
      const f = calcularFatura(t.data, c.diaFechamento, c.diaVencimento);
      const mes = t.faturaMes || f.mesReferencia;
      add(mes, t.valorCents, f.vencimento);
    }
    for (const p of parcelas) {
      const f = calcularFatura(p.vencimento, c.diaFechamento, c.diaVencimento);
      add(p.mesCompetencia || f.mesReferencia, p.valorPrevistoCents, f.vencimento);
    }

    // só faturas ainda não pagas
    const abertas = Object.entries(porFatura).filter(([mes]) => !mesesPagos.has(mes));
    const totalCents = abertas.reduce((a, [, v]) => a + v.cents, 0);
    result.push({
      cartao: c.apelido,
      totalCents,
      totalFormatado: formatBRL(totalCents),
      faturas: abertas
        .map(([mes, v]) => ({
          mes,
          cents: v.cents,
          formatado: formatBRL(v.cents),
          vencimento: v.vencimento ? formatBR(v.vencimento, "dd/MM/yyyy") : null,
        }))
        .sort((a, b) => a.mes.localeCompare(b.mes)),
    });
  }
  const totalGeral = result.reduce((a, r) => a + r.totalCents, 0);
  return { cartoes: result, totalCents: totalGeral, totalFormatado: formatBRL(totalGeral) };
}

/** Paga a fatura de um cartão (quita o ciclo): cria UMA Transacao de saída na conta de pagamento. */
export async function pagarFatura(opts: {
  cartaoApelido?: string;
  mes?: string; // YYYY-MM; se omitido, paga a fatura aberta mais antiga
  valorCents?: number; // se omitido, usa o total derivado
  bancoNome?: string;
  data?: Date;
  origemEntrada?: string;
  dominio?: string;
}) {
  const dominio = normDominio(opts.dominio);
  const cartao = await resolverCartao(opts.cartaoApelido, dominio);
  if (!cartao) {
    return { ok: false, avisos: [`Não encontrei o cartão "${opts.cartaoApelido || ""}".`] };
  }
  const fat = await faturaEmAberto(cartao.apelido, dominio);
  const info = fat.cartoes[0];
  if (!info || info.faturas.length === 0) {
    return { ok: false, avisos: [`Nenhuma fatura em aberto no ${cartao.apelido}.`] };
  }
  const alvo = opts.mes ? info.faturas.find((f) => f.mes === opts.mes) : info.faturas[0];
  if (!alvo) return { ok: false, avisos: [`Não há fatura ${opts.mes} em aberto no ${cartao.apelido}.`] };

  const valorCents = opts.valorCents ?? alvo.cents;
  // conta de pagamento: a informada, senão a vinculada ao cartão
  let banco = opts.bancoNome ? await resolverBanco(opts.bancoNome, dominio) : null;
  if (!banco && cartao.bancoId) {
    const b = await prisma.banco.findUnique({ where: { id: cartao.bancoId } });
    if (b) banco = { id: b.id, nome: b.nome };
  }

  const t = await prisma.transacao.create({
    data: {
      dominio,
      tipo: "gasto",
      valorCents,
      descricao: `Pagamento fatura ${cartao.apelido} (${alvo.mes})`,
      data: opts.data || new Date(),
      formaPagamento: banco ? "debito" : "pix",
      faturaMes: alvo.mes,
      origemTipo: "pagamento_fatura",
      origemEntrada: opts.origemEntrada || "manual",
      cartaoId: cartao.id,
      bancoId: banco?.id || null,
    },
    include: { banco: true },
  });

  return {
    ok: true,
    cartao: cartao.apelido,
    mes: alvo.mes,
    valorCents,
    valorFormatado: formatBRL(valorCents),
    banco: t.banco?.nome || null,
    transacaoId: t.id,
  };
}

// ===== Parcelamentos =====

function zoned(d: Date): Date {
  return toZonedTime(d, TZ);
}
function toUtc(z: Date): Date {
  return fromZonedTime(z, TZ);
}

export interface ParcelamentoInput {
  descricao: string;
  valorParcelaCents: number;
  numParcelas: number;
  forma: "cartao" | "avulso";
  cartaoApelido?: string;
  bancoNome?: string;
  categoriaNome?: string;
  dataPrimeira?: Date; // vencimento da 1ª parcela; padrão = hoje
  dominio?: string;
}

/** Cria um parcelamento e GERA as N parcelas (cada uma com seu vencimento/mês). */
export async function criarParcelamento(input: ParcelamentoInput) {
  const dominio = normDominio(input.dominio);
  const avisos: string[] = [];
  const n = Math.max(1, Math.min(360, Math.round(input.numParcelas)));

  let cartaoId: string | null = null;
  let bancoId: string | null = null;
  let cartao: Awaited<ReturnType<typeof resolverCartao>> = null;
  if (input.forma === "cartao") {
    cartao = await resolverCartao(input.cartaoApelido, dominio);
    if (cartao) cartaoId = cartao.id;
    else avisos.push(`Não encontrei o cartão "${input.cartaoApelido || ""}".`);
  } else {
    const b = await resolverBanco(input.bancoNome, dominio);
    if (b) bancoId = b.id;
  }

  const categoriaId = input.categoriaNome
    ? await resolverCategoria(input.categoriaNome, "gasto", dominio)
    : (await categorizarPorDescricao(input.descricao, "gasto", dominio)).categoriaId;

  const primeira = input.dataPrimeira || new Date();

  const parc = await prisma.parcelamento.create({
    data: {
      dominio,
      descricao: input.descricao,
      valorParcelaCents: input.valorParcelaCents,
      numParcelas: n,
      forma: input.forma,
      cartaoId,
      bancoId,
      categoriaId,
      dataPrimeira: primeira,
    },
  });

  const zPrimeira = zoned(primeira);
  for (let i = 0; i < n; i++) {
    const zVenc = addMonths(zPrimeira, i);
    const vencimento = toUtc(zVenc);
    let faturaId: string | null = null;
    let mesComp = format(zVenc, "yyyy-MM");
    if (input.forma === "cartao" && cartao) {
      const fat = await garantirFatura(cartao as any, vencimento);
      faturaId = fat.id;
      mesComp = fat.mesReferencia;
    }
    await prisma.parcela.create({
      data: {
        parcelamentoId: parc.id,
        dominio,
        numero: i + 1,
        total: n,
        valorPrevistoCents: input.valorParcelaCents,
        vencimento,
        mesCompetencia: mesComp,
        faturaId,
      },
    });
  }

  return {
    ok: true,
    parcelamento: parc,
    numParcelas: n,
    totalCents: input.valorParcelaCents * n,
    totalFormatado: formatBRL(input.valorParcelaCents * n),
    avisos,
  };
}

/** Uma parcela avulsa está paga se existe uma Transacao de baixa vinculada a ela. */
async function parcelaPagaIds(parcelaIds: string[]): Promise<Set<string>> {
  if (parcelaIds.length === 0) return new Set();
  const baixas = await prisma.transacao.findMany({
    where: { parcelaId: { in: parcelaIds }, origemTipo: "baixa_parcela" },
    select: { parcelaId: true },
  });
  return new Set(baixas.map((b) => b.parcelaId!).filter(Boolean));
}

/** Dá baixa na próxima parcela em aberto de um parcelamento avulso (evento = Transacao). */
export async function darBaixaParcela(opts: {
  descricao?: string; // p/ achar o parcelamento
  parcelamentoId?: string;
  valorCents?: number; // padrão: valor previsto da parcela
  bancoNome?: string;
  formaPagamento?: "dinheiro" | "pix" | "debito" | "credito";
  data?: Date;
  origemEntrada?: string;
  dominio?: string;
}) {
  const dominio = normDominio(opts.dominio);
  let parc = opts.parcelamentoId
    ? await prisma.parcelamento.findUnique({ where: { id: opts.parcelamentoId } })
    : null;
  if (!parc && opts.descricao) {
    const todos = await prisma.parcelamento.findMany({ where: { ativo: true, dominio } });
    const alvo = normalize(opts.descricao);
    parc =
      todos.find((p) => normalize(p.descricao) === alvo) ||
      todos.find((p) => normalize(p.descricao).includes(alvo) || alvo.includes(normalize(p.descricao))) ||
      null;
  }
  if (!parc) {
    return { ok: false, avisos: [`Não encontrei o parcelamento "${opts.descricao || ""}".`] };
  }
  if (parc.forma === "cartao") {
    return {
      ok: false,
      avisos: [`"${parc.descricao}" é parcelado no cartão — pague a FATURA do cartão, não a parcela isolada.`],
    };
  }

  const parcelas = await prisma.parcela.findMany({
    where: { parcelamentoId: parc.id },
    orderBy: { numero: "asc" },
  });
  const pagas = await parcelaPagaIds(parcelas.map((p) => p.id));
  const proxima = parcelas.find((p) => !pagas.has(p.id));
  if (!proxima) {
    return { ok: false, avisos: [`O parcelamento "${parc.descricao}" já está quitado. 🎉`] };
  }

  const valorCents = opts.valorCents ?? proxima.valorPrevistoCents;
  const cat = parc.categoriaId
    ? await prisma.categoria.findUnique({ where: { id: parc.categoriaId } })
    : null;

  const { transacao, avisos } = await registrarTransacao({
    tipo: "gasto",
    valorCents,
    descricao: `${parc.descricao} (parcela ${proxima.numero}/${proxima.total})`,
    categoriaNome: cat?.nome,
    data: opts.data,
    formaPagamento: opts.formaPagamento,
    bancoNome: opts.bancoNome || (parc.bancoId ? undefined : undefined),
    parcelaId: proxima.id,
    origemTipo: "baixa_parcela",
    origemId: proxima.id,
    origemEntrada: opts.origemEntrada || "manual",
    dominio,
  });

  const restantes = parcelas.length - pagas.size - 1;
  return {
    ok: true,
    parcelamento: parc.descricao,
    numero: proxima.numero,
    total: proxima.total,
    valorCents,
    valorFormatado: formatBRL(valorCents),
    restantes,
    transacaoId: transacao.id,
    avisos,
  };
}

/** Lista os parcelamentos com progresso (X de N pagas) e próxima parcela. */
export async function listarParcelamentos(dominio = "pessoal") {
  const lista = await prisma.parcelamento.findMany({
    where: { ativo: true, dominio },
    include: { parcelas: { orderBy: { numero: "asc" } }, cartao: true, banco: true, categoria: true },
    orderBy: { createdAt: "desc" },
  });

  const todasParcelaIds = lista.flatMap((p) => (p.forma === "avulso" ? p.parcelas.map((x) => x.id) : []));
  const pagasAvulso = await parcelaPagaIds(todasParcelaIds);

  // para cartão: meses de fatura já pagos por cartão
  const mesesPagosPorCartao: Record<string, Set<string>> = {};
  for (const p of lista) {
    if (p.forma === "cartao" && p.cartaoId && !mesesPagosPorCartao[p.cartaoId]) {
      const pags = await prisma.transacao.findMany({
        where: { cartaoId: p.cartaoId, origemTipo: "pagamento_fatura" },
        select: { faturaMes: true },
      });
      mesesPagosPorCartao[p.cartaoId] = new Set(pags.map((x) => x.faturaMes).filter(Boolean) as string[]);
    }
  }

  return lista.map((p) => {
    const isPaga = (parcela: (typeof p.parcelas)[number]) =>
      p.forma === "avulso"
        ? pagasAvulso.has(parcela.id)
        : !!(p.cartaoId && mesesPagosPorCartao[p.cartaoId]?.has(parcela.mesCompetencia));
    const pagas = p.parcelas.filter(isPaga).length;
    const proxima = p.parcelas.find((x) => !isPaga(x)) || null;
    const totalCents = p.valorParcelaCents * p.numParcelas;
    const pagoCents = pagas * p.valorParcelaCents;
    return {
      id: p.id,
      descricao: p.descricao,
      forma: p.forma,
      cartao: p.cartao?.apelido || null,
      banco: p.banco?.nome || null,
      categoria: p.categoria?.nome || null,
      valorParcelaCents: p.valorParcelaCents,
      valorParcelaFormatado: formatBRL(p.valorParcelaCents),
      numParcelas: p.numParcelas,
      pagas,
      restantes: p.numParcelas - pagas,
      totalCents,
      totalFormatado: formatBRL(totalCents),
      pagoCents,
      pagoFormatado: formatBRL(pagoCents),
      restanteCents: totalCents - pagoCents,
      restanteFormatado: formatBRL(totalCents - pagoCents),
      progresso: Math.round((pagas / p.numParcelas) * 100),
      proxima: proxima
        ? {
            numero: proxima.numero,
            vencimento: formatBR(proxima.vencimento, "dd/MM/yyyy"),
            mesCompetencia: proxima.mesCompetencia,
          }
        : null,
      quitado: pagas >= p.numParcelas,
    };
  });
}

// ===== Contas fixas / compromissos =====

export function mesAtual(): string {
  const z = nowZoned();
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}`;
}

/** Lista as contas fixas do mês com status (paga ou não), valor e vencimento. */
export async function listarContasAPagar(mes?: string, dominio = "pessoal") {
  const ref = mes || mesAtual();
  const [ano, m] = ref.split("-").map(Number);
  const { start, end } = resolvePeriodo(ref);

  const contas = await prisma.contaFixa.findMany({
    where: { ativo: true, dominio, tipo: { not: "recebimento" } },
    orderBy: { diaVencimento: "asc" },
  });

  const itens = [];
  for (const c of contas) {
    const pagamentos = await prisma.transacao.findMany({
      where: { contaFixaId: c.id, data: { gte: start, lte: end } },
    });
    const pago = pagamentos.length > 0;
    const valorPagoCents = pagamentos.reduce((a, p) => a + p.valorCents, 0);
    const dia = Math.min(c.diaVencimento, 28);
    const vencimento = `${String(dia).padStart(2, "0")}/${String(m).padStart(2, "0")}/${ano}`;
    itens.push({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      diaVencimento: c.diaVencimento,
      vencimento,
      previstoCents: c.valorPrevistoCents ?? null,
      previstoFormatado: c.valorPrevistoCents != null ? formatBRL(c.valorPrevistoCents) : null,
      pago,
      valorPagoCents,
      valorPagoFormatado: formatBRL(valorPagoCents),
    });
  }

  const totalPrevisto = itens.reduce((a, i) => a + (i.previstoCents ?? 0), 0);
  const totalPago = itens.reduce((a, i) => a + i.valorPagoCents, 0);
  const aPagar = itens.filter((i) => !i.pago);
  const totalAPagar = aPagar.reduce((a, i) => a + (i.previstoCents ?? 0), 0);

  return {
    mes: ref,
    itens,
    totalPrevisto,
    totalPrevistoFormatado: formatBRL(totalPrevisto),
    totalPago,
    totalPagoFormatado: formatBRL(totalPago),
    totalAPagar,
    totalAPagarFormatado: formatBRL(totalAPagar),
    quantasAPagar: aPagar.length,
  };
}

/** Registra o pagamento de uma conta fixa (cria um gasto vinculado a ela). */
export async function registrarPagamentoContaFixa(opts: {
  nome: string;
  valorCents: number;
  formaPagamento?: "dinheiro" | "pix" | "debito" | "credito";
  bancoNome?: string;
  cartaoApelido?: string;
  data?: Date;
  origemEntrada?: string;
  dominio?: string;
}) {
  const dominio = normDominio(opts.dominio);
  const alvo = await resolverContaFixa(opts.nome, dominio);
  if (!alvo) {
    return { ok: false, avisos: [`Não encontrei a conta fixa "${opts.nome}". Cadastre em Contas fixas.`] };
  }

  const cat = alvo.categoriaId
    ? await prisma.categoria.findUnique({ where: { id: alvo.categoriaId } })
    : null;

  const { transacao, avisos } = await registrarTransacao({
    tipo: "gasto",
    valorCents: opts.valorCents,
    descricao: `Pagamento ${alvo.nome}`,
    categoriaNome: cat?.nome || "Moradia/Contas",
    data: opts.data,
    formaPagamento: opts.formaPagamento,
    bancoNome: opts.bancoNome,
    cartaoApelido: opts.cartaoApelido,
    contaFixaId: alvo.id,
    origemTipo: "conta_fixa",
    origemId: alvo.id,
    origemEntrada: opts.origemEntrada,
    dominio,
  });

  return { ok: true, transacao, conta: alvo.nome, avisos };
}

// ===== Camada 1: perfil financeiro, tetos, assinaturas, saldo previsto, projeção =====

/** Lê (ou cria) o perfil financeiro do domínio (renda base, reserva, risco). */
export async function getPerfil(dominio = "pessoal") {
  return prisma.perfilFinanceiro.upsert({
    where: { dominio },
    update: {},
    create: { dominio },
  });
}

/** Assinaturas ativas (compromissos tipo=assinatura) + total mensal. */
export async function listarAssinaturas(dominio = "pessoal") {
  const subs = await prisma.contaFixa.findMany({
    where: { ativo: true, dominio, OR: [{ tipo: "assinatura" }, { isAssinatura: true }] },
    orderBy: { valorPrevistoCents: "desc" },
  });
  const totalCents = subs.reduce((a, s) => a + (s.valorPrevistoCents || 0), 0);
  return {
    itens: subs.map((s) => ({
      id: s.id,
      nome: s.nome,
      valorCents: s.valorPrevistoCents || 0,
      formatado: formatBRL(s.valorPrevistoCents || 0),
      diaVencimento: s.diaVencimento,
    })),
    totalCents,
    totalFormatado: formatBRL(totalCents),
    quantidade: subs.length,
  };
}

/** Gastos do mês por categoria comparados ao teto (orçamento). */
export async function gastosVsTeto(periodo = "mes", dominio = "pessoal") {
  const { start, end, label } = resolvePeriodo(periodo);
  const cats = await prisma.categoria.findMany({ where: { tipo: "gasto", dominio } });
  const itens = [];
  for (const c of cats) {
    const txs = await prisma.transacao.findMany({
      where: { tipo: "gasto", categoriaId: c.id, data: { gte: start, lte: end } },
    });
    const gastoCents = txs.reduce((a, t) => a + t.valorCents, 0);
    if (gastoCents === 0 && !c.orcamentoMensalCents) continue;
    const teto = c.orcamentoMensalCents ?? null;
    const pct = teto ? Math.round((gastoCents / teto) * 100) : null;
    itens.push({
      nome: c.nome,
      gastoCents,
      gastoFormatado: formatBRL(gastoCents),
      tetoCents: teto,
      tetoFormatado: teto != null ? formatBRL(teto) : null,
      pct,
      estourou: teto != null ? gastoCents > teto : false,
    });
  }
  itens.sort((a, b) => b.gastoCents - a.gastoCents);
  return { periodoLabel: label, itens };
}

/** Saldo previsto pro fim do mês = saldo atual − contas fixas a pagar − parcelas avulsas do mês. */
export async function saldoPrevisto(dominio = "pessoal") {
  const saldos = await consultarSaldo(undefined, dominio);
  const contas = await listarContasAPagar(undefined, dominio);
  const previstoCents = saldos.totalCents - contas.totalAPagar;
  return {
    saldoAtualCents: saldos.totalCents,
    saldoAtualFormatado: saldos.totalFormatado,
    aPagarCents: contas.totalAPagar,
    aPagarFormatado: contas.totalAPagarFormatado,
    previstoCents,
    previstoFormatado: formatBRL(previstoCents),
  };
}

/** Projeção de caixa mês a mês (próximos N meses), considerando contas fixas + parcelas. */
export async function projecaoCaixa(dominio = "pessoal", meses = 6) {
  const saldos = await consultarSaldo(undefined, dominio);
  let saldo = saldos.totalCents;

  const fixos = await prisma.contaFixa.findMany({ where: { ativo: true, dominio } });
  const saidasFixasMes = fixos
    .filter((f) => f.tipo !== "recebimento")
    .reduce((a, f) => a + (f.valorPrevistoCents || 0), 0);
  const entradasFixasMes = fixos
    .filter((f) => f.tipo === "recebimento")
    .reduce((a, f) => a + (f.valorPrevistoCents || 0), 0);

  const z = nowZoned();
  const out = [];
  for (let i = 0; i < meses; i++) {
    const zMes = addMonths(z, i);
    const ref = format(zMes, "yyyy-MM");
    // parcelas que vencem nesse mês (qualquer forma)
    const parcelas = await prisma.parcela.findMany({ where: { dominio, mesCompetencia: ref } });
    const saidasParcelas = parcelas.reduce((a, p) => a + p.valorPrevistoCents, 0);
    const saidas = saidasFixasMes + saidasParcelas;
    const entradas = entradasFixasMes;
    saldo = saldo + entradas - saidas;
    out.push({
      mes: ref,
      label: format(zMes, "MM/yyyy"),
      entradasCents: entradas,
      entradasFormatado: formatBRL(entradas),
      saidasCents: saidas,
      saidasFormatado: formatBRL(saidas),
      saldoFimCents: saldo,
      saldoFimFormatado: formatBRL(saldo),
    });
  }
  return out;
}

/** Monta um retrato financeiro compacto pra injetar no contexto do agente (CFO). */
export async function montarSnapshotFinanceiro(dominio = "pessoal"): Promise<string> {
  const [perfil, sp, gv, entradas, gastos, subs] = await Promise.all([
    getPerfil(dominio),
    saldoPrevisto(dominio),
    gastosVsTeto("mes", dominio),
    consultarGastos({ periodo: "mes", tipo: "entrada", dominio }),
    consultarGastos({ periodo: "mes", tipo: "gasto", dominio }),
    listarAssinaturas(dominio),
  ]);
  const estouros = gv.itens.filter((i) => i.estourou);
  const linhas = [
    `Renda base/mês: ${formatBRL(perfil.rendaBaseCents)} | meta guardar: ${perfil.percentualInvestir}% | risco: ${perfil.perfilRisco}`,
    `Reserva: ${formatBRL(perfil.reservaAtualCents)} de ${formatBRL(perfil.reservaMetaCents)} (meta)`,
    `Mês: entrou ${entradas.totalFormatado} | gastou ${gastos.totalFormatado}`,
    `Saldo atual ${sp.saldoAtualFormatado} | a pagar ${sp.aPagarFormatado} | previsto fim do mês ${sp.previstoFormatado}`,
    `Assinaturas: ${subs.quantidade} ativas = ${subs.totalFormatado}/mês`,
  ];
  if (estouros.length) {
    linhas.push(
      `ESTOUROS: ${estouros.map((e) => `${e.nome} (${e.gastoFormatado}/${e.tetoFormatado}, ${e.pct}%)`).join("; ")}`
    );
  }
  const comTeto = gv.itens.filter((i) => i.tetoCents != null && !i.estourou).slice(0, 5);
  if (comTeto.length) {
    linhas.push(`Tetos: ${comTeto.map((e) => `${e.nome} ${e.pct}%`).join(", ")}`);
  }
  return linhas.join("\n");
}

const MESES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Movimento (entrou/saiu/sobrou) dos últimos N meses, para o gráfico de barras. */
export async function movimentoMensal(dominio = "pessoal", meses = 6) {
  const z = nowZoned();
  const out = [];
  for (let i = meses - 1; i >= 0; i--) {
    const zMes = addMonths(z, -i);
    const ref = format(zMes, "yyyy-MM");
    const { start, end } = resolvePeriodo(ref);
    const txs = await prisma.transacao.findMany({
      where: { dominio, data: { gte: start, lte: end } },
      select: { tipo: true, valorCents: true },
    });
    let entradas = 0;
    let saidas = 0;
    for (const t of txs) {
      if (t.tipo === "entrada") entradas += t.valorCents;
      else saidas += t.valorCents;
    }
    out.push({
      mes: ref,
      label: MESES_ABBR[zMes.getMonth()],
      entradasCents: entradas,
      saidasCents: saidas,
      sobraCents: entradas - saidas,
    });
  }
  return out;
}

/** Resumo para o dashboard. */
export async function resumoDashboard(dominio = "pessoal") {
  const gastosMes = await consultarGastos({ periodo: "mes", tipo: "gasto", dominio });
  const entradasMes = await consultarGastos({ periodo: "mes", tipo: "entrada", dominio });
  const saldos = await consultarSaldo(undefined, dominio);
  const faturas = await faturaEmAberto(undefined, dominio);
  const ultimas = await prisma.transacao.findMany({
    where: { dominio },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { categoria: true, banco: true, cartao: true },
  });
  const contasAPagar = await listarContasAPagar(undefined, dominio);
  const parcelamentos = await listarParcelamentos(dominio);
  const assinaturas = await listarAssinaturas(dominio);
  const projecao = await projecaoCaixa(dominio, 6);
  const movimento = await movimentoMensal(dominio, 6);
  return { gastosMes, entradasMes, saldos, faturas, ultimas, contasAPagar, parcelamentos, assinaturas, projecao, movimento };
}
