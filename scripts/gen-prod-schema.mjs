// Gera prisma/schema.prod.prisma a partir do schema.prisma (fonte única),
// trocando apenas o provider sqlite -> postgresql.
// Assim o desenvolvimento local segue em SQLite e a produção (Docker/EasyPanel) usa Postgres,
// sem manter dois schemas à mão.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");

// Troca o provider SOMENTE dentro do bloco datasource (não mexe em comentários).
const re = /(datasource\s+\w+\s*\{[^}]*?provider\s*=\s*)"sqlite"/;
if (!re.test(src)) {
  console.error("ERRO: não encontrei o provider sqlite no bloco datasource.");
  process.exit(1);
}
const prod = src.replace(re, '$1"postgresql"');

writeFileSync(join(root, "prisma", "schema.prod.prisma"), prod);
console.log("✓ prisma/schema.prod.prisma gerado (provider=postgresql).");
