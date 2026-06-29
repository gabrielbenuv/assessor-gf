import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";
import { toCents } from "@/lib/money";
import { resolvePeriodo, calcularFatura } from "@/lib/dates";
import { garantirFatura, normDominio } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = guard();
  if (g) return g;
  const { searchParams } = new URL(req.url);
  const periodo = searchParams.get("periodo");
  const tipo = searchParams.get("tipo");
  const dominio = searchParams.get("dominio");

  const where: any = {};
  if (tipo) where.tipo = tipo;
  if (dominio) where.dominio = dominio;
  if (periodo) {
    const { start, end } = resolvePeriodo(periodo);
    where.data = { gte: start, lte: end };
  }

  const transacoes = await prisma.transacao.findMany({
    where,
    include: { categoria: true, banco: true, cartao: true },
    orderBy: { data: "desc" },
    take: periodo ? 500 : 100,
  });
  return NextResponse.json(transacoes);
}

export async function POST(req: Request) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  if (!body.valor || !body.descricao) {
    return NextResponse.json({ error: "Valor e descrição são obrigatórios." }, { status: 400 });
  }
  const forma = body.formaPagamento || "dinheiro";
  const data = body.data ? new Date(body.data) : new Date();
  const dominio = normDominio(body.dominio);

  let faturaMes: string | null = null;
  let cartaoId: string | null = null;
  let bancoId: string | null = null;
  let faturaId: string | null = null;

  if (forma === "credito" && body.cartaoId) {
    cartaoId = body.cartaoId;
    const cartao = await prisma.cartao.findUnique({ where: { id: body.cartaoId } });
    if (cartao) {
      faturaMes = calcularFatura(data, cartao.diaFechamento, cartao.diaVencimento).mesReferencia;
      const fat = await garantirFatura(cartao, data);
      faturaId = fat.id;
    }
  } else if (forma !== "credito") {
    bancoId = body.bancoId || null;
  }

  const t = await prisma.transacao.create({
    data: {
      dominio,
      tipo: body.tipo || "gasto",
      valorCents: toCents(body.valor),
      descricao: body.descricao,
      data,
      formaPagamento: forma,
      faturaMes,
      origemTipo: "avulso",
      origemEntrada: "manual",
      categoriaId: body.categoriaId || null,
      bancoId,
      cartaoId,
      faturaId,
    },
    include: { categoria: true, banco: true, cartao: true },
  });
  return NextResponse.json(t, { status: 201 });
}
