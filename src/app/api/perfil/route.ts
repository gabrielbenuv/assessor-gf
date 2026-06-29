import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";
import { toCents } from "@/lib/money";
import { getPerfil, normDominio } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = guard();
  if (g) return g;
  const { searchParams } = new URL(req.url);
  const dominio = normDominio(searchParams.get("dominio"));
  return NextResponse.json(await getPerfil(dominio));
}

export async function PATCH(req: Request) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  const dominio = normDominio(body.dominio);

  const data: any = {};
  if (body.rendaBase !== undefined) data.rendaBaseCents = toCents(body.rendaBase);
  if (body.reservaMeta !== undefined) data.reservaMetaCents = toCents(body.reservaMeta);
  if (body.reservaAtual !== undefined) data.reservaAtualCents = toCents(body.reservaAtual);
  if (body.perfilRisco !== undefined) data.perfilRisco = body.perfilRisco;
  if (body.percentualInvestir !== undefined) data.percentualInvestir = Number(body.percentualInvestir);

  const perfil = await prisma.perfilFinanceiro.upsert({
    where: { dominio },
    update: data,
    create: { dominio, ...data },
  });
  return NextResponse.json(perfil);
}
