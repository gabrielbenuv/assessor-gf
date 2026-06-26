import OpenAI from "openai";
import { getConfig } from "./config";

export async function getOpenAI(): Promise<OpenAI> {
  const apiKey = await getConfig("openai_api_key");
  if (!apiKey) {
    throw new Error(
      "OpenAI API key não configurada. Vá em /integracoes e cole sua chave."
    );
  }
  return new OpenAI({ apiKey });
}

export async function getModel(): Promise<string> {
  return (await getConfig("openai_model")) || "gpt-4o";
}

/** Transcreve um áudio (buffer) usando Whisper. */
export async function transcreverAudio(
  buffer: Buffer,
  filename = "audio.ogg"
): Promise<string> {
  const client = await getOpenAI();
  const file = await OpenAI.toFile(buffer, filename);
  const resp = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "pt",
  });
  return resp.text;
}
