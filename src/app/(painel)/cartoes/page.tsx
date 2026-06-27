"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";

interface Cartao {
  id: string;
  apelido: string;
  bandeira: string | null;
  diaFechamento: number;
  diaVencimento: number;
  limiteCents: number | null;
  bancoId: string | null;
  banco?: { nome: string } | null;
  lembreteFaturaAtivo: boolean;
  lembreteDiasAntes: number;
  lembreteFechamentoAtivo: boolean;
}
interface Banco {
  id: string;
  nome: string;
}

const vazio = {
  id: "",
  apelido: "",
  bandeira: "",
  diaFechamento: "",
  diaVencimento: "",
  limite: "",
  bancoId: "",
  lembreteFaturaAtivo: true,
  lembreteDiasAntes: "5",
  lembreteFechamentoAtivo: false,
};

export default function CartoesPage() {
  const [lista, setLista] = useState<Cartao[]>([]);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [form, setForm] = useState({ ...vazio });
  const [erro, setErro] = useState("");

  async function carregar() {
    const [rc, rb] = await Promise.all([fetch("/api/cartoes"), fetch("/api/bancos")]);
    if (rc.ok) setLista(await rc.json());
    if (rb.ok) setBancos(await rb.json());
  }
  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const payload = {
      apelido: form.apelido,
      bandeira: form.bandeira,
      diaFechamento: form.diaFechamento,
      diaVencimento: form.diaVencimento,
      limite: form.limite || null,
      bancoId: form.bancoId || null,
      lembreteFaturaAtivo: form.lembreteFaturaAtivo,
      lembreteDiasAntes: form.lembreteDiasAntes || 5,
      lembreteFechamentoAtivo: form.lembreteFechamentoAtivo,
    };
    const r = await fetch(form.id ? `/api/cartoes/${form.id}` : "/api/cartoes", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      setForm({ ...vazio });
      carregar();
    } else {
      setErro((await r.json().catch(() => ({}))).error || "Erro ao salvar.");
    }
  }

  async function remover(id: string) {
    if (!confirm("Remover este cartão?")) return;
    await fetch(`/api/cartoes/${id}`, { method: "DELETE" });
    carregar();
  }

  function editar(c: Cartao) {
    setForm({
      id: c.id,
      apelido: c.apelido,
      bandeira: c.bandeira || "",
      diaFechamento: String(c.diaFechamento),
      diaVencimento: String(c.diaVencimento),
      limite: c.limiteCents ? String(c.limiteCents / 100) : "",
      bancoId: c.bancoId || "",
      lembreteFaturaAtivo: c.lembreteFaturaAtivo,
      lembreteDiasAntes: String(c.lembreteDiasAntes ?? 5),
      lembreteFechamentoAtivo: c.lembreteFechamentoAtivo,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cartões de crédito</h1>
        <p className="text-sm text-slate-400">
          Informe o <strong>fechamento</strong> e o <strong>vencimento</strong> da fatura — é o que define em qual mês cada gasto cai.
        </p>
      </div>

      <form onSubmit={salvar} className="card grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="label">Apelido</label>
          <input
            className="input"
            value={form.apelido}
            onChange={(e) => setForm({ ...form, apelido: e.target.value })}
            placeholder="Ex: Nubank Roxinho"
            required
          />
        </div>
        <div>
          <label className="label">Bandeira</label>
          <input
            className="input"
            value={form.bandeira}
            onChange={(e) => setForm({ ...form, bandeira: e.target.value })}
            placeholder="Visa"
          />
        </div>
        <div>
          <label className="label">Dia fechamento</label>
          <input
            className="input"
            type="number"
            min={1}
            max={31}
            value={form.diaFechamento}
            onChange={(e) => setForm({ ...form, diaFechamento: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Dia vencimento</label>
          <input
            className="input"
            type="number"
            min={1}
            max={31}
            value={form.diaVencimento}
            onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Limite (R$)</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={form.limite}
            onChange={(e) => setForm({ ...form, limite: e.target.value })}
            placeholder="opcional"
          />
        </div>
        <div className="md:col-span-3">
          <label className="label">Banco vinculado</label>
          <select className="input" value={form.bancoId} onChange={(e) => setForm({ ...form, bancoId: e.target.value })}>
            <option value="">— nenhum —</option>
            {bancos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-6 grid gap-3 rounded-lg bg-white/5 p-3 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.lembreteFaturaAtivo}
              onChange={(e) => setForm({ ...form, lembreteFaturaAtivo: e.target.checked })}
            />
            🔔 Lembrar da fatura no WhatsApp
          </label>
          <div>
            <label className="label">Avisar quantos dias antes do vencimento</label>
            <input
              className="input"
              type="number"
              min={0}
              max={20}
              value={form.lembreteDiasAntes}
              onChange={(e) => setForm({ ...form, lembreteDiasAntes: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.lembreteFechamentoAtivo}
              onChange={(e) => setForm({ ...form, lembreteFechamentoAtivo: e.target.checked })}
            />
            📩 Avisar quando a fatura fechar
          </label>
        </div>
        {erro && <p className="md:col-span-6 text-sm text-red-400">{erro}</p>}
        <div className="md:col-span-6 flex gap-2">
          <button className="btn-primary">{form.id ? "Salvar alterações" : "Adicionar cartão"}</button>
          {form.id && (
            <button type="button" className="btn-ghost" onClick={() => setForm({ ...vazio })}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="card">
        {lista.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum cartão cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400">
              <tr>
                <th className="pb-2">Apelido</th>
                <th className="pb-2">Bandeira</th>
                <th className="pb-2">Fecha</th>
                <th className="pb-2">Vence</th>
                <th className="pb-2">Limite</th>
                <th className="pb-2">Banco</th>
                <th className="pb-2">Lembrete</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="border-t border-white/10">
                  <td className="py-2 font-medium">{c.apelido}</td>
                  <td className="py-2 text-slate-400">{c.bandeira || "—"}</td>
                  <td className="py-2">dia {c.diaFechamento}</td>
                  <td className="py-2">dia {c.diaVencimento}</td>
                  <td className="py-2 text-slate-400">{c.limiteCents ? formatBRL(c.limiteCents) : "—"}</td>
                  <td className="py-2 text-slate-400">{c.banco?.nome || "—"}</td>
                  <td className="py-2 text-slate-400">
                    {c.lembreteFaturaAtivo ? `${c.lembreteDiasAntes}d antes` : "off"}
                  </td>
                  <td className="py-2 text-right">
                    <button className="text-brand-400 hover:underline" onClick={() => editar(c)}>
                      editar
                    </button>
                    <button className="ml-3 text-red-400 hover:underline" onClick={() => remover(c.id)}>
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
