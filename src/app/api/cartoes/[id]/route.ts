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
  if (body.apelido !== undefined) data.apelido = body.apelido;
  if (body.bandeira !== undefined) data.bandeira = body.bandeira || null;
  if (body.diaFechamento !== undefined) data.diaFechamento = Number(body.diaFechamento);
  if (body.diaVencimento !== undefined) data.diaVencimento = Number(body.diaVencimento);
  if (body.limite !== undefined) data.limiteCents = body.limite ? toCents(body.limite) : null;
  if (body.bancoId !== undefined) data.bancoId = body.bancoId || null;
  if (body.ativo !== undefined) data.ativo = body.ativo;
  if (body.lembreteFaturaAtivo !== undefined) data.lembreteFaturaAtivo = body.lembreteFaturaAtivo;
  if (body.lembreteDiasAntes !== undefined) data.lembreteDiasAntes = Number(body.lembreteDiasAntes);
  if (body.lembreteFechamentoAtivo !== undefined) data.lembreteFechamentoAtivo = body.lembreteFechamentoAtivo;
  const cartao = await prisma.cartao.update({ where: { id: params.id }, data });
  return NextResponse.json(cartao);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = guard();
  if (g) return g;
  await prisma.cartao.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
