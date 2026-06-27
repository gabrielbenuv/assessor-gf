"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";

interface Tx {
  id: string;
  tipo: string;
  valorCents: number;
  descricao: string;
  data: string;
  formaPagamento: string;
  categoria?: { nome: string } | null;
  banco?: { nome: string } | null;
  cartao?: { apelido: string } | null;
}
interface Opt {
  id: string;
  nome?: string;
  apelido?: string;
  tipo?: string;
}

const PERIODOS = [
  { v: "mes", l: "Este mês" },
  { v: "semana", l: "Esta semana" },
  { v: "hoje", l: "Hoje" },
  { v: "7dias", l: "Últimos 7 dias" },
  { v: "30dias", l: "Últimos 30 dias" },
  { v: "mes_passado", l: "Mês passado" },
  { v: "ano", l: "Este ano" },
];

const vazio = {
  tipo: "gasto",
  valor: "",
  descricao: "",
  categoriaId: "",
  formaPagamento: "dinheiro",
  bancoId: "",
  cartaoId: "",
  data: "",
};

export default function TransacoesPage() {
  const [lista, setLista] = useState<Tx[]>([]);
  const [periodo, setPeriodo] = useState("mes");
  const [cats, setCats] = useState<Opt[]>([]);
  const [bancos, setBancos] = useState<Opt[]>([]);
  const [cartoes, setCartoes] = useState<Opt[]>([]);
  const [form, setForm] = useState({ ...vazio });
  const [mostrarForm, setMostrarForm] = useState(false);

  async function carregar() {
    const r = await fetch(`/api/transacoes?periodo=${periodo}`);
    if (r.ok) setLista(await r.json());
  }
  async function carregarOpts() {
    const [rc, rb, rk] = await Promise.all([
      fetch("/api/categorias"),
      fetch("/api/bancos"),
      fetch("/api/cartoes"),
    ]);
    if (rc.ok) setCats(await rc.json());
    if (rb.ok) setBancos(await rb.json());
    if (rk.ok) setCartoes(await rk.json());
  }
  useEffect(() => {
    carregarOpts();
  }, []);
  useEffect(() => {
    carregar();
  }, [periodo]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/transacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) {
      setForm({ ...vazio });
      setMostrarForm(false);
      carregar();
    }
  }

  async function remover(id: string) {
    if (!confirm("Remover lançamento?")) return;
    await fetch(`/api/transacoes/${id}`, { method: "DELETE" });
    carregar();
  }

  const total = lista.reduce((a, t) => a + (t.tipo === "gasto" ? t.valorCents : 0), 0);
  const catsFiltradas = cats.filter((c) => c.tipo === form.tipo);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Transações</h1>
          <p className="text-sm text-slate-400">Lançamentos registrados (manuais e via WhatsApp).</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map((p) => (
              <option key={p.v} value={p.v}>
                {p.l}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)}>
            + Lançar
          </button>
        </div>
      </div>

      {mostrarForm && (
        <form onSubmit={salvar} className="card grid gap-3 md:grid-cols-4">
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value, categoriaId: "" })}>
              <option value="gasto">Gasto</option>
              <option value="entrada">Entrada</option>
            </select>
          </div>
          <div>
            <label className="label">Valor (R$)</label>
            <input className="input" type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
          </div>
          <div className="md:col-span-2">
            <label className="label">Descrição</label>
            <input className="input" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required />
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>
              <option value="">— automática —</option>
              {catsFiltradas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Forma</label>
            <select className="input" value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })}>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
            </select>
          </div>
          {form.formaPagamento === "credito" ? (
            <div>
              <label className="label">Cartão</label>
              <select className="input" value={form.cartaoId} onChange={(e) => setForm({ ...form, cartaoId: e.target.value })}>
                <option value="">—</option>
                {cartoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.apelido}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">Banco</label>
              <select className="input" value={form.bancoId} onChange={(e) => setForm({ ...form, bancoId: e.target.value })}>
                <option value="">—</option>
                {bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Data</label>
            <input className="input" type="datetime-local" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </div>
          <div className="md:col-span-4">
            <button className="btn-primary">Salvar lançamento</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="mb-3 flex justify-between text-sm">
          <span className="text-slate-400">{lista.length} lançamento(s)</span>
          <span className="font-medium text-red-400">Gastos: {formatBRL(total)}</span>
        </div>
        {lista.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma transação no período.</p>
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
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((t) => (
                  <tr key={t.id} className="border-t border-white/10">
                    <td className="py-2 text-slate-400">{new Date(t.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-2">{t.descricao}</td>
                    <td className="py-2">{t.categoria?.nome || "—"}</td>
                    <td className="py-2 text-slate-400">
                      {t.formaPagamento}
                      {t.cartao ? ` · ${t.cartao.apelido}` : t.banco ? ` · ${t.banco.nome}` : ""}
                    </td>
                    <td className={`py-2 text-right font-medium ${t.tipo === "entrada" ? "text-emerald-400" : "text-red-400"}`}>
                      {t.tipo === "entrada" ? "+" : "-"}
                      {formatBRL(t.valorCents)}
                    </td>
                    <td className="py-2 text-right">
                      <button className="text-red-400 hover:underline" onClick={() => remover(t.id)}>
                        remover
                      </button>
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
