import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";
import { toCents } from "@/lib/money";
import { criarParcelamento, listarParcelamentos, normDominio } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = guard();
  if (g) return g;
  const { searchParams } = new URL(req.url);
  const dominio = normDominio(searchParams.get("dominio"));
  return NextResponse.json(await listarParcelamentos(dominio));
}

export async function POST(req: Request) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  if (!body.descricao || !body.valorParcela || !body.numParcelas) {
    return NextResponse.json({ error: "Descrição, valor da parcela e nº de parcelas são obrigatórios." }, { status: 400 });
  }
  const dominio = normDominio(body.dominio);

  // a UI manda IDs; o motor trabalha com nomes — resolvemos aqui.
  let cartaoApelido: string | undefined;
  let bancoNome: string | undefined;
  let categoriaNome: string | undefined;
  if (body.cartaoId) cartaoApelido = (await prisma.cartao.findUnique({ where: { id: body.cartaoId } }))?.apelido;
  if (body.bancoId) bancoNome = (await prisma.banco.findUnique({ where: { id: body.bancoId } }))?.nome;
  if (body.categoriaId) categoriaNome = (await prisma.categoria.findUnique({ where: { id: body.categoriaId } }))?.nome;

  const dataPrimeira = body.dataPrimeira ? new Date(`${body.dataPrimeira}T12:00:00-03:00`) : new Date();

  const r = await criarParcelamento({
    descricao: body.descricao,
    valorParcelaCents: toCents(body.valorParcela),
    numParcelas: Number(body.numParcelas),
    forma: body.forma === "cartao" ? "cartao" : "avulso",
    cartaoApelido,
    bancoNome,
    categoriaNome,
    dataPrimeira,
    dominio,
  });
  return NextResponse.json(r, { status: 201 });
}
