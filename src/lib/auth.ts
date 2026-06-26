import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signSession, verifySession } from "./crypto";

export const SESSION_COOKIE = "assessor_session";
const MAX_AGE_DAYS = 30;

export interface Session {
  email: string;
  exp: number;
}

/** Confere e-mail/senha contra as variáveis de ambiente. */
export function checkCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@assessor.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  return email.trim().toLowerCase() === adminEmail.toLowerCase() && password === adminPassword;
}

/** Gera o valor do cookie de sessão. */
export function makeSessionToken(email: string): string {
  const exp = Date.now() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return signSession({ email, exp });
}

export const SESSION_MAX_AGE = MAX_AGE_DAYS * 24 * 60 * 60;

/** Lê a sessão atual (server component / route handler). */
export function getSession(): Session | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession<Session>(token);
}

/** Exige autenticação em server components — redireciona pro login se não houver. */
export function requireAuth(): Session {
  const session = getSession();
  if (!session) redirect("/login");
  return session;
}
