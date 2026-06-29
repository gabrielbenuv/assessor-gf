"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";
import { useDominio } from "@/lib/useDominio";
import { Icon } from "@/components/Icon";

interface Categoria {
  id: string;
  nome: string;
  tipo: string;
  orcamentoMensalCents: number | null;
}
interface Consumo {
  nome: string;
  gastoCents: number;
  gastoFormatado: string;
  tetoCents: number | null;
  pct: number | null;
  estourou: boolean;
}

export default function CategoriasPage() {
  const dominio = useDominio();
  const [lista, setLista] = useState<Categoria[]>([]);
  const [consumo, setConsumo] = useState<Record<string, Consumo>>({});
  const [form, setForm] = useState({ nome: "", tipo: "gasto", orcamentoMensal: "" });
  const [erro, setErro] = useState("");
  const [tetoEdit, setTetoEdit] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    const [cats, cons] = await Promise.all([
      fetch(`/api/categorias?dominio=${dominio}`).then((r) => r.json()),
      fetch(`/api/categorias/consumo?dominio=${dominio}`).then((r) => r.json()),
    ]);
    setLista(cats);
    const map: Record<string, Consumo> = {};
    for (const c of cons.itens || []) map[c.nome] = c;
    setConsumo(map);
  }, [dominio]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const r = await fetch("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, dominio }),
    });
    if (r.ok) { setForm({ nome: "", tipo: "gasto", orcamentoMensal: "" }); carregar(); }
    else setErro((await r.json().catch(() => ({}))).error || "Erro ao salvar.");
  }

  async function salvarTeto(id: string, nome: string) {
    const v = tetoEdit[id];
    if (v === undefined) return;
    await fetch(`/api/categorias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orcamentoMensal: v === "" ? null : v }),
    });
    setTetoEdit((s) => { const n = { ...s }; delete n[id]; return n; });
    carregar();
  }

  async function remover(id: string) {
    if (!confirm("Remover categoria?")) return;
    await fetch(`/api/categorias/${id}`, { method: "DELETE" });
    carregar();
  }

  const gastos = lista.filter((c) => c.tipo === "gasto");
  const entradas = lista.filter((c) => c.tipo === "entrada");

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Cadastros</p>
        <h1>Categorias</h1>
        <p className="text-sm t-muted">A IA classifica os lançamentos nelas. Defina um <strong>teto</strong> para acompanhar o consumo do mês.</p>
      </div>

      <form onSubmit={salvar} className="card grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="label">Nome</label>
          <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Pets" required />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="gasto">Gasto</option>
            <option value="entrada">Entrada</option>
          </select>
        </div>
        <div>
          <label className="label">Teto mensal (R$)</label>
          <input className="input tnum" type="number" step="0.01" value={form.orcamentoMensal} onChange={(e) => setForm({ ...form, orcamentoMensal: e.target.value })} placeholder="opcional" disabled={form.tipo !== "gasto"} />
        </div>
        {erro && <p className="md:col-span-4 text-sm val-neg">{erro}</p>}
        <div className="md:col-span-4">
          <button className="btn-primary"><Icon name="plus" className="h-4 w-4" /> Adicionar categoria</button>
        </div>
      </form>

      <div className="card">
        <h2 className="mb-4">Gastos</h2>
        {gastos.length === 0 ? (
          <p className="text-sm t-muted">Nenhuma.</p>
        ) : (
          <ul className="space-y-3.5">
            {gastos.map((c) => {
              const con = consumo[c.nome];
              const teto = c.orcamentoMensalCents;
              const pct = teto ? Math.min(100, Math.round(((con?.gastoCents || 0) / teto) * 100)) : null;
              const estourou = teto != null && (con?.gastoCents || 0) > teto;
              const editing = tetoEdit[c.id] !== undefined;
              return (
                <li key={c.id} className="border-b border-hair pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{c.nome}</span>
                    <div className="flex items-center gap-2">
                      <span className="t-muted tnum">
                        {formatBRL(con?.gastoCents || 0)}
                        {teto != null && <span className="t-faint"> / {formatBRL(teto)}</span>}
                      </span>
                      {estourou && <span className="pill pill-neg">Estourou</span>}
                      {editing ? (
                        <>
                          <input className="input tnum w-24 py-1" type="number" step="0.01" autoFocus value={tetoEdit[c.id]} onChange={(e) => setTetoEdit({ ...tetoEdit, [c.id]: e.target.value })} placeholder="teto" />
                          <button className="btn-primary btn-sm" onClick={() => salvarTeto(c.id, c.nome)}>OK</button>
                        </>
                      ) : (
                        <button className="t-accent text-xs hover:underline" onClick={() => setTetoEdit({ ...tetoEdit, [c.id]: teto ? String(teto / 100) : "" })}>
                          {teto != null ? "editar teto" : "definir teto"}
                        </button>
                      )}
                      <button className="val-neg" onClick={() => remover(c.id)} aria-label="Remover"><Icon name="trash" className="h-4 w-4" /></button>
                    </div>
                  </div>
                  {pct != null && (
                    <div className="track mt-1.5">
                      <span style={{ width: `${pct}%`, background: estourou ? "var(--neg)" : "var(--accent)" }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3">Entradas</h2>
        <div className="flex flex-wrap gap-2">
          {entradas.length === 0 && <p className="text-sm t-muted">Nenhuma.</p>}
          {entradas.map((c) => (
            <span key={c.id} className="pill pill-muted">
              {c.nome}
              <button className="val-neg" onClick={() => remover(c.id)} aria-label="Remover"><Icon name="x" className="h-3.5 w-3.5" /></button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
