import { google } from "googleapis";
import { getConfig, setConfig } from "./config";
import { TZ } from "./dates";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function redirectUri(): string {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${appUrl}/api/google/callback`;
}

async function oauthClient() {
  const clientId = await getConfig("google_client_id");
  const clientSecret = await getConfig("google_client_secret");
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri());
}

export async function googleConfigurado(): Promise<boolean> {
  const clientId = await getConfig("google_client_id");
  const clientSecret = await getConfig("google_client_secret");
  return Boolean(clientId && clientSecret);
}

export async function googleConectado(): Promise<boolean> {
  return Boolean(await getConfig("google_refresh_token"));
}

/** URL para o usuário autorizar o acesso ao Google Calendar. */
export async function getAuthUrl(): Promise<string> {
  const client = await oauthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

/** Troca o code do callback por tokens e guarda o refresh_token. */
export async function handleOAuthCallback(code: string): Promise<void> {
  const client = await oauthClient();
  const { tokens } = await client.getToken(code);
  if (tokens.refresh_token) {
    await setConfig("google_refresh_token", tokens.refresh_token);
  }
}

async function calendarClient() {
  const client = await oauthClient();
  const refreshToken = await getConfig("google_refresh_token");
  if (!refreshToken) throw new Error("Google Calendar não conectado.");
  client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: client });
}

export interface NovoEvento {
  titulo: string;
  inicio: Date;
  fim?: Date;
  participantes?: string[];
  descricao?: string;
}

export async function criarEventoCalendar(
  ev: NovoEvento
): Promise<{ id?: string | null; link?: string | null }> {
  const calendar = await calendarClient();
  const calendarId = (await getConfig("google_calendar_id")) || "primary";
  const fim = ev.fim || new Date(ev.inicio.getTime() + 60 * 60 * 1000);

  const resp = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: ev.titulo,
      description: ev.descricao,
      start: { dateTime: ev.inicio.toISOString(), timeZone: TZ },
      end: { dateTime: fim.toISOString(), timeZone: TZ },
      attendees: ev.participantes?.map((email) => ({ email })),
    },
  });

  return { id: resp.data.id, link: resp.data.htmlLink };
}
