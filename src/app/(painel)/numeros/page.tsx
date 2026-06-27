"use client";

import { useEffect, useState } from "react";

interface Numero {
  id: string;
  numero: string;
  apelido: string | null;
  ativo: boolean;
}

export default function NumerosPage() {
  const [lista, setLista] = useState<Numero[]>([]);
  const [form, setForm] = useState({ numero: "", apelido: "" });
  const [erro, setErro] = useState("");

  async function carregar() {
    const r = await fetch("/api/numeros");
    if (r.ok) setLista(await r.json());
  }
  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const r = await fetch("/api/numeros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) {
      setForm({ numero: "", apelido: "" });
      carregar();
    } else {
      setErro((await r.json().catch(() => ({}))).error || "Erro ao salvar.");
    }
  }

  async function toggle(n: Numero) {
    await fetch(`/api/numeros/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !n.ativo }),
    });
    carregar();
  }

  async function remover(id: string) {
    if (!confirm("Remover número?")) return;
    await fetch(`/api/numeros/${id}`, { method: "DELETE" });
    carregar();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Números autorizados 🔒</h1>
        <p className="text-sm text-slate-400">
          A IA <strong>só responde</strong> os números desta lista. Qualquer outro contato é ignorado.
          Formato: código do país + DDD + número (ex: <code>5511999998888</code>).
        </p>
      </div>

      <form onSubmit={salvar} className="card grid gap-3 md:grid-cols-3">
        <div>
          <label className="label">Número (com DDI + DDD)</label>
          <input
            className="input"
            value={form.numero}
            onChange={(e) => setForm({ ...form, numero: e.target.value })}
            placeholder="5511999998888"
            required
          />
        </div>
        <div>
          <label className="label">Apelido</label>
          <input
            className="input"
            value={form.apelido}
            onChange={(e) => setForm({ ...form, apelido: e.target.value })}
            placeholder="Meu WhatsApp"
          />
        </div>
        <div className="flex items-end">
          <button className="btn-primary">Autorizar número</button>
        </div>
        {erro && <p className="md:col-span-3 text-sm text-red-400">{erro}</p>}
      </form>

      <div className="card">
        {lista.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nenhum número autorizado. <strong>Enquanto a lista estiver vazia, o assessor não responde ninguém.</strong>
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400">
              <tr>
                <th className="pb-2">Número</th>
                <th className="pb-2">Apelido</th>
                <th className="pb-2">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((n) => (
                <tr key={n.id} className="border-t border-white/10">
                  <td className="py-2 font-mono">{n.numero}</td>
                  <td className="py-2">{n.apelido || "—"}</td>
                  <td className="py-2">
                    <span className={`badge ${n.ativo ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-slate-400"}`}>
                      {n.ativo ? "ativo" : "inativo"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button className="text-brand-400 hover:underline" onClick={() => toggle(n)}>
                      {n.ativo ? "desativar" : "ativar"}
                    </button>
                    <button className="ml-3 text-red-400 hover:underline" onClick={() => remover(n.id)}>
                      remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
