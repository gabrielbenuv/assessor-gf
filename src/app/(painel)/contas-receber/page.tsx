"use client";

import { useCallback, useEffect, useState } from "react";
import { useDominio } from "@/lib/useDominio";
import { formatBRL } from "@/lib/money";
import { Icon } from "@/components/Icon";

interface Receb {
  id: string;
  nome: string;
  valorPrevistoCents: number | null;
  diaVencimento: number;
  recorrencia: string;
  banco?: { nome: string } | null;
}
interface Opt { id: string; nome: string }

export default function ContasReceberPage() {
  const dominio = useDominio();
  const [lista, setLista] = useState<Receb[]>([]);
  const [bancos, setBancos] = useState<Opt[]>([]);
  const [form, setForm] = useState({ id: "", nome: "", valorPrevisto: "", diaVencimento: "", recorrencia: "mensal", bancoId: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const [r, b] = await Promise.all([
      fetch(`/api/contas-fixas?tipo=recebimento&dominio=${dominio}`).then((x) => x.json()),
      fetch(`/api/bancos?dominio=${dominio}`).then((x) => x.json()),
    ]);
    setLista(r);
    setBancos(b);
  }, [dominio]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function limpar() {
    setForm({ id: "", nome: "", valorPrevisto: "", diaVencimento: "", recorrencia: "mensal", bancoId: "" });
    setErro("");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    const payload = { ...form, tipo: "recebimento", dominio };
    const r = await fetch(form.id ? `/api/contas-fixas/${form.id}` : "/api/contas-fixas", {
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
    if (!confirm("Remover este recebimento?")) return;
    await fetch(`/api/contas-fixas/${id}`, { method: "DELETE" });
    carregar();
  }

  function editar(r: Receb) {
    setForm({
      id: r.id,
      nome: r.nome,
      valorPrevisto: r.valorPrevistoCents ? String(r.valorPrevistoCents / 100) : "",
      diaVencimento: String(r.diaVencimento),
      recorrencia: r.recorrencia || "mensal",
      bancoId: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const totalCents = lista.reduce((a, r) => a + (r.valorPrevistoCents || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Painel</p>
          <h1>Contas a receber</h1>
          <p className="text-sm t-muted">Recebimentos recorrentes (salário, aluguéis, mensalidades). Entram na previsão de caixa.</p>
        </div>
        <div className="text-right">
          <p className="kpi-label">Previsto/mês</p>
          <p className="text-xl font-bold val-pos tnum">{formatBRL(totalCents)}</p>
        </div>
      </div>

      <form onSubmit={salvar} className="card grid gap-3 md:grid-cols-12">
        <div className="md:col-span-4">
          <label className="label">Descrição</label>
          <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Aluguel recebido" required />
        </div>
        <div className="md:col-span-3">
          <label className="label">Valor previsto (R$)</label>
          <input className="input tnum" type="number" step="0.01" value={form.valorPrevisto} onChange={(e) => setForm({ ...form, valorPrevisto: e.target.value })} placeholder="0,00" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Dia</label>
          <input className="input tnum" type="number" min={1} max={31} value={form.diaVencimento} onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })} placeholder="5" required />
        </div>
        <div className="md:col-span-3">
          <label className="label">Recorrência</label>
          <select className="input" value={form.recorrencia} onChange={(e) => setForm({ ...form, recorrencia: e.target.value })}>
            <option value="mensal">Mensal</option>
            <option value="semanal">Semanal</option>
            <option value="trimestral">Trimestral</option>
            <option value="anual">Anual</option>
          </select>
        </div>
        {erro && <p className="md:col-span-12 text-sm val-neg">{erro}</p>}
        <div className="md:col-span-12 flex gap-2">
          <button className="btn-primary" disabled={salvando}>{form.id ? "Salvar" : "Adicionar"}</button>
          {form.id && <button type="button" className="btn-ghost" onClick={limpar}>Cancelar</button>}
        </div>
      </form>

      <div className="card">
        {lista.length === 0 ? (
          <p className="text-sm t-muted">Nenhum recebimento cadastrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th pb-2">Descrição</th>
                <th className="th pb-2">Recorrência</th>
                <th className="th pb-2">Dia</th>
                <th className="th pb-2 text-right">Previsto</th>
                <th className="th pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id} className="tr">
                  <td className="py-2.5 font-medium">{r.nome}</td>
                  <td className="py-2.5 t-muted capitalize">{r.recorrencia}</td>
                  <td className="py-2.5 t-muted tnum">{r.diaVencimento}</td>
                  <td className="py-2.5 text-right val-pos tnum">{r.valorPrevistoCents != null ? formatBRL(r.valorPrevistoCents) : "—"}</td>
                  <td className="py-2.5 text-right">
                    <button className="t-accent hover:underline" onClick={() => editar(r)}>editar</button>
                    <button className="ml-3 val-neg hover:underline" onClick={() => remover(r.id)}>remover</button>
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
