import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guard } from "@/lib/guard";

export const dynamic = "force-dynamic";

// Remove um parcelamento (e suas parcelas; as baixas viram avulsas via SetNull).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = guard();
  if (g) return g;
  await prisma.parcelamento.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
