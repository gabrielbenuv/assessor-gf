import { prisma } from "./prisma";
import { encrypt, decrypt } from "./crypto";

export type ConfigKey =
  | "openai_api_key"
  | "openai_model"
  | "evolution_api_url"
  | "evolution_api_key"
  | "evolution_instance"
  | "google_client_id"
  | "google_client_secret"
  | "google_refresh_token"
  | "google_calendar_id";

const ENV_FALLBACK: Partial<Record<ConfigKey, string | undefined>> = {
  openai_api_key: process.env.OPENAI_API_KEY,
  evolution_api_url: process.env.EVOLUTION_API_URL,
  evolution_api_key: process.env.EVOLUTION_API_KEY,
  evolution_instance: process.env.EVOLUTION_INSTANCE,
  google_client_id: process.env.GOOGLE_CLIENT_ID,
  google_client_secret: process.env.GOOGLE_CLIENT_SECRET,
};

/** Lê uma config (banco criptografado tem prioridade; senão cai no env). */
export async function getConfig(key: ConfigKey): Promise<string> {
  const row = await prisma.config.findUnique({ where: { chave: key } });
  if (row?.valor) {
    const v = decrypt(row.valor);
    if (v) return v;
  }
  return ENV_FALLBACK[key] || "";
}

/** Salva (ou apaga, se valor vazio) uma config de forma criptografada. */
export async function setConfig(key: ConfigKey, value: string): Promise<void> {
  if (!value) {
    await prisma.config.deleteMany({ where: { chave: key } });
    return;
  }
  await prisma.config.upsert({
    where: { chave: key },
    update: { valor: encrypt(value) },
    create: { chave: key, valor: encrypt(value) },
  });
}

/** Retorna o status (preenchido ou não) de cada chave, sem expor o valor. */
export async function getConfigStatus() {
  const keys: ConfigKey[] = [
    "openai_api_key",
    "openai_model",
    "evolution_api_url",
    "evolution_api_key",
    "evolution_instance",
    "google_client_id",
    "google_client_secret",
    "google_refresh_token",
    "google_calendar_id",
  ];
  const result: Record<string, { preenchido: boolean; preview: string }> = {};
  for (const k of keys) {
    const v = await getConfig(k);
    result[k] = {
      preenchido: Boolean(v),
      preview: v ? mask(v) : "",
    };
  }
  return result;
}

function mask(v: string): string {
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}
