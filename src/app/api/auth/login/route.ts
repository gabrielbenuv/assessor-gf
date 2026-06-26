import { NextResponse } from "next/server";
import {
  checkCredentials,
  makeSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password || !checkCredentials(email, password)) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, makeSessionToken(email), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
