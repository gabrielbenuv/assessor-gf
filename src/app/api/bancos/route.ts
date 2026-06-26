import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";
import { consultarSaldo } from "@/lib/finance";
import { toCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = guard();
  if (g) return g;
  const bancos = await prisma.banco.findMany({ orderBy: { nome: "asc" } });
  const { bancos: saldos } = await consultarSaldo();
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
  try {
    if (body.contaSalario) {
      await prisma.banco.updateMany({ data: { contaSalario: false } });
    }
    const banco = await prisma.banco.create({
      data: {
        nome: body.nome,
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
