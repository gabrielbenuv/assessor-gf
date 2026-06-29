import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";
import { toCents } from "@/lib/money";
import { darBaixaParcela, normDominio } from "@/lib/finance";

export const dynamic = "force-dynamic";

// Dá baixa na próxima parcela em aberto de um parcelamento avulso (baixa = evento/Transacao).
export async function POST(req: Request) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  const dominio = normDominio(body.dominio);

  let bancoNome: string | undefined;
  if (body.bancoId) bancoNome = (await prisma.banco.findUnique({ where: { id: body.bancoId } }))?.nome;

  const r = await darBaixaParcela({
    parcelamentoId: body.parcelamentoId,
    descricao: body.descricao,
    valorCents: body.valor != null ? toCents(body.valor) : undefined,
    bancoNome,
    formaPagamento: body.formaPagamento,
    data: body.data ? new Date(`${body.data}T12:00:00-03:00`) : undefined,
    dominio,
  });
  if (!r.ok) return NextResponse.json({ error: r.avisos?.join(" ") || "Falha na baixa." }, { status: 400 });
  return NextResponse.json(r, { status: 201 });
}
