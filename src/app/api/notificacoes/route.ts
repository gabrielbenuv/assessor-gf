import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";
import { getPrefs } from "@/lib/notificacoes";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = guard();
  if (g) return g;
  return NextResponse.json(await getPrefs());
}

export async function POST(req: Request) {
  const g = guard();
  if (g) return g;
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.relatorioMensalAtivo !== undefined) data.relatorioMensalAtivo = body.relatorioMensalAtivo;
  if (body.diaRelatorio !== undefined) data.diaRelatorio = Number(body.diaRelatorio);
  if (body.horaEnvio !== undefined) data.horaEnvio = body.horaEnvio;
  if (body.lembreteVencimentoAtivo !== undefined) data.lembreteVencimentoAtivo = body.lembreteVencimentoAtivo;
  if (body.diasAntes !== undefined) data.diasAntes = Number(body.diasAntes);
  if (body.contasFixasDiasAntes !== undefined) data.contasFixasDiasAntes = Number(body.contasFixasDiasAntes);
  if (body.lembreteCartaoAtivo !== undefined) data.lembreteCartaoAtivo = body.lembreteCartaoAtivo;
  if (body.resumoSemanalAtivo !== undefined) data.resumoSemanalAtivo = body.resumoSemanalAtivo;

  const prefs = await prisma.notificacao.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
  return NextResponse.json(prefs);
}
