import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = guard();
  if (g) return g;
  const numeros = await prisma.numeroAutorizado.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(numeros);
}

export async function POST(req: Request) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  const numero = (body.numero || "").replace(/\D/g, "");
  if (!numero) return NextResponse.json({ error: "Número inválido." }, { status: 400 });
  try {
    const n = await prisma.numeroAutorizado.create({
      data: { numero, apelido: body.apelido || null, ativo: body.ativo ?? true },
    });
    return NextResponse.json(n, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Número já cadastrado." }, { status: 409 });
  }
}
