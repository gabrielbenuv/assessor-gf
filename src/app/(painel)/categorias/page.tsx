"use client";

import { useEffect, useState } from "react";

interface Categoria {
  id: string;
  nome: string;
  tipo: string;
  emoji: string | null;
}

export default function CategoriasPage() {
  const [lista, setLista] = useState<Categoria[]>([]);
  const [form, setForm] = useState({ nome: "", tipo: "gasto", emoji: "" });
  const [erro, setErro] = useState("");

  async function carregar() {
    const r = await fetch("/api/categorias");
    if (r.ok) setLista(await r.json());
  }
  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const r = await fetch("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) {
      setForm({ nome: "", tipo: "gasto", emoji: "" });
      carregar();
    } else {
      setErro((await r.json().catch(() => ({}))).error || "Erro ao salvar.");
    }
  }

  async function remover(id: string) {
    if (!confirm("Remover categoria?")) return;
    await fetch(`/api/categorias/${id}`, { method: "DELETE" });
    carregar();
  }

  const gastos = lista.filter((c) => c.tipo === "gasto");
  const entradas = lista.filter((c) => c.tipo === "entrada");

  function Coluna({ titulo, itens }: { titulo: string; itens: Categoria[] }) {
    return (
      <div className="card">
        <h2 className="mb-3 font-semibold">{titulo}</h2>
        <div className="flex flex-wrap gap-2">
          {itens.map((c) => (
            <span key={c.id} className="badge bg-slate-100 text-slate-700">
              {c.emoji} {c.nome}
              <button className="ml-1 text-red-400 hover:text-red-600" onClick={() => remover(c.id)}>
                ×
              </button>
            </span>
          ))}
          {itens.length === 0 && <p className="text-sm text-slate-400">Nenhuma.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Categorias</h1>
        <p className="text-sm text-slate-500">A IA usa estas categorias para classificar os lançamentos.</p>
      </div>

      <form onSubmit={salvar} className="card grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="label">Nome</label>
          <input
            className="input"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Pets"
            required
          />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="gasto">Gasto</option>
            <option value="entrada">Entrada</option>
          </select>
        </div>
        <div>
          <label className="label">Emoji</label>
          <input
            className="input"
            value={form.emoji}
            onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            placeholder="🐶"
          />
        </div>
        {erro && <p className="md:col-span-4 text-sm text-red-600">{erro}</p>}
        <div className="md:col-span-4">
          <button className="btn-primary">Adicionar categoria</button>
        </div>
      </form>

      <div className="grid gap-6 md:grid-cols-2">
        <Coluna titulo="Gastos" itens={gastos} />
        <Coluna titulo="Entradas" itens={entradas} />
      </div>
    </div>
  );
}
