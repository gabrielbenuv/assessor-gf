import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";
import { consultarSaldo, normDominio } from "@/lib/finance";
import { toCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = guard();
  if (g) return g;
  const { searchParams } = new URL(req.url);
  const dominioParam = searchParams.get("dominio");
  const bancos = await prisma.banco.findMany({
    where: dominioParam ? { dominio: dominioParam } : undefined,
    orderBy: { nome: "asc" },
  });
  const { bancos: saldos } = await consultarSaldo(undefined, dominioParam || "pessoal");
  const saldoPorNome = Object.fromEntries(saldos.map((s) => [s.nome, s.saldoCents]));
  return NextResponse.json(
    bancos.map((b) => ({ ...b, saldoAtualCents: saldoPorNome[b.nome] ?? b.saldoInicialCents }))
  );
}

export async function POST(req: Request) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  if (!body.nome) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  const dominio = normDominio(body.dominio);
  try {
    if (body.contaSalario) {
      await prisma.banco.updateMany({ where: { dominio }, data: { contaSalario: false } });
    }
    const banco = await prisma.banco.create({
      data: {
        nome: body.nome,
        dominio,
        tipo: body.tipo || "conta_corrente",
        saldoInicialCents: toCents(body.saldoInicial ?? 0),
        contaSalario: body.contaSalario ?? false,
        contaReceber: body.contaReceber ?? false,
        ativo: body.ativo ?? true,
      },
    });
    return NextResponse.json(banco, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: "Já existe um banco com esse nome." }, { status: 409 });
  }
}
