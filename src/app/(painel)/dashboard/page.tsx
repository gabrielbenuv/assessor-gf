import { resumoDashboard } from "@/lib/finance";
import { formatBRL } from "@/lib/money";
import { formatBR } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { gastosMes, entradasMes, saldos, faturas, ultimas, contasAPagar } = await resumoDashboard();

  const cards = [
    { label: "Gastos do mês", valor: gastosMes.totalFormatado, cor: "text-red-600", icon: "📉" },
    { label: "Entradas do mês", valor: entradasMes.totalFormatado, cor: "text-emerald-600", icon: "📈" },
    { label: "Saldo total", valor: saldos.totalFormatado, cor: "text-slate-800", icon: "🏦" },
    { label: "Faturas em aberto", valor: faturas.totalFormatado, cor: "text-amber-600", icon: "💳" },
    { label: "Contas a pagar (mês)", valor: contasAPagar.totalAPagarFormatado, cor: "text-rose-600", icon: "📌" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-500">Resumo do mês atual</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-xs text-slate-500">
              {c.icon} {c.label}
            </p>
            <p className={`mt-1 text-xl font-semibold ${c.cor}`}>{c.valor}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Gastos por categoria (mês)</h2>
          {gastosMes.porCategoria.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum gasto registrado este mês.</p>
          ) : (
            <ul className="space-y-2">
              {gastosMes.porCategoria.map((c) => {
                const pct = gastosMes.totalCents ? (c.cents / gastosMes.totalCents) * 100 : 0;
                return (
                  <li key={c.nome}>
                    <div className="flex justify-between text-sm">
                      <span>{c.nome}</span>
                      <span className="font-medium">{c.formatado}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Faturas em aberto</h2>
          {faturas.cartoes.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum cartão cadastrado.</p>
          ) : (
            <ul className="space-y-3">
              {faturas.cartoes.map((c) => (
                <li key={c.cartao} className="text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{c.cartao}</span>
                    <span className="text-amber-600">{c.totalFormatado}</span>
                  </div>
                  {c.faturas.map((f) => (
                    <div key={f.mes} className="ml-1 flex justify-between text-xs text-slate-500">
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

      {contasAPagar.itens.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Contas a pagar este mês 📌</h2>
          <ul className="space-y-2">
            {contasAPagar.itens.map((i) => (
              <li key={i.id} className="flex items-center justify-between text-sm">
                <span>
                  {i.pago ? "✅" : "⏳"} {i.nome}{" "}
                  <span className="text-slate-400">— vence {i.vencimento}</span>
                </span>
                <span className={i.pago ? "text-emerald-600" : "text-rose-600"}>
                  {i.pago ? i.valorPagoFormatado : i.previstoFormatado || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 font-semibold">Últimos lançamentos</h2>
        {ultimas.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nada por aqui ainda. Use o <strong>Simulador</strong> ou o WhatsApp para registrar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400">
                <tr>
                  <th className="pb-2">Data</th>
                  <th className="pb-2">Descrição</th>
                  <th className="pb-2">Categoria</th>
                  <th className="pb-2">Forma</th>
                  <th className="pb-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {ultimas.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="py-2 text-slate-500">{formatBR(t.data, "dd/MM HH:mm")}</td>
                    <td className="py-2">{t.descricao}</td>
                    <td className="py-2">{t.categoria?.nome || "—"}</td>
                    <td className="py-2 text-slate-500">
                      {t.formaPagamento}
                      {t.cartao ? ` · ${t.cartao.apelido}` : t.banco ? ` · ${t.banco.nome}` : ""}
                    </td>
                    <td className={`py-2 text-right font-medium ${t.tipo === "entrada" ? "text-emerald-600" : "text-red-600"}`}>
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
