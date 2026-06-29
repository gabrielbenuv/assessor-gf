"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";
import { useDominio } from "@/lib/useDominio";
import { Icon } from "@/components/Icon";

interface Tx {
  id: string;
  tipo: string;
  valorCents: number;
  descricao: string;
  data: string;
  formaPagamento: string;
  origemTipo: string;
  categoria?: { nome: string } | null;
  banco?: { nome: string } | null;
  cartao?: { apelido: string } | null;
}
interface Opt { id: string; nome?: string; apelido?: string; tipo?: string }

const PERIODOS = [
  { v: "mes", l: "Este mês" },
  { v: "semana", l: "Esta semana" },
  { v: "hoje", l: "Hoje" },
  { v: "7dias", l: "Últimos 7 dias" },
  { v: "30dias", l: "Últimos 30 dias" },
  { v: "mes_passado", l: "Mês passado" },
  { v: "ano", l: "Este ano" },
];

const vazio = { tipo: "gasto", valor: "", descricao: "", categoriaId: "", formaPagamento: "dinheiro", bancoId: "", cartaoId: "", data: "" };

export default function TransacoesPage() {
  const dominio = useDominio();
  const [lista, setLista] = useState<Tx[]>([]);
  const [periodo, setPeriodo] = useState("mes");
  const [cats, setCats] = useState<Opt[]>([]);
  const [bancos, setBancos] = useState<Opt[]>([]);
  const [cartoes, setCartoes] = useState<Opt[]>([]);
  const [form, setForm] = useState({ ...vazio });
  const [mostrarForm, setMostrarForm] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/transacoes?periodo=${periodo}&dominio=${dominio}`);
    if (r.ok) setLista(await r.json());
  }, [periodo, dominio]);
  const carregarOpts = useCallback(async () => {
    const [rc, rb, rk] = await Promise.all([
      fetch(`/api/categorias?dominio=${dominio}`),
      fetch(`/api/bancos?dominio=${dominio}`),
      fetch(`/api/cartoes?dominio=${dominio}`),
    ]);
    if (rc.ok) setCats(await rc.json());
    if (rb.ok) setBancos(await rb.json());
    if (rk.ok) setCartoes(await rk.json());
  }, [dominio]);
  useEffect(() => { carregarOpts(); }, [carregarOpts]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/transacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, dominio }),
    });
    if (r.ok) { setForm({ ...vazio }); setMostrarForm(false); carregar(); }
  }

  async function remover(id: string) {
    if (!confirm("Remover lançamento?")) return;
    await fetch(`/api/transacoes/${id}`, { method: "DELETE" });
    carregar();
  }

  const totalGasto = lista.reduce((a, t) => a + (t.tipo === "gasto" ? t.valorCents : 0), 0);
  const totalEntrada = lista.reduce((a, t) => a + (t.tipo === "entrada" ? t.valorCents : 0), 0);
  const catsFiltradas = cats.filter((c) => c.tipo === form.tipo);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Painel</p>
          <h1>Transações</h1>
          <p className="text-sm t-muted">A fonte da verdade do fluxo de caixa (manuais e via WhatsApp).</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
          <a href={`/api/planilha?dominio=${dominio}`} className="btn-ghost btn-sm"><Icon name="download" className="h-4 w-4" /> Exportar</a>
          <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)}><Icon name="plus" className="h-4 w-4" /> Lançar</button>
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
            <input className="input tnum" type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
          </div>
          <div className="md:col-span-2">
            <label className="label">Descrição</label>
            <input className="input" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required />
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>
              <option value="">automática</option>
              {catsFiltradas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
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
                {cartoes.map((c) => <option key={c.id} value={c.id}>{c.apelido}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">Banco</label>
              <select className="input" value={form.bancoId} onChange={(e) => setForm({ ...form, bancoId: e.target.value })}>
                <option value="">—</option>
                {bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
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
          <span className="t-muted">{lista.length} lançamento(s)</span>
          <span className="tnum">
            <span className="val-pos">+{formatBRL(totalEntrada)}</span> · <span className="val-neg">-{formatBRL(totalGasto)}</span>
          </span>
        </div>
        {lista.length === 0 ? (
          <p className="text-sm t-muted">Nenhuma transação no período.</p>
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
                  <th className="th pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((t) => (
                  <tr key={t.id} className="tr">
                    <td className="py-2.5 t-muted tnum">{new Date(t.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-2.5">{t.descricao}</td>
                    <td className="py-2.5 t-muted">{t.categoria?.nome || "—"}</td>
                    <td className="py-2.5 t-muted">
                      {t.formaPagamento}
                      {t.cartao ? ` · ${t.cartao.apelido}` : t.banco ? ` · ${t.banco.nome}` : ""}
                    </td>
                    <td className={`py-2.5 text-right font-medium tnum ${t.tipo === "entrada" ? "val-pos" : "val-neg"}`}>
                      {t.tipo === "entrada" ? "+" : "-"}{formatBRL(t.valorCents)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button className="val-neg hover:underline" onClick={() => remover(t.id)}>remover</button>
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
