import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";
import { toCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.valor !== undefined) data.valorCents = toCents(body.valor);
  if (body.descricao !== undefined) data.descricao = body.descricao;
  if (body.categoriaId !== undefined) data.categoriaId = body.categoriaId || null;
  if (body.data !== undefined) data.data = new Date(body.data);
  if (body.tipo !== undefined) data.tipo = body.tipo;
  if (body.pago !== undefined) {
    data.pago = body.pago;
    data.pagoEm = body.pago ? new Date() : null;
  }
  const t = await prisma.transacao.update({ where: { id: params.id }, data });
  return NextResponse.json(t);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = guard();
  if (g) return g;
  await prisma.transacao.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
