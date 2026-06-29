"use client";

import { useCallback, useEffect, useState } from "react";
import { useDominio } from "@/lib/useDominio";
import { Icon } from "@/components/Icon";

export default function PerfilPage() {
  const dominio = useDominio();
  const [form, setForm] = useState({
    rendaBase: "",
    reservaMeta: "",
    reservaAtual: "",
    perfilRisco: "moderado",
    percentualInvestir: "20",
  });
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const p = await fetch(`/api/perfil?dominio=${dominio}`).then((r) => r.json());
    setForm({
      rendaBase: p.rendaBaseCents ? String(p.rendaBaseCents / 100) : "",
      reservaMeta: p.reservaMetaCents ? String(p.reservaMetaCents / 100) : "",
      reservaAtual: p.reservaAtualCents ? String(p.reservaAtualCents / 100) : "",
      perfilRisco: p.perfilRisco || "moderado",
      percentualInvestir: String(p.percentualInvestir ?? 20),
    });
  }, [dominio]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setSalvo(false);
    const r = await fetch("/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, dominio }),
    });
    setSalvando(false);
    if (r.ok) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    }
  }

  const metaPct =
    Number(form.reservaMeta) > 0 ? Math.min(100, Math.round((Number(form.reservaAtual) / Number(form.reservaMeta)) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Cadastros</p>
        <h1>Perfil financeiro</h1>
        <p className="text-sm t-muted">A base que o Assessor usa pra te orientar como um CFO — renda, reserva e apetite a risco.</p>
      </div>

      <form onSubmit={salvar} className="card grid max-w-2xl gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Renda base mensal (R$)</label>
          <input className="input tnum" type="number" step="0.01" value={form.rendaBase} onChange={(e) => setForm({ ...form, rendaBase: e.target.value })} placeholder="0,00" />
        </div>
        <div>
          <label className="label">Meta de reserva (R$)</label>
          <input className="input tnum" type="number" step="0.01" value={form.reservaMeta} onChange={(e) => setForm({ ...form, reservaMeta: e.target.value })} placeholder="0,00" />
        </div>
        <div>
          <label className="label">Reserva atual (R$)</label>
          <input className="input tnum" type="number" step="0.01" value={form.reservaAtual} onChange={(e) => setForm({ ...form, reservaAtual: e.target.value })} placeholder="0,00" />
        </div>
        {Number(form.reservaMeta) > 0 && (
          <div className="md:col-span-2">
            <div className="mb-1 flex justify-between text-xs t-muted"><span>Progresso da reserva</span><span className="tnum">{metaPct}%</span></div>
            <div className="track"><span style={{ width: `${metaPct}%` }} /></div>
          </div>
        )}
        <div>
          <label className="label">Perfil de risco</label>
          <select className="input" value={form.perfilRisco} onChange={(e) => setForm({ ...form, perfilRisco: e.target.value })}>
            <option value="conservador">Conservador</option>
            <option value="moderado">Moderado</option>
            <option value="arrojado">Arrojado</option>
          </select>
        </div>
        <div>
          <label className="label">% de cada entrada a guardar</label>
          <input className="input tnum" type="number" value={form.percentualInvestir} onChange={(e) => setForm({ ...form, percentualInvestir: e.target.value })} placeholder="20" />
        </div>
        <div className="md:col-span-2 flex items-center gap-3">
          <button className="btn-primary" disabled={salvando}>
            <Icon name="check" className="h-4 w-4" /> {salvando ? "Salvando…" : "Salvar perfil"}
          </button>
          {salvo && <span className="pill pill-pos">Salvo</span>}
        </div>
      </form>
    </div>
  );
}
