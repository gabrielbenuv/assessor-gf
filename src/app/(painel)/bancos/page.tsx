"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";

interface Banco {
  id: string;
  nome: string;
  tipo: string;
  saldoInicialCents: number;
  saldoAtualCents: number;
  contaSalario: boolean;
  contaReceber: boolean;
  ativo: boolean;
}

const TIPOS = [
  { v: "conta_corrente", l: "Conta corrente" },
  { v: "poupanca", l: "Poupança" },
  { v: "carteira", l: "Carteira / Dinheiro" },
];

export default function BancosPage() {
  const [lista, setLista] = useState<Banco[]>([]);
  const [form, setForm] = useState({ id: "", nome: "", tipo: "conta_corrente", saldoInicial: "", contaSalario: false, contaReceber: false });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const r = await fetch("/api/bancos");
    if (r.ok) setLista(await r.json());
  }
  useEffect(() => {
    carregar();
  }, []);

  function limpar() {
    setForm({ id: "", nome: "", tipo: "conta_corrente", saldoInicial: "", contaSalario: false, contaReceber: false });
    setErro("");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    const payload = { nome: form.nome, tipo: form.tipo, saldoInicial: form.saldoInicial || 0, contaSalario: form.contaSalario, contaReceber: form.contaReceber };
    const r = await fetch(form.id ? `/api/bancos/${form.id}` : "/api/bancos", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSalvando(false);
    if (r.ok) {
      limpar();
      carregar();
    } else {
      setErro((await r.json().catch(() => ({}))).error || "Erro ao salvar.");
    }
  }

  async function remover(id: string) {
    if (!confirm("Remover este banco?")) return;
    await fetch(`/api/bancos/${id}`, { method: "DELETE" });
    carregar();
  }

  function editar(b: Banco) {
    setForm({ id: b.id, nome: b.nome, tipo: b.tipo, saldoInicial: String(b.saldoInicialCents / 100), contaSalario: b.contaSalario, contaReceber: b.contaReceber });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bancos & contas</h1>
        <p className="text-sm text-slate-400">
          Cadastre suas contas e o <strong>saldo inicial</strong>. O assessor opera em cima disso.
        </p>
      </div>

      <form onSubmit={salvar} className="card grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="label">Nome</label>
          <input
            className="input"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Nubank, Itaú, Carteira"
            required
          />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            {TIPOS.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Saldo inicial (R$)</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={form.saldoInicial}
            onChange={(e) => setForm({ ...form, saldoInicial: e.target.value })}
            placeholder="0,00"
          />
        </div>
        <label className="md:col-span-4 flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={form.contaSalario}
            onChange={(e) => setForm({ ...form, contaSalario: e.target.checked })}
          />
          💰 Esta é a conta onde cai o meu salário (padrão para entradas)
        </label>
        <label className="md:col-span-4 flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={form.contaReceber}
            onChange={(e) => setForm({ ...form, contaReceber: e.target.checked })}
          />
          📥 Esta é uma conta a receber (entradas podem cair aqui — se houver mais de uma, ele pergunta qual)
        </label>
        {erro && <p className="md:col-span-4 text-sm text-red-400">{erro}</p>}
        <div className="md:col-span-4 flex gap-2">
          <button className="btn-primary" disabled={salvando}>
            {form.id ? "Salvar alterações" : "Adicionar banco"}
          </button>
          {form.id && (
            <button type="button" className="btn-ghost" onClick={limpar}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="card">
        {lista.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum banco cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400">
              <tr>
                <th className="pb-2">Nome</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2 text-right">Saldo inicial</th>
                <th className="pb-2 text-right">Saldo atual</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((b) => (
                <tr key={b.id} className="border-t border-white/10">
                  <td className="py-2 font-medium">
                    {b.nome}
                    {b.contaSalario && (
                      <span className="badge ml-2 bg-emerald-500/15 text-emerald-400">💰 salário</span>
                    )}
                    {b.contaReceber && (
                      <span className="badge ml-2 bg-sky-500/15 text-sky-400">📥 a receber</span>
                    )}
                  </td>
                  <td className="py-2 text-slate-400">{TIPOS.find((t) => t.v === b.tipo)?.l || b.tipo}</td>
                  <td className="py-2 text-right text-slate-400">{formatBRL(b.saldoInicialCents)}</td>
                  <td className="py-2 text-right font-medium">{formatBRL(b.saldoAtualCents)}</td>
                  <td className="py-2 text-right">
                    <button className="text-brand-400 hover:underline" onClick={() => editar(b)}>
                      editar
                    </button>
                    <button className="ml-3 text-red-400 hover:underline" onClick={() => remover(b.id)}>
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
