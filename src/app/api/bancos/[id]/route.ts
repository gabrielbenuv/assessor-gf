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
  if (body.tipo !== undefined) data.tipo = body.tipo;
  if (body.saldoInicial !== undefined) data.saldoInicialCents = toCents(body.saldoInicial);
  if (body.ativo !== undefined) data.ativo = body.ativo;
  if (body.contaSalario !== undefined) {
    data.contaSalario = body.contaSalario;
    if (body.contaSalario) {
      const atual = await prisma.banco.findUnique({ where: { id: params.id } });
      await prisma.banco.updateMany({ where: { dominio: atual?.dominio ?? "pessoal" }, data: { contaSalario: false } });
    }
  }
  if (body.contaReceber !== undefined) data.contaReceber = body.contaReceber;
  const banco = await prisma.banco.update({ where: { id: params.id }, data });
  return NextResponse.json(banco);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = guard();
  if (g) return g;
  await prisma.banco.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
