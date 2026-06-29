import { NextResponse } from "next/server";
import { guard } from "@/lib/guard";
import { gastosVsTeto, normDominio } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = guard();
  if (g) return g;
  const { searchParams } = new URL(req.url);
  const dominio = normDominio(searchParams.get("dominio"));
  return NextResponse.json(await gastosVsTeto("mes", dominio));
}
