import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = guard();
  if (g) return g;
  const categorias = await prisma.categoria.findMany({
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
      data: { nome: body.nome, tipo: body.tipo || "gasto", emoji: body.emoji || null },
    });
    return NextResponse.json(cat, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Categoria já existe." }, { status: 409 });
  }
}
