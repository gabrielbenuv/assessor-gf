"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";

interface ContaFixa {
  id: string;
  nome: string;
  valorPrevistoCents: number | null;
  diaVencimento: number;
  ativo: boolean;
  usaPadrao: boolean;
  lembreteDiasAntes: number | null;
  categoria?: { nome: string } | null;
  banco?: { nome: string } | null;
  categoriaId: string | null;
  bancoId: string | null;
}
interface Opt {
  id: string;
  nome: string;
  tipo?: string;
}

const vazio = {
  id: "",
  nome: "",
  valorPrevisto: "",
  diaVencimento: "",
  categoriaId: "",
  bancoId: "",
  usaPadrao: true,
  lembreteDiasAntes: "",
};

export default function ContasFixasPage() {
  const [lista, setLista] = useState<ContaFixa[]>([]);
  const [cats, setCats] = useState<Opt[]>([]);
  const [bancos, setBancos] = useState<Opt[]>([]);
  const [form, setForm] = useState({ ...vazio });
  const [erro, setErro] = useState("");

  async function carregar() {
    const [r, rc, rb] = await Promise.all([
      fetch("/api/contas-fixas"),
      fetch("/api/categorias"),
      fetch("/api/bancos"),
    ]);
    if (r.ok) setLista(await r.json());
    if (rc.ok) setCats((await rc.json()).filter((c: Opt) => c.tipo === "gasto"));
    if (rb.ok) setBancos(await rb.json());
  }
  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const payload = {
      nome: form.nome,
      valorPrevisto: form.valorPrevisto || null,
      diaVencimento: form.diaVencimento,
      categoriaId: form.categoriaId || null,
      bancoId: form.bancoId || null,
      usaPadrao: form.usaPadrao,
      lembreteDiasAntes: form.usaPadrao ? null : form.lembreteDiasAntes || null,
    };
    const r = await fetch(form.id ? `/api/contas-fixas/${form.id}` : "/api/contas-fixas", {
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
    if (!confirm("Remover conta fixa?")) return;
    await fetch(`/api/contas-fixas/${id}`, { method: "DELETE" });
    carregar();
  }

  function editar(c: ContaFixa) {
    setForm({
      id: c.id,
      nome: c.nome,
      valorPrevisto: c.valorPrevistoCents ? String(c.valorPrevistoCents / 100) : "",
      diaVencimento: String(c.diaVencimento),
      categoriaId: c.categoriaId || "",
      bancoId: c.bancoId || "",
      usaPadrao: c.usaPadrao,
      lembreteDiasAntes: c.lembreteDiasAntes != null ? String(c.lembreteDiasAntes) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contas fixas 📌</h1>
        <p className="text-sm text-slate-400">
          Suas contas recorrentes (aluguel, luz, água, assinaturas...). No dia 1º do mês você recebe o relatório de tudo a pagar.
        </p>
      </div>

      <form onSubmit={salvar} className="card grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2">
          <label className="label">Nome</label>
          <input
            className="input"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Aluguel, Luz, Internet"
            required
          />
        </div>
        <div>
          <label className="label">Valor previsto (R$)</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={form.valorPrevisto}
            onChange={(e) => setForm({ ...form, valorPrevisto: e.target.value })}
            placeholder="opcional"
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
          <label className="label">Categoria</label>
          <select className="input" value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>
            <option value="">— automática —</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Pagar de qual conta (opcional)</label>
          <select className="input" value={form.bancoId} onChange={(e) => setForm({ ...form, bancoId: e.target.value })}>
            <option value="">— nenhuma —</option>
            {bancos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-5 grid gap-3 rounded-lg bg-white/5 p-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.usaPadrao}
              onChange={(e) => setForm({ ...form, usaPadrao: e.target.checked })}
            />
            🔔 Usar o lembrete padrão (definido em Notificações)
          </label>
          {!form.usaPadrao && (
            <div>
              <label className="label">Avisar quantos dias antes do vencimento (só desta conta)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={20}
                value={form.lembreteDiasAntes}
                onChange={(e) => setForm({ ...form, lembreteDiasAntes: e.target.value })}
                placeholder="ex: 2"
              />
            </div>
          )}
        </div>
        {erro && <p className="md:col-span-5 text-sm text-red-400">{erro}</p>}
        <div className="md:col-span-5 flex gap-2">
          <button className="btn-primary">{form.id ? "Salvar alterações" : "Adicionar conta fixa"}</button>
          {form.id && (
            <button type="button" className="btn-ghost" onClick={() => setForm({ ...vazio })}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="card">
        {lista.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma conta fixa cadastrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400">
              <tr>
                <th className="pb-2">Nome</th>
                <th className="pb-2">Vence dia</th>
                <th className="pb-2">Valor previsto</th>
                <th className="pb-2">Categoria</th>
                <th className="pb-2">Conta</th>
                <th className="pb-2">Lembrete</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="border-t border-white/10">
                  <td className="py-2 font-medium">{c.nome}</td>
                  <td className="py-2">dia {c.diaVencimento}</td>
                  <td className="py-2 text-slate-400">
                    {c.valorPrevistoCents ? formatBRL(c.valorPrevistoCents) : "—"}
                  </td>
                  <td className="py-2 text-slate-400">{c.categoria?.nome || "—"}</td>
                  <td className="py-2 text-slate-400">{c.banco?.nome || "—"}</td>
                  <td className="py-2 text-slate-400">
                    {c.usaPadrao ? "padrão" : `${c.lembreteDiasAntes ?? "?"}d antes`}
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
