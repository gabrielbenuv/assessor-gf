import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categoriasGasto = [
  { nome: "Alimentação", emoji: "🍽️" },
  { nome: "Mercado", emoji: "🛒" },
  { nome: "Transporte", emoji: "🚗" },
  { nome: "Moradia/Contas", emoji: "🏠" },
  { nome: "Saúde", emoji: "💊" },
  { nome: "Lazer", emoji: "🎉" },
  { nome: "Assinaturas", emoji: "📺" },
  { nome: "Educação", emoji: "📚" },
  { nome: "Compras", emoji: "🛍️" },
  { nome: "Outros", emoji: "📦" },
];

const categoriasEntrada = [
  { nome: "Salário", emoji: "💰" },
  { nome: "Reembolso", emoji: "↩️" },
  { nome: "Transferência", emoji: "🔁" },
  { nome: "Outros", emoji: "📥" },
];

async function main() {
  for (const c of categoriasGasto) {
    await prisma.categoria.upsert({
      where: { nome_tipo: { nome: c.nome, tipo: "gasto" } },
      update: {},
      create: { nome: c.nome, tipo: "gasto", emoji: c.emoji },
    });
  }
  for (const c of categoriasEntrada) {
    await prisma.categoria.upsert({
      where: { nome_tipo: { nome: c.nome, tipo: "entrada" } },
      update: {},
      create: { nome: c.nome, tipo: "entrada", emoji: c.emoji },
    });
  }
  console.log("✓ Categorias padrão criadas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
