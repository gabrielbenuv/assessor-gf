import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";
import { toCents } from "@/lib/money";
import { pagarFatura, normDominio } from "@/lib/finance";

export const dynamic = "force-dynamic";

// Paga a fatura de um cartão (quita o ciclo): cria UMA transação de saída.
export async function POST(req: Request) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  const dominio = normDominio(body.dominio);

  let cartaoApelido: string | undefined = body.cartao;
  if (!cartaoApelido && body.cartaoId)
    cartaoApelido = (await prisma.cartao.findUnique({ where: { id: body.cartaoId } }))?.apelido;

  let bancoNome: string | undefined = body.banco;
  if (!bancoNome && body.bancoId)
    bancoNome = (await prisma.banco.findUnique({ where: { id: body.bancoId } }))?.nome;

  const r = await pagarFatura({
    cartaoApelido,
    mes: body.mes,
    valorCents: body.valor != null ? toCents(body.valor) : undefined,
    bancoNome,
    data: body.data ? new Date(`${body.data}T12:00:00-03:00`) : undefined,
    dominio,
  });
  if (!r.ok) return NextResponse.json({ error: r.avisos?.join(" ") || "Falha ao pagar fatura." }, { status: 400 });
  return NextResponse.json(r, { status: 201 });
}
