import { NextResponse } from "next/server";
import { handleOAuthCallback } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/integracoes?google=erro", appUrl));
  }
  try {
    await handleOAuthCallback(code);
    return NextResponse.redirect(new URL("/integracoes?google=ok", appUrl));
  } catch (e) {
    console.error("[google callback]", e);
    return NextResponse.redirect(new URL("/integracoes?google=erro", appUrl));
  }
}
