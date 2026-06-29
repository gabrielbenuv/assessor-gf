import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";
import { toCents } from "@/lib/money";
import { normDominio } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = guard();
  if (g) return g;
  const { searchParams } = new URL(req.url);
  const dominio = searchParams.get("dominio");
  const tipo = searchParams.get("tipo");
  const where: any = {};
  if (dominio) where.dominio = dominio;
  if (tipo) where.tipo = tipo;
  const contas = await prisma.contaFixa.findMany({
    where,
    orderBy: { diaVencimento: "asc" },
    include: { categoria: true, banco: true },
  });
  return NextResponse.json(contas);
}

export async function POST(req: Request) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  if (!body.nome || !body.diaVencimento) {
    return NextResponse.json({ error: "Nome e dia de vencimento são obrigatórios." }, { status: 400 });
  }
  const tipo = body.tipo || (body.isAssinatura ? "assinatura" : "conta_fixa");
  try {
    const conta = await prisma.contaFixa.create({
      data: {
        nome: body.nome,
        dominio: normDominio(body.dominio),
        tipo,
        recorrencia: body.recorrencia || "mensal",
        isAssinatura: tipo === "assinatura",
        valorPrevistoCents: body.valorPrevisto ? toCents(body.valorPrevisto) : null,
        diaVencimento: Number(body.diaVencimento),
        categoriaId: body.categoriaId || null,
        bancoId: body.bancoId || null,
        ativo: body.ativo ?? true,
        usaPadrao: body.usaPadrao ?? true,
        lembreteDiasAntes: body.lembreteDiasAntes != null ? Number(body.lembreteDiasAntes) : null,
      },
    });
    return NextResponse.json(conta, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Já existe um compromisso com esse nome." }, { status: 409 });
  }
}
