import { NextResponse } from "next/server";
import { guard } from "@/lib/guard";
import { montarRelatorioMensal, enviarParaAutorizados } from "@/lib/notificacoes";
import { evolutionConfigurado } from "@/lib/evolution";

export const dynamic = "force-dynamic";

/** Gera o relatório mensal agora. ?enviar=1 também dispara no WhatsApp. */
export async function POST(req: Request) {
  const g = guard();
  if (g) return g;
  const { searchParams } = new URL(req.url);
  const enviar = searchParams.get("enviar") === "1";

  const texto = await montarRelatorioMensal();
  let enviadoPara = 0;
  let evolution = false;
  if (enviar) {
    evolution = await evolutionConfigurado();
    enviadoPara = await enviarParaAutorizados(texto);
  }
  return NextResponse.json({ texto, enviar, enviadoPara, evolution });
}
