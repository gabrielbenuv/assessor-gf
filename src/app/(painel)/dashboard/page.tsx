import { cookies } from "next/headers";
import { resumoDashboard, saldoPrevisto } from "@/lib/finance";
import { formatBRL } from "@/lib/money";
import { formatBR } from "@/lib/dates";
import { normDominio, DOMINIO_LABELS } from "@/lib/dominios";
import { Icon, type IconName } from "@/components/Icon";
import { BarsMovimento, AreaPrevisao } from "@/components/Charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dominio = normDominio(cookies().get("dominio")?.value);
  const { gastosMes, entradasMes, saldos, faturas, ultimas, contasAPagar, parcelamentos, assinaturas, projecao, movimento } =
    await resumoDashboard(dominio);
  const sp = await saldoPrevisto(dominio);

  const kpis: { label: string; valor: string; icon: IconName; tone?: string }[] = [
    { label: "Saldo atual", valor: saldos.totalFormatado, icon: "wallet" },
    { label: "Entradas do mês", valor: entradasMes.totalFormatado, icon: "arrowUp", tone: "val-pos" },
    { label: "Gastos do mês", valor: gastosMes.totalFormatado, icon: "arrowDown", tone: "val-neg" },
    { label: "A pagar (mês)", valor: contasAPagar.totalAPagarFormatado, icon: "recorrente", tone: "val-neg" },
    { label: "Faturas em aberto", valor: faturas.totalFormatado, icon: "cartao", tone: "val-neg" },
    { label: "Previsto (fim do mês)", valor: sp.previstoFormatado, icon: "sparkles", tone: sp.previstoCents < 0 ? "val-neg" : "" },
  ];

  const parcAtivos = parcelamentos.filter((p) => !p.quitado).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Assessor · {DOMINIO_LABELS[dominio]}</p>
          <h1>Dashboard</h1>
        </div>
        <a href={`/api/planilha?dominio=${dominio}`} className="btn-ghost btn-sm">
          <Icon name="download" className="h-4 w-4" /> Exportar
        </a>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((c) => (
          <div key={c.label} className="card">
            <div className="flex items-center justify-between">
              <p className="kpi-label">{c.label}</p>
              <Icon name={c.icon} className="h-4 w-4 t-faint" />
            </div>
            <p className={`kpi-value ${c.tone || ""}`}>{c.valor}</p>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3">Movimentação (6 meses)</h2>
          <BarsMovimento data={movimento} />
        </div>
        <div className="card">
          <h2 className="mb-3">Previsão de saldo</h2>
          <AreaPrevisao data={projecao} />
        </div>
      </div>

      {/* Categorias + Faturas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3">Gastos por categoria (mês)</h2>
          {gastosMes.porCategoria.length === 0 ? (
            <p className="text-sm t-muted">Nenhum gasto registrado este mês.</p>
          ) : (
            <ul className="space-y-2.5">
              {gastosMes.porCategoria.slice(0, 7).map((c) => {
                const pct = gastosMes.totalCents ? (c.cents / gastosMes.totalCents) * 100 : 0;
                return (
                  <li key={c.nome}>
                    <div className="flex justify-between text-sm">
                      <span>{c.nome}</span>
                      <span className="font-medium tnum">{c.formatado}</span>
                    </div>
                    <div className="track mt-1">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3">Faturas em aberto</h2>
          {faturas.cartoes.every((c) => c.faturas.length === 0) ? (
            <p className="text-sm t-muted">Nenhuma fatura em aberto.</p>
          ) : (
            <ul className="space-y-3">
              {faturas.cartoes
                .filter((c) => c.faturas.length > 0)
                .map((c) => (
                  <li key={c.cartao} className="text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{c.cartao}</span>
                      <span className="val-neg tnum">{c.totalFormatado}</span>
                    </div>
                    {c.faturas.map((f) => (
                      <div key={f.mes} className="ml-1 flex justify-between text-xs t-muted tnum">
                        <span>vence {f.vencimento || f.mes}</span>
                        <span>{f.formatado}</span>
                      </div>
                    ))}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {/* Parcelamentos em andamento */}
      {parcAtivos.length > 0 && (
        <div className="card">
          <h2 className="mb-3">Parcelamentos em andamento</h2>
          <ul className="space-y-3">
            {parcAtivos.map((p) => (
              <li key={p.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {p.descricao} <span className="t-faint">· {p.pagas} de {p.numParcelas}</span>
                  </span>
                  <span className="tnum t-muted">{p.restanteFormatado} restante</span>
                </div>
                <div className="track mt-1">
                  <span style={{ width: `${p.progresso}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Contas a pagar */}
      {contasAPagar.itens.length > 0 && (
        <div className="card">
          <h2 className="mb-3">Contas a pagar este mês</h2>
          <ul className="divide-y divide-[var(--border)]">
            {contasAPagar.itens.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className={`pill ${i.pago ? "pill-pos" : "pill-warn"}`}>{i.pago ? "Pago" : "A pagar"}</span>
                  {i.nome} <span className="t-faint">— vence {i.vencimento}</span>
                </span>
                <span className={`tnum ${i.pago ? "val-pos" : ""}`}>
                  {i.pago ? i.valorPagoFormatado : i.previstoFormatado || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Últimos lançamentos */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2>Últimos lançamentos</h2>
          {assinaturas.quantidade > 0 && (
            <span className="pill pill-muted">{assinaturas.quantidade} assinaturas · {assinaturas.totalFormatado}/mês</span>
          )}
        </div>
        {ultimas.length === 0 ? (
          <p className="text-sm t-muted">
            Nada por aqui ainda. Use o <strong>Simulador</strong> ou o WhatsApp para registrar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th pb-2">Data</th>
                  <th className="th pb-2">Descrição</th>
                  <th className="th pb-2">Categoria</th>
                  <th className="th pb-2">Forma</th>
                  <th className="th pb-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {ultimas.map((t) => (
                  <tr key={t.id} className="tr">
                    <td className="py-2 t-muted tnum">{formatBR(t.data, "dd/MM HH:mm")}</td>
                    <td className="py-2">{t.descricao}</td>
                    <td className="py-2 t-muted">{t.categoria?.nome || "—"}</td>
                    <td className="py-2 t-muted">
                      {t.formaPagamento}
                      {t.cartao ? ` · ${t.cartao.apelido}` : t.banco ? ` · ${t.banco.nome}` : ""}
                    </td>
                    <td className={`py-2 text-right font-medium tnum ${t.tipo === "entrada" ? "val-pos" : "val-neg"}`}>
                      {t.tipo === "entrada" ? "+" : "-"}
                      {formatBRL(t.valorCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
