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
  const dominioParam = searchParams.get("dominio");
  const categorias = await prisma.categoria.findMany({
    where: dominioParam ? { dominio: dominioParam } : undefined,
    orderBy: [{ tipo: "asc" }, { nome: "asc" }],
  });
  return NextResponse.json(categorias);
}

export async function POST(req: Request) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  if (!body.nome) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  try {
    const cat = await prisma.categoria.create({
      data: {
        nome: body.nome,
        dominio: normDominio(body.dominio),
        tipo: body.tipo || "gasto",
        emoji: body.emoji || null,
        orcamentoMensalCents: body.orcamentoMensal ? toCents(body.orcamentoMensal) : null,
      },
    });
    return NextResponse.json(cat, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Categoria já existe." }, { status: 409 });
  }
}
