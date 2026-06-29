import { guard } from "@/lib/guard";
import { gerarPlanilhaFinanceira } from "@/lib/planilha";
import { normDominio } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = guard();
  if (g) return g;
  const { searchParams } = new URL(req.url);
  const dominio = normDominio(searchParams.get("dominio"));
  const buf = await gerarPlanilhaFinanceira(dominio);
  const ref = new Date().toISOString().slice(0, 7);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="assessor-${dominio}-${ref}.xlsx"`,
    },
  });
}
