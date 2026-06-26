import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";
import { toCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = guard();
  if (g) return g;
  const cartoes = await prisma.cartao.findMany({
    orderBy: { apelido: "asc" },
    include: { banco: true },
  });
  return NextResponse.json(cartoes);
}

export async function POST(req: Request) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  if (!body.apelido) return NextResponse.json({ error: "Apelido é obrigatório." }, { status: 400 });
  if (!body.diaFechamento || !body.diaVencimento) {
    return NextResponse.json({ error: "Informe dia de fechamento e vencimento." }, { status: 400 });
  }
  try {
    const cartao = await prisma.cartao.create({
      data: {
        apelido: body.apelido,
        bandeira: body.bandeira || null,
        diaFechamento: Number(body.diaFechamento),
        diaVencimento: Number(body.diaVencimento),
        limiteCents: body.limite ? toCents(body.limite) : null,
        bancoId: body.bancoId || null,
        ativo: body.ativo ?? true,
        lembreteFaturaAtivo: body.lembreteFaturaAtivo ?? true,
        lembreteDiasAntes: body.lembreteDiasAntes != null ? Number(body.lembreteDiasAntes) : 5,
        lembreteFechamentoAtivo: body.lembreteFechamentoAtivo ?? false,
      },
    });
    return NextResponse.json(cartao, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: "Já existe um cartão com esse apelido." }, { status: 409 });
  }
}
