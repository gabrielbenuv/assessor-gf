import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.nome !== undefined) data.nome = body.nome;
  if (body.emoji !== undefined) data.emoji = body.emoji || null;
  if (body.ativo !== undefined) data.ativo = body.ativo;
  const cat = await prisma.categoria.update({ where: { id: params.id }, data });
  return NextResponse.json(cat);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = guard();
  if (g) return g;
  await prisma.categoria.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
