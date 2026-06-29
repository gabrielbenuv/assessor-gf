import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Taxonomia de categorias por domínio.
const TAXONOMIA: Record<string, { gasto: string[]; entrada: string[] }> = {
  pessoal: {
    gasto: [
      "Moradia/Contas",
      "Alimentação",
      "Mercado",
      "Transporte",
      "Saúde",
      "Lazer",
      "Casa/Móveis",
      "Educação",
      "Assinaturas",
      "Compras",
      "Outros",
    ],
    entrada: ["Salário", "Reembolso", "Transferência", "Investimentos", "Outros"],
  },
  chess: {
    gasto: ["Ferramentas", "Software", "Marketing", "Impostos", "Pessoal/Freelas", "Serviços", "Outros"],
    entrada: ["Vendas", "Serviços", "Reembolso", "Outros"],
  },
  klivy: {
    gasto: ["Ferramentas", "Software", "Marketing", "Impostos", "Pessoal/Freelas", "Serviços", "Outros"],
    entrada: ["Vendas", "Serviços", "Reembolso", "Outros"],
  },
};

async function main() {
  for (const [dominio, { gasto, entrada }] of Object.entries(TAXONOMIA)) {
    for (const nome of gasto) {
      await prisma.categoria.upsert({
        where: { nome_tipo_dominio: { nome, tipo: "gasto", dominio } },
        update: {},
        create: { nome, tipo: "gasto", dominio },
      });
    }
    for (const nome of entrada) {
      await prisma.categoria.upsert({
        where: { nome_tipo_dominio: { nome, tipo: "entrada", dominio } },
        update: {},
        create: { nome, tipo: "entrada", dominio },
      });
    }
    // garante o perfil financeiro do domínio
    await prisma.perfilFinanceiro.upsert({
      where: { dominio },
      update: {},
      create: { dominio },
    });
  }

  // preferências de notificação (linha única)
  await prisma.notificacao.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });

  console.log("✓ Categorias por domínio, perfis e preferências criados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
