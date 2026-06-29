"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";
import { useDominio } from "@/lib/useDominio";

interface ContaFixa {
  id: string;
  nome: string;
  tipo: string;
  valorPrevistoCents: number | null;
  diaVencimento: number;
  usaPadrao: boolean;
  lembreteDiasAntes: number | null;
  categoria?: { nome: string } | null;
  banco?: { nome: string } | null;
  categoriaId: string | null;
  bancoId: string | null;
}
interface Opt { id: string; nome: string; tipo?: string }

const vazio = {
  id: "", nome: "", tipo: "conta_fixa", valorPrevisto: "", diaVencimento: "",
  categoriaId: "", bancoId: "", usaPadrao: true, lembreteDiasAntes: "",
};

export default function ContasFixasPage() {
  const dominio = useDominio();
  const [lista, setLista] = useState<ContaFixa[]>([]);
  const [cats, setCats] = useState<Opt[]>([]);
  const [bancos, setBancos] = useState<Opt[]>([]);
  const [form, setForm] = useState({ ...vazio });
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const [r, rc, rb] = await Promise.all([
      fetch(`/api/contas-fixas?dominio=${dominio}`),
      fetch(`/api/categorias?dominio=${dominio}`),
      fetch(`/api/bancos?dominio=${dominio}`),
    ]);
    if (r.ok) setLista((await r.json()).filter((c: ContaFixa) => c.tipo !== "recebimento"));
    if (rc.ok) setCats((await rc.json()).filter((c: Opt) => c.tipo === "gasto"));
    if (rb.ok) setBancos(await rb.json());
  }, [dominio]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const payload = {
      nome: form.nome, tipo: form.tipo, valorPrevisto: form.valorPrevisto || null,
      diaVencimento: form.diaVencimento, categoriaId: form.categoriaId || null, bancoId: form.bancoId || null,
      usaPadrao: form.usaPadrao, lembreteDiasAntes: form.usaPadrao ? null : form.lembreteDiasAntes || null, dominio,
    };
    const r = await fetch(form.id ? `/api/contas-fixas/${form.id}` : "/api/contas-fixas", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok) { setForm({ ...vazio }); carregar(); }
    else setErro((await r.json().catch(() => ({}))).error || "Erro ao salvar.");
  }

  async function remover(id: string) {
    if (!confirm("Remover este compromisso?")) return;
    await fetch(`/api/contas-fixas/${id}`, { method: "DELETE" });
    carregar();
  }

  function editar(c: ContaFixa) {
    setForm({
      id: c.id, nome: c.nome, tipo: c.tipo || "conta_fixa",
      valorPrevisto: c.valorPrevistoCents ? String(c.valorPrevistoCents / 100) : "",
      diaVencimento: String(c.diaVencimento), categoriaId: c.categoriaId || "", bancoId: c.bancoId || "",
      usaPadrao: c.usaPadrao, lembreteDiasAntes: c.lembreteDiasAntes != null ? String(c.lembreteDiasAntes) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Painel</p>
        <h1>Contas fixas & assinaturas</h1>
        <p className="text-sm t-muted">Recorrentes (aluguel, luz, internet, Netflix...). No dia 1º você recebe o relatório do mês.</p>
      </div>

      <form onSubmit={salvar} className="card grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="label">Nome</label>
          <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Aluguel, Netflix" required />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="conta_fixa">Conta fixa</option>
            <option value="assinatura">Assinatura</option>
          </select>
        </div>
        <div>
          <label className="label">Valor previsto (R$)</label>
          <input className="input tnum" type="number" step="0.01" value={form.valorPrevisto} onChange={(e) => setForm({ ...form, valorPrevisto: e.target.value })} placeholder="opcional" />
        </div>
        <div>
          <label className="label">Dia vencimento</label>
          <input className="input tnum" type="number" min={1} max={31} value={form.diaVencimento} onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })} required />
        </div>
        <div>
          <label className="label">Categoria</label>
          <select className="input" value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>
            <option value="">automática</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="label">Pagar de qual conta (opcional)</label>
          <select className="input" value={form.bancoId} onChange={(e) => setForm({ ...form, bancoId: e.target.value })}>
            <option value="">— nenhuma —</option>
            {bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
        </div>
        <div className="md:col-span-3 grid gap-3 rounded-xl border border-hair bg-[var(--card-2)] p-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.usaPadrao} onChange={(e) => setForm({ ...form, usaPadrao: e.target.checked })} />
            Usar o lembrete padrão (definido em Notificações)
          </label>
          {!form.usaPadrao && (
            <div>
              <label className="label">Avisar dias antes (só deste)</label>
              <input className="input tnum" type="number" min={0} max={20} value={form.lembreteDiasAntes} onChange={(e) => setForm({ ...form, lembreteDiasAntes: e.target.value })} placeholder="ex: 2" />
            </div>
          )}
        </div>
        {erro && <p className="md:col-span-6 text-sm val-neg">{erro}</p>}
        <div className="md:col-span-6 flex gap-2">
          <button className="btn-primary">{form.id ? "Salvar alterações" : "Adicionar"}</button>
          {form.id && <button type="button" className="btn-ghost" onClick={() => setForm({ ...vazio })}>Cancelar</button>}
        </div>
      </form>

      <div className="card">
        {lista.length === 0 ? (
          <p className="text-sm t-muted">Nenhum compromisso cadastrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th pb-2">Nome</th>
                <th className="th pb-2">Tipo</th>
                <th className="th pb-2">Vence dia</th>
                <th className="th pb-2 text-right">Previsto</th>
                <th className="th pb-2">Categoria</th>
                <th className="th pb-2">Lembrete</th>
                <th className="th pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="tr">
                  <td className="py-2.5 font-medium">{c.nome}</td>
                  <td className="py-2.5">
                    <span className={`pill ${c.tipo === "assinatura" ? "pill-accent" : "pill-muted"}`}>
                      {c.tipo === "assinatura" ? "Assinatura" : "Conta fixa"}
                    </span>
                  </td>
                  <td className="py-2.5 tnum">dia {c.diaVencimento}</td>
                  <td className="py-2.5 text-right t-muted tnum">{c.valorPrevistoCents ? formatBRL(c.valorPrevistoCents) : "—"}</td>
                  <td className="py-2.5 t-muted">{c.categoria?.nome || "—"}</td>
                  <td className="py-2.5 t-muted">{c.usaPadrao ? "padrão" : `${c.lembreteDiasAntes ?? "?"}d antes`}</td>
                  <td className="py-2.5 text-right">
                    <button className="t-accent hover:underline" onClick={() => editar(c)}>editar</button>
                    <button className="ml-3 val-neg hover:underline" onClick={() => remover(c.id)}>remover</button>
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
