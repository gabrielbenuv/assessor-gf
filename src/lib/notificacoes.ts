import { prisma } from "./prisma";
import { nowZoned, TZ } from "./dates";
import { listarContasAPagar, mesAtual, faturaEmAberto, consultarSaldo, gastosVsTeto } from "./finance";
import { formatBRL } from "./money";
import { enviarTexto } from "./evolution";
import { toZonedTime } from "date-fns-tz";

function clampDia(d: number): number {
  return Math.max(1, Math.min(28, d));
}

/** Lê (ou cria) a linha única de preferências de notificação. */
export async function getPrefs() {
  return prisma.notificacao.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function nomeMes(ref: string): string {
  const [ano, m] = ref.split("-").map(Number);
  return `${MESES[m - 1]}/${ano}`;
}

/** Monta o texto do relatório mensal de contas a pagar. */
export async function montarRelatorioMensal(mes?: string): Promise<string> {
  const ref = mes || mesAtual();
  const r = await listarContasAPagar(ref);
  if (r.itens.length === 0) {
    return `📅 *Contas a pagar — ${nomeMes(ref)}*\n\nVocê ainda não cadastrou contas fixas. Cadastre no painel em "Contas fixas".`;
  }
  const linhas = r.itens.map((i) => {
    const valor = i.pago
      ? `${i.valorPagoFormatado} ✅ pago`
      : i.previstoFormatado
        ? `${i.previstoFormatado} ⏳`
        : "⏳ (sem valor previsto)";
    return `• ${i.nome} — vence ${i.vencimento} — ${valor}`;
  });
  return [
    `📅 *Contas a pagar — ${nomeMes(ref)}*`,
    "",
    ...linhas,
    "",
    `Falta pagar: *${r.totalAPagarFormatado}* em ${r.quantasAPagar} conta(s).`,
  ].join("\n");
}

/** Envia um texto para todos os números autorizados ativos. */
export async function enviarParaAutorizados(texto: string): Promise<number> {
  const numeros = await prisma.numeroAutorizado.findMany({ where: { ativo: true } });
  for (const n of numeros) {
    await enviarTexto(n.numero, texto);
  }
  return numeros.length;
}

// ===== marcadores (evitam envio duplicado) — texto puro no Config =====
async function getMarker(chave: string): Promise<string> {
  const row = await prisma.config.findUnique({ where: { chave } });
  return row?.valor || "";
}
async function setMarker(chave: string, valor: string) {
  await prisma.config.upsert({
    where: { chave },
    update: { valor },
    create: { chave, valor },
  });
}

/** Saldo atual da conta vinculada (ou null). Para o aviso de "saldo previsto". */
async function saldoDaConta(bancoId: string | null): Promise<{ nome: string; saldoCents: number } | null> {
  if (!bancoId) return null;
  const banco = await prisma.banco.findUnique({ where: { id: bancoId } });
  if (!banco) return null;
  const r = await consultarSaldo(banco.nome);
  return { nome: banco.nome, saldoCents: r.bancos[0]?.saldoCents ?? banco.saldoInicialCents };
}

/** Acrescenta o aviso de saldo insuficiente, se aplicável. */
function avisoSaldo(valorCents: number, saldo: { nome: string; saldoCents: number } | null): string {
  if (!saldo) return "";
  if (saldo.saldoCents >= valorCents) return "";
  const falta = valorCents - saldo.saldoCents;
  return `\n⚠️ A conta ${saldo.nome} tem ${formatBRL(saldo.saldoCents)} — faltam ${formatBRL(falta)}.`;
}

/**
 * Roda as notificações devidas para o momento atual.
 * Chamada de hora em hora (cron externo) ou com force=true para teste.
 */
export async function rodarNotificacoes(opts: { force?: boolean } = {}): Promise<string[]> {
  const enviados: string[] = [];
  const prefs = await getPrefs();
  const z = nowZoned();
  const horaAlvo = parseInt(prefs.horaEnvio.split(":")[0] || "9", 10);
  const naHora = z.getHours() === horaAlvo;
  const dia = z.getDate();
  const hoje = `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const mes = mesAtual();

  // 1) Relatório mensal de contas a pagar
  if (opts.force || (prefs.relatorioMensalAtivo && dia === prefs.diaRelatorio && naHora)) {
    if (opts.force || (await getMarker("notif_relatorio_ultimo")) !== mes) {
      await enviarParaAutorizados(await montarRelatorioMensal(mes));
      await setMarker("notif_relatorio_ultimo", mes);
      enviados.push("relatorio_mensal");
    }
  }

  // 2) Lembrete de contas fixas (padrão global ou dias editáveis por conta)
  if (!opts.force && prefs.lembreteVencimentoAtivo && naHora) {
    const contas = await prisma.contaFixa.findMany({ where: { ativo: true } });
    const status = await listarContasAPagar(mes);
    for (const c of contas) {
      const item = status.itens.find((i) => i.id === c.id);
      if (item?.pago) continue;
      const diasAntes = c.usaPadrao ? prefs.contasFixasDiasAntes : c.lembreteDiasAntes ?? prefs.contasFixasDiasAntes;
      if (dia !== clampDia(c.diaVencimento - diasAntes)) continue;
      const marker = `notif_cfixa_${c.id}`;
      if ((await getMarker(marker)) === mes) continue;
      const valor = c.valorPrevistoCents ? ` — ${formatBRL(c.valorPrevistoCents)}` : "";
      const saldo = await saldoDaConta(c.bancoId);
      const aviso = c.valorPrevistoCents ? avisoSaldo(c.valorPrevistoCents, saldo) : "";
      await enviarParaAutorizados(
        `🔔 *${c.nome}* vence ${item?.vencimento || `dia ${c.diaVencimento}`}${valor}.${aviso}\nJá pagou? Me manda o valor que eu registro.`
      );
      await setMarker(marker, mes);
      enviados.push(`conta_fixa:${c.nome}`);
    }
  }

  // 3) Lembrete de fatura de cartão (X dias antes do vencimento + opcional no fechamento)
  if (!opts.force && prefs.lembreteCartaoAtivo && naHora) {
    const cartoes = await prisma.cartao.findMany({ where: { ativo: true, lembreteFaturaAtivo: true } });
    for (const cartao of cartoes) {
      const fat = await faturaEmAberto(cartao.apelido);
      const info = fat.cartoes[0];
      const totalCents = info?.totalCents || 0;

      // aviso X dias antes do vencimento
      if (totalCents > 0 && dia === clampDia(cartao.diaVencimento - cartao.lembreteDiasAntes)) {
        const marker = `notif_cartao_venc_${cartao.id}`;
        if ((await getMarker(marker)) !== mes) {
          const saldo = await saldoDaConta(cartao.bancoId);
          await enviarParaAutorizados(
            `💳 Fatura *${cartao.apelido}* vence dia ${cartao.diaVencimento}: ${formatBRL(totalCents)}.${avisoSaldo(totalCents, saldo)}`
          );
          await setMarker(marker, mes);
          enviados.push(`cartao_venc:${cartao.apelido}`);
        }
      }

      // aviso no dia do fechamento
      if (cartao.lembreteFechamentoAtivo && dia === clampDia(cartao.diaFechamento)) {
        const marker = `notif_cartao_fech_${cartao.id}`;
        if ((await getMarker(marker)) !== mes) {
          await enviarParaAutorizados(
            `💳 A fatura do *${cartao.apelido}* fechou: ${formatBRL(totalCents)} (vence dia ${cartao.diaVencimento}).`
          );
          await setMarker(marker, mes);
          enviados.push(`cartao_fech:${cartao.apelido}`);
        }
      }
    }
  }

  // 4b) Lembrete de parcela avulsa vencendo (X dias antes)
  if (!opts.force && prefs.lembreteVencimentoAtivo && naHora) {
    const parcelas = await prisma.parcela.findMany({
      where: { mesCompetencia: mes, parcelamento: { forma: "avulso", ativo: true } },
      include: { parcelamento: true, transacoes: { where: { origemTipo: "baixa_parcela" } } },
    });
    for (const p of parcelas) {
      if (p.transacoes.length > 0) continue; // já paga
      const diaVenc = toZonedTime(p.vencimento, TZ).getDate();
      if (dia !== clampDia(diaVenc - prefs.contasFixasDiasAntes)) continue;
      const marker = `notif_parcela_${p.id}`;
      if ((await getMarker(marker)) === mes) continue;
      await enviarParaAutorizados(
        `📦 Parcela ${p.numero}/${p.total} de *${p.parcelamento.descricao}* vence dia ${diaVenc} — ${formatBRL(p.valorPrevistoCents)}.\nJá pagou? Me diz de qual conta saiu que eu registro.`
      );
      await setMarker(marker, mes);
      enviados.push(`parcela:${p.parcelamento.descricao}`);
    }
  }

  // 4c) Alerta de estouro de teto (uma vez por mês, por categoria)
  if (!opts.force && prefs.lembreteVencimentoAtivo && naHora) {
    const gv = await gastosVsTeto("mes");
    for (const c of gv.itens.filter((i) => i.estourou)) {
      const marker = `notif_teto_${c.nome.replace(/\W+/g, "_")}`;
      if ((await getMarker(marker)) === mes) continue;
      await enviarParaAutorizados(
        `⚠️ Teto estourado em *${c.nome}*: ${c.gastoFormatado} de ${c.tetoFormatado} (${c.pct}%).`
      );
      await setMarker(marker, mes);
      enviados.push(`teto:${c.nome}`);
    }
  }

  // 4) Resumo semanal (segunda-feira)
  if (!opts.force && prefs.resumoSemanalAtivo && naHora && z.getDay() === 1) {
    const semana = `${z.getFullYear()}-W${Math.ceil(dia / 7)}-${z.getMonth()}`;
    if ((await getMarker("notif_resumo_semana")) !== semana) {
      const r = await listarContasAPagar(mes);
      const pend = r.itens.filter((i) => !i.pago);
      const texto =
        pend.length === 0
          ? "📆 *Resumo da semana*: nenhuma conta fixa pendente. 👏"
          : `📆 *Resumo da semana*\n${pend.map((i) => `• ${i.nome} — vence ${i.vencimento} — ${i.previstoFormatado || "?"}`).join("\n")}\n\nTotal a pagar: *${r.totalAPagarFormatado}*.`;
      await enviarParaAutorizados(texto);
      await setMarker("notif_resumo_semana", semana);
      enviados.push("resumo_semanal");
    }
  }

  return enviados;
}
