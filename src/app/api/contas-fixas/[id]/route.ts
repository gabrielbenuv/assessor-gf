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
  if (body.nome !== undefined) data.nome = body.nome;
  if (body.valorPrevisto !== undefined)
    data.valorPrevistoCents = body.valorPrevisto ? toCents(body.valorPrevisto) : null;
  if (body.diaVencimento !== undefined) data.diaVencimento = Number(body.diaVencimento);
  if (body.categoriaId !== undefined) data.categoriaId = body.categoriaId || null;
  if (body.bancoId !== undefined) data.bancoId = body.bancoId || null;
  if (body.ativo !== undefined) data.ativo = body.ativo;
  if (body.usaPadrao !== undefined) data.usaPadrao = body.usaPadrao;
  if (body.lembreteDiasAntes !== undefined)
    data.lembreteDiasAntes = body.lembreteDiasAntes === null || body.lembreteDiasAntes === "" ? null : Number(body.lembreteDiasAntes);
  const conta = await prisma.contaFixa.update({ where: { id: params.id }, data });
  return NextResponse.json(conta);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = guard();
  if (g) return g;
  await prisma.contaFixa.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
