import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthUrl, googleConfigurado } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!getSession()) {
    return NextResponse.redirect(new URL("/login", process.env.APP_URL || "http://localhost:3000"));
  }
  if (!(await googleConfigurado())) {
    return NextResponse.redirect(
      new URL("/integracoes?google=falta_credencial", process.env.APP_URL || "http://localhost:3000")
    );
  }
  const url = await getAuthUrl();
  return NextResponse.redirect(url);
}
