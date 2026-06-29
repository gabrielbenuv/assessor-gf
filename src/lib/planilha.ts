import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { formatBR, contextoDataHora } from "./dates";
import {
  consultarGastos,
  consultarSaldo,
  faturaEmAberto,
  listarContasAPagar,
  listarParcelamentos,
  projecaoCaixa,
  saldoPrevisto,
} from "./finance";

const reais = (cents: number) => Math.round(cents) / 100;

function sheet(wb: XLSX.WorkBook, nome: string, linhas: (string | number | null)[][]) {
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  // largura automática simples
  const widths = (linhas[0] || []).map((_, col) => {
    const max = Math.max(...linhas.map((l) => String(l[col] ?? "").length), 8);
    return { wch: Math.min(max + 2, 48) };
  });
  (ws as any)["!cols"] = widths;
  XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31));
}

/** Gera a planilha financeira completa (multi-aba) e retorna o Buffer .xlsx. */
export async function gerarPlanilhaFinanceira(dominio = "pessoal"): Promise<Buffer> {
  const [saldos, entradas, gastos, sp, faturas, contas, parcelamentos, projecao, transacoes] = await Promise.all([
    consultarSaldo(undefined, dominio),
    consultarGastos({ periodo: "mes", tipo: "entrada", dominio }),
    consultarGastos({ periodo: "mes", tipo: "gasto", dominio }),
    saldoPrevisto(dominio),
    faturaEmAberto(undefined, dominio),
    listarContasAPagar(undefined, dominio),
    listarParcelamentos(dominio),
    projecaoCaixa(dominio, 6),
    prisma.transacao.findMany({
      where: { dominio },
      include: { categoria: true, banco: true, cartao: true },
      orderBy: { data: "desc" },
      take: 1000,
    }),
  ]);

  const wb = XLSX.utils.book_new();

  // ---- Resumo ----
  sheet(wb, "Resumo", [
    ["Assessor — Resumo financeiro"],
    ["Domínio", dominio],
    ["Gerado em", contextoDataHora()],
    [],
    ["Indicador", "Valor (R$)"],
    ["Saldo atual", reais(saldos.totalCents)],
    ["Entradas do mês", reais(entradas.totalCents)],
    ["Gastos do mês", reais(gastos.totalCents)],
    ["Contas a pagar (mês)", reais(contas.totalAPagar)],
    ["Faturas em aberto", reais(faturas.totalCents)],
    ["Saldo previsto (fim do mês)", reais(sp.previstoCents)],
  ]);

  // ---- Cartões & Parcelas ----
  const cabParc = [
    "Descrição",
    "Forma",
    "Cartão/Conta",
    "Categoria",
    "Parcela atual",
    "Total parcelas",
    "Valor parcela (R$)",
    "Pagas",
    "Restantes",
    "Próx. vencimento",
    "Status",
  ];
  const linhasParc = parcelamentos.map((p) => [
    p.descricao,
    p.forma,
    p.cartao || p.banco || "—",
    p.categoria || "—",
    p.proxima ? `${p.proxima.numero} de ${p.numParcelas}` : `${p.numParcelas} de ${p.numParcelas}`,
    p.numParcelas,
    reais(p.valorParcelaCents),
    p.pagas,
    p.restantes,
    p.proxima?.vencimento || "—",
    p.quitado ? "Quitado" : "Em andamento",
  ]);
  sheet(wb, "Cartões & Parcelas", [cabParc, ...linhasParc]);

  // ---- Faturas ----
  const linhasFat: (string | number)[][] = [["Cartão", "Mês", "Vencimento", "Total (R$)", "Status"]];
  for (const c of faturas.cartoes) {
    for (const f of c.faturas) {
      linhasFat.push([c.cartao, f.mes, f.vencimento || "—", reais(f.cents), "Em aberto"]);
    }
  }
  sheet(wb, "Faturas", linhasFat);

  // ---- Contas Fixas ----
  const linhasCf = [
    ["Nome", "Tipo", "Dia venc.", "Vencimento", "Previsto (R$)", "Pago (R$)", "Status"],
    ...contas.itens.map((i) => [
      i.nome,
      i.tipo,
      i.diaVencimento,
      i.vencimento,
      i.previstoCents != null ? reais(i.previstoCents) : "",
      reais(i.valorPagoCents),
      i.pago ? "Pago" : "A pagar",
    ]),
  ];
  sheet(wb, "Contas Fixas", linhasCf as any);

  // ---- Transações ----
  const linhasTx = [
    ["Data", "Descrição", "Tipo", "Categoria", "Forma", "Banco/Cartão", "Valor (R$)", "Origem"],
    ...transacoes.map((t) => [
      formatBR(t.data, "dd/MM/yyyy HH:mm"),
      t.descricao,
      t.tipo,
      t.categoria?.nome || "—",
      t.formaPagamento,
      t.cartao?.apelido || t.banco?.nome || "—",
      (t.tipo === "entrada" ? 1 : -1) * reais(t.valorCents),
      t.origemTipo,
    ]),
  ];
  sheet(wb, "Transações", linhasTx as any);

  // ---- Previsão ----
  const linhasPrev = [
    ["Mês", "Entradas (R$)", "Saídas (R$)", "Saldo projetado (R$)"],
    ...projecao.map((p) => [p.label, reais(p.entradasCents), reais(p.saidasCents), reais(p.saldoFimCents)]),
  ];
  sheet(wb, "Previsão", linhasPrev as any);

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
