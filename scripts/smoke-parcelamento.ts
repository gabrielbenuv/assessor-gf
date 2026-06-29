import { prisma } from "../src/lib/prisma";
import { criarParcelamento, darBaixaParcela, listarParcelamentos } from "../src/lib/finance";

const DESC = "Colchão (smoke)";
const DOM = "pessoal";

async function main() {
  await prisma.banco.upsert({
    where: { nome_dominio: { nome: "TesteCarteira", dominio: DOM } },
    update: {},
    create: { nome: "TesteCarteira", dominio: DOM, tipo: "carteira" },
  });

  const r = await criarParcelamento({
    descricao: DESC,
    valorParcelaCents: 50000,
    numParcelas: 30,
    forma: "avulso",
    bancoNome: "TesteCarteira",
    categoriaNome: "Casa/Móveis",
    dominio: DOM,
  });
  console.log("criar →", r.numParcelas, "parcelas, total", r.totalFormatado, "avisos:", r.avisos);

  const get = async () => (await listarParcelamentos(DOM)).find((p) => p.descricao === DESC);

  let l = await get();
  console.log("antes da baixa →", `${l?.pagas}/${l?.numParcelas}`, "próxima:", l?.proxima?.numero, "progresso:", l?.progresso + "%");

  const b: any = await darBaixaParcela({ descricao: "Colchão", bancoNome: "TesteCarteira", formaPagamento: "pix", dominio: DOM });
  console.log("baixa →", b.ok, `parcela ${b.numero}/${b.total}`, b.valorFormatado, "restantes:", b.restantes);

  l = await get();
  console.log("depois da baixa →", `${l?.pagas}/${l?.numParcelas}`, "próxima:", l?.proxima?.numero, "progresso:", l?.progresso + "%");

  const pass =
    r.numParcelas === 30 &&
    b.ok === true &&
    b.numero === 1 &&
    b.restantes === 29 &&
    l?.pagas === 1 &&
    l?.proxima?.numero === 2;
  console.log(pass ? "✅ PASS — critérios #1 e #2 OK" : "❌ FAIL");

  // cleanup
  await prisma.transacao.deleteMany({ where: { parcela: { parcelamento: { descricao: DESC } } } });
  await prisma.parcelamento.deleteMany({ where: { descricao: DESC } });
  await prisma.banco.deleteMany({ where: { nome: "TesteCarteira", dominio: DOM } });
  await prisma.$disconnect();
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
