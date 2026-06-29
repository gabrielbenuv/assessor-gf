import { getConfig } from "./config";

/**
 * Cliente mínimo da Evolution API.
 * Suporta enviar texto e baixar mídia (imagem/áudio) recebida no webhook.
 */

async function base() {
  const url = (await getConfig("evolution_api_url")).replace(/\/$/, "");
  const apiKey = await getConfig("evolution_api_key");
  const instance = await getConfig("evolution_instance");
  return { url, apiKey, instance };
}

export async function evolutionConfigurado(): Promise<boolean> {
  const { url, apiKey, instance } = await base();
  return Boolean(url && apiKey && instance);
}

/** Envia uma mensagem de texto para um número (E.164, só dígitos). */
export async function enviarTexto(numero: string, texto: string): Promise<void> {
  const { url, apiKey, instance } = await base();
  if (!url || !apiKey || !instance) {
    console.warn("[evolution] não configurado — mensagem não enviada:", texto);
    return;
  }
  const resp = await fetch(`${url}/message/sendText/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: numero, text: texto }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.error("[evolution] erro ao enviar texto:", resp.status, body);
  }
}

/** Envia um documento (base64) para um número. Usado pra mandar a planilha .xlsx. */
export async function enviarDocumento(
  numero: string,
  base64: string,
  fileName: string,
  caption = "",
  mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
): Promise<boolean> {
  const { url, apiKey, instance } = await base();
  if (!url || !apiKey || !instance) {
    console.warn("[evolution] não configurado — documento não enviado:", fileName);
    return false;
  }
  const resp = await fetch(`${url}/message/sendMedia/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({
      number: numero,
      mediatype: "document",
      mimetype,
      media: base64,
      fileName,
      caption,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.error("[evolution] erro ao enviar documento:", resp.status, body);
    return false;
  }
  return true;
}

/**
 * Baixa a mídia (base64) de uma mensagem recebida.
 * A Evolution expõe /chat/getBase64FromMediaMessage/{instance}.
 */
export async function baixarMidiaBase64(messageKey: unknown): Promise<Buffer | null> {
  const { url, apiKey, instance } = await base();
  if (!url || !apiKey || !instance) return null;
  try {
    const resp = await fetch(`${url}/chat/getBase64FromMediaMessage/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ message: messageKey }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { base64?: string };
    if (!data.base64) return null;
    return Buffer.from(data.base64, "base64");
  } catch (e) {
    console.error("[evolution] erro ao baixar mídia:", e);
    return null;
  }
}
