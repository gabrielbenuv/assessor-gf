import { NextResponse } from "next/server";
import { guard } from "@/lib/guard";
import { getConfigStatus, setConfig, ConfigKey } from "@/lib/config";
import { evolutionConfigurado } from "@/lib/evolution";
import { googleConfigurado, googleConectado } from "@/lib/google";

export const dynamic = "force-dynamic";

const ALLOWED: ConfigKey[] = [
  "openai_api_key",
  "openai_model",
  "evolution_api_url",
  "evolution_api_key",
  "evolution_instance",
  "google_client_id",
  "google_client_secret",
  "google_calendar_id",
];

export async function GET() {
  const g = guard();
  if (g) return g;
  return NextResponse.json({
    status: await getConfigStatus(),
    evolution: await evolutionConfigurado(),
    googleConfigurado: await googleConfigurado(),
    googleConectado: await googleConectado(),
  });
}

export async function POST(req: Request) {
  const g = guard();
  if (g) return g;
  const updates = await req.json().catch(() => ({}));
  for (const [key, value] of Object.entries(updates)) {
    if (ALLOWED.includes(key as ConfigKey) && typeof value === "string") {
      // valor mascarado (••••) não sobrescreve
      if (value.includes("••")) continue;
      await setConfig(key as ConfigKey, value);
    }
  }
  return NextResponse.json({ ok: true });
}
