import { prisma } from "./prisma";
import { resolvePeriodo, calcularFatura, formatBR, nowZoned } from "./dates";
import { formatBRL } from "./money";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Acha categoria por nome (tolerante a acento/caixa) ou cria; cai em "Outros". */
export async function resolverCategoria(nome: string | undefined, tipo: string): Promise<string | null> {
  const cats = await prisma.categoria.findMany({ where: { tipo } });
  if (nome) {
    const alvo = normalize(nome);
    const match =
      cats.find((c) => normalize(c.nome) === alvo) ||
      cats.find((c) => normalize(c.nome).includes(alvo) || alvo.includes(normalize(c.nome)));
    if (match) return match.id;
    // cria nova categoria com esse nome
    const nova = await prisma.categoria.create({
      data: { nome: nome.slice(0, 40), tipo },
    });
    return nova.id;
  }
  const outros = cats.find((c) => normalize(c.nome) === "outros");
  return outros?.id ?? null;
}

export async function resolverBanco(nome?: string): Promise<{ id: string; nome: string } | null> {
  if (!nome) return null;
  const bancos = await prisma.banco.findMany({ where: { ativo: true } });
  const alvo = normalize(nome);
  const match =
    bancos.find((b) => normalize(b.nome) === alvo) ||
    bancos.find((b) => normalize(b.nome).includes(alvo) || alvo.includes(normalize(b.nome)));
  return match ? { id: match.id, nome: match.nome } : null;
}

export async function resolverCartao(apelido?: string) {
  const cartoes = await prisma.cartao.findMany({ where: { ativo: true } });
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
  origem?: string;
  rawInput?: string;
}

/** Retorna a conta marcada como "recebe salário", se houver. */
export async function getContaSalario() {
  return prisma.banco.findFirst({ where: { ativo: true, contaSalario: true } });
}

export async function registrarTransacao(input: RegistroInput) {
  const data = input.data || new Date();
  const forma = input.formaPagamento || "dinheiro";
  const avisos: string[] = [];

  const categoriaId = await resolverCategoria(input.categoriaNome, input.tipo);

  let bancoId: string | null = null;
  let cartaoId: string | null = null;
  let faturaMes: string | null = null;

  if (forma === "credito") {
    const cartao = await resolverCartao(input.cartaoApelido);
    if (cartao) {
      cartaoId = cartao.id;
      const f = calcularFatura(data, cartao.diaFechamento, cartao.diaVencimento);
      faturaMes = f.mesReferencia;
    } else {
      avisos.push(
        input.cartaoApelido
          ? `Não encontrei o cartão "${input.cartaoApelido}". Cadastre-o no painel.`
          : "Forma de pagamento crédito, mas nenhum cartão informado/cadastrado."
      );
    }
  } else {
    const banco = await resolverBanco(input.bancoNome);
    if (banco) bancoId = banco.id;
    else if (input.bancoNome) avisos.push(`Não encontrei o banco "${input.bancoNome}".`);

    // Entrada sem banco informado → usa a conta de salário; senão, a única conta de recebimento.
    if (!bancoId && input.tipo === "entrada") {
      const salario = await getContaSalario();
      if (salario) {
        bancoId = salario.id;
      } else {
        const receber = await prisma.banco.findMany({ where: { ativo: true, contaReceber: true } });
        if (receber.length === 1) bancoId = receber[0].id;
      }
    }
  }

  const t = await prisma.transacao.create({
    data: {
      tipo: input.tipo,
      valorCents: input.valorCents,
      descricao: input.descricao,
      data,
      formaPagamento: forma,
      faturaMes,
      origem: input.origem || "manual",
      rawInput: input.rawInput,
      categoriaId,
      bancoId,
      cartaoId,
      contaFixaId: input.contaFixaId || null,
    },
    include: { categoria: true, banco: true, cartao: true },
  });

  return { transacao: t, avisos };
}

/** Consulta agregada de gastos/entradas em um período. */
export async function consultarGastos(opts: {
  periodo?: string;
  tipo?: "gasto" | "entrada";
  categoriaNome?: string;
  bancoNome?: string;
  cartaoApelido?: string;
}) {
  const { start, end, label } = resolvePeriodo(opts.periodo);
  const tipo = opts.tipo || "gasto";

  const where: any = { tipo, data: { gte: start, lte: end } };
  if (opts.categoriaNome) {
    const catId = await resolverCategoria(opts.categoriaNome, tipo);
    if (catId) where.categoriaId = catId;
  }
  if (opts.bancoNome) {
    const b = await resolverBanco(opts.bancoNome);
    if (b) where.bancoId = b.id;
  }
  if (opts.cartaoApelido) {
    const c = await resolverCartao(opts.cartaoApelido);
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

/** Saldo atual por banco (saldo inicial + entradas - gastos não-crédito). */
export async function consultarSaldo(bancoNome?: string) {
  const bancos = await prisma.banco.findMany({ where: { ativo: true } });
  const alvo = bancoNome ? normalize(bancoNome) : null;
  const selecionados = alvo
    ? bancos.filter(
        (b) => normalize(b.nome).includes(alvo) || alvo.includes(normalize(b.nome))
      )
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

/** Faturas de cartão em aberto (não pagas), com vencimento. */
export async function faturaEmAberto(cartaoApelido?: string) {
  const cartoes = await prisma.cartao.findMany({ where: { ativo: true } });
  const alvo = cartaoApelido ? normalize(cartaoApelido) : null;
  const selecionados = alvo
    ? cartoes.filter(
        (c) => normalize(c.apelido).includes(alvo) || alvo.includes(normalize(c.apelido))
      )
    : cartoes;

  const result = [];
  for (const c of selecionados) {
    const txs = await prisma.transacao.findMany({
      where: { cartaoId: c.id, formaPagamento: "credito", pago: false },
      orderBy: { data: "asc" },
    });
    // agrupa por mês de fatura
    const porFatura: Record<string, { cents: number; vencimento: Date | null }> = {};
    for (const t of txs) {
      const mes = t.faturaMes || "sem-mes";
      if (!porFatura[mes]) {
        const f = calcularFatura(t.data, c.diaFechamento, c.diaVencimento);
        porFatura[mes] = { cents: 0, vencimento: f.vencimento };
      }
      porFatura[mes].cents += t.valorCents;
    }
    const totalCents = txs.reduce((a, t) => a + t.valorCents, 0);
    result.push({
      cartao: c.apelido,
      totalCents,
      totalFormatado: formatBRL(totalCents),
      faturas: Object.entries(porFatura)
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

// ===== Contas fixas =====

export function mesAtual(): string {
  const z = nowZoned();
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}`;
}

export async function resolverContaFixa(nome?: string) {
  if (!nome) return null;
  const contas = await prisma.contaFixa.findMany({ where: { ativo: true } });
  const alvo = normalize(nome);
  return (
    contas.find((c) => normalize(c.nome) === alvo) ||
    contas.find((c) => normalize(c.nome).includes(alvo) || alvo.includes(normalize(c.nome))) ||
    null
  );
}

/** Lista as contas fixas do mês com status (paga ou não), valor e vencimento. */
export async function listarContasAPagar(mes?: string) {
  const ref = mes || mesAtual();
  const [ano, m] = ref.split("-").map(Number);
  const { start, end } = resolvePeriodo(ref);

  const contas = await prisma.contaFixa.findMany({
    where: { ativo: true },
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
  origem?: string;
}) {
  const alvo = await resolverContaFixa(opts.nome);
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
    origem: opts.origem,
  });

  return { ok: true, transacao, conta: alvo.nome, avisos };
}

// ===== Camada 1: perfil financeiro, tetos, assinaturas, saldo previsto =====

/** Lê (ou cria) o perfil financeiro (renda base, reserva, risco). */
export async function getPerfil() {
  return prisma.perfilFinanceiro.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

/** Assinaturas ativas (contas fixas marcadas como assinatura) + total mensal. */
export async function listarAssinaturas() {
  const subs = await prisma.contaFixa.findMany({
    where: { ativo: true, isAssinatura: true },
    orderBy: { valorPrevistoCents: "desc" },
  });
  const totalCents = subs.reduce((a, s) => a + (s.valorPrevistoCents || 0), 0);
  return {
    itens: subs.map((s) => ({
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
export async function gastosVsTeto(periodo = "mes") {
  const { start, end, label } = resolvePeriodo(periodo);
  const cats = await prisma.categoria.findMany({ where: { tipo: "gasto" } });
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

/** Saldo previsto pro fim do mês = saldo atual − contas fixas a pagar. */
export async function saldoPrevisto() {
  const saldos = await consultarSaldo();
  const contas = await listarContasAPagar();
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

/** Monta um retrato financeiro compacto pra injetar no contexto do agente (CFO). */
export async function montarSnapshotFinanceiro(): Promise<string> {
  const [perfil, sp, gv, entradas, gastos, subs] = await Promise.all([
    getPerfil(),
    saldoPrevisto(),
    gastosVsTeto("mes"),
    consultarGastos({ periodo: "mes", tipo: "entrada" }),
    consultarGastos({ periodo: "mes", tipo: "gasto" }),
    listarAssinaturas(),
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

/** Resumo para o dashboard. */
export async function resumoDashboard() {
  const gastosMes = await consultarGastos({ periodo: "mes", tipo: "gasto" });
  const entradasMes = await consultarGastos({ periodo: "mes", tipo: "entrada" });
  const saldos = await consultarSaldo();
  const faturas = await faturaEmAberto();
  const ultimas = await prisma.transacao.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { categoria: true, banco: true, cartao: true },
  });
  const contasAPagar = await listarContasAPagar();
  return { gastosMes, entradasMes, saldos, faturas, ultimas, contasAPagar };
}
