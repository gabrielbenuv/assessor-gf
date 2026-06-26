import { NextResponse } from "next/server";
import { rodarNotificacoes } from "@/lib/notificacoes";

export const dynamic = "force-dynamic";

/**
 * Endpoint para um agendador EXTERNO (cron do EasyPanel/sistema) chamar de hora em hora.
 * Protegido por ?key= igual ao APP_SECRET. O app também roda um cron interno por padrão.
 */
async function handle(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key || key !== process.env.APP_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const enviados = await rodarNotificacoes();
    return NextResponse.json({ ok: true, enviados });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
