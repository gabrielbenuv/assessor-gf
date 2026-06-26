import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processarMensagem } from "@/lib/agent";
import { enviarTexto, baixarMidiaBase64 } from "@/lib/evolution";
import { transcreverAudio } from "@/lib/openai";

export const dynamic = "force-dynamic";

// Health check
export async function GET() {
  return NextResponse.json({ ok: true, service: "assessor-webhook" });
}

function digits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

/**
 * Forma canônica de um número BR para comparação tolerante:
 * remove DDI 55 e o 9º dígito do celular, deixando DDD + 8 dígitos.
 * Assim 5547984226825 e 554784226825 batem como o mesmo número.
 */
function canonicalBR(num: string): string {
  let d = digits(num);
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2); // tira DDI
  if (d.length === 11) d = d.slice(0, 2) + d.slice(3); // tira o 9 do celular
  return d;
}

async function numeroAutorizado(numero: string): Promise<boolean> {
  const lista = await prisma.numeroAutorizado.findMany({ where: { ativo: true } });
  const alvoExato = digits(numero);
  const alvoCanon = canonicalBR(numero);
  return lista.some(
    (n) => digits(n.numero) === alvoExato || canonicalBR(n.numero) === alvoCanon
  );
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    // Evolution pode mandar evento como objeto único ou em data[]
    const evt = body?.event || body?.type || "";
    if (evt && !String(evt).includes("messages")) {
      return NextResponse.json({ ok: true, ignored: evt });
    }

    const data = Array.isArray(body?.data) ? body.data[0] : body?.data;
    if (!data?.key) return NextResponse.json({ ok: true });

    // Ignora mensagens enviadas por nós mesmos
    if (data.key.fromMe) return NextResponse.json({ ok: true });

    const jid: string = data.key.remoteJid || "";
    const isGroup = jid.endsWith("@g.us");
    const senderJid = isGroup ? data.key.participant || "" : jid;
    const numero = digits(senderJid.replace(/@.*/, ""));
    const replyTo = isGroup ? jid : numero;

    // 🔒 Whitelist: só responde números autorizados
    if (!numero || !(await numeroAutorizado(numero))) {
      return NextResponse.json({ ok: true, ignored: "nao_autorizado" });
    }

    const message = data.message || {};
    const tipoMsg: string = data.messageType || Object.keys(message)[0] || "";

    let texto = "";
    let imagemBase64: string | undefined;
    let origem: "texto" | "foto" | "audio" = "texto";

    if (message.audioMessage || tipoMsg.includes("audio")) {
      const buf = await baixarMidiaBase64(data);
      if (buf) {
        texto = await transcreverAudio(buf, "audio.ogg");
        origem = "audio";
      } else {
        texto = "(não consegui baixar o áudio)";
      }
    } else if (message.imageMessage || tipoMsg.includes("image")) {
      const buf = await baixarMidiaBase64(data);
      if (buf) {
        imagemBase64 = buf.toString("base64");
        origem = "foto";
      }
      texto = message.imageMessage?.caption || "";
    } else {
      texto =
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.ephemeralMessage?.message?.conversation ||
        "";
      origem = "texto";
    }

    if (!texto && !imagemBase64) return NextResponse.json({ ok: true });

    const resposta = await processarMensagem({ texto, imagemBase64, origem, sessao: numero });
    await enviarTexto(replyTo, resposta);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[webhook] erro:", e);
    return NextResponse.json({ ok: true, error: e?.message });
  }
}
