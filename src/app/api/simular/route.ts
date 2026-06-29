import { NextResponse } from "next/server";
import { guard } from "@/lib/guard";
import { processarMensagem, PLANILHA_FLAG } from "@/lib/agent";
import { limparHistorico } from "@/lib/memory";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const g = guard();
  if (g) return g;
  await limparHistorico("simulador");
  return NextResponse.json({ ok: true });
}

/** Simulador: testa o assessor pelo painel, sem precisar do WhatsApp conectado. */
export async function POST(req: Request) {
  const g = guard();
  if (g) return g;

  const { texto, imagemBase64 } = await req.json().catch(() => ({}));
  if (!texto && !imagemBase64) {
    return NextResponse.json({ error: "Envie um texto ou imagem." }, { status: 400 });
  }

  try {
    let resposta = await processarMensagem({
      texto: texto || "",
      imagemBase64,
      origem: imagemBase64 ? "foto" : "texto",
      sessao: "simulador",
    });
    const planilha = resposta.includes(PLANILHA_FLAG);
    resposta = resposta.replace(PLANILHA_FLAG, "").trim();
    return NextResponse.json({ resposta, planilha });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro ao processar." }, { status: 500 });
  }
}
