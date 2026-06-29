import * as XLSX from "xlsx";
import { gerarPlanilhaFinanceira } from "../src/lib/planilha";
import { prisma } from "../src/lib/prisma";

async function main() {
  const buf = await gerarPlanilhaFinanceira("pessoal");
  const wb = XLSX.read(buf, { type: "buffer" });
  console.log("bytes:", buf.length);
  console.log("abas:", wb.SheetNames.join(" | "));
  const ok = buf.length > 1000 && wb.SheetNames.length === 6;
  console.log(ok ? "✅ PASS — planilha válida com 6 abas" : "❌ FAIL");
  await prisma.$disconnect();
  if (!ok) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
