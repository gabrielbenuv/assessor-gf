"use client";

import { useEffect, useState } from "react";

interface Prefs {
  relatorioMensalAtivo: boolean;
  diaRelatorio: number;
  horaEnvio: string;
  lembreteVencimentoAtivo: boolean;
  diasAntes: number;
  contasFixasDiasAntes: number;
  lembreteCartaoAtivo: boolean;
  resumoSemanalAtivo: boolean;
}

export default function NotificacoesPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState("");

  async function carregar() {
    const r = await fetch("/api/notificacoes");
    if (r.ok) setPrefs(await r.json());
  }
  useEffect(() => { carregar(); }, []);

  async function salvar() {
    if (!prefs) return;
    const r = await fetch("/api/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setMsg(r.ok ? "Preferências salvas." : "Erro ao salvar.");
  }

  async function testar(enviar: boolean) {
    setMsg(enviar ? "Enviando..." : "Gerando...");
    const r = await fetch(`/api/notificacoes/testar${enviar ? "?enviar=1" : ""}`, { method: "POST" });
    const data = await r.json();
    setPreview(data.texto || "");
    if (enviar) {
      setMsg(data.evolution ? `Enviado para ${data.enviadoPara} número(s).` : "Evolution não configurada — texto gerado, mas não enviado.");
    } else {
      setMsg("Pré-visualização gerada abaixo.");
    }
  }

  if (!prefs) return <p className="text-sm t-muted">Carregando…</p>;

  const Linha = ({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) => (
    <label className="flex items-center gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm">{children}</span>
    </label>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Configuração</p>
        <h1>Notificações</h1>
        <p className="text-sm t-muted">Escolha o que o assessor te envia automaticamente no WhatsApp.</p>
      </div>

      {msg && <div className="card-flat text-sm t-accent">{msg}</div>}

      <div className="card space-y-4">
        <Linha checked={prefs.relatorioMensalAtivo} onChange={(v) => setPrefs({ ...prefs, relatorioMensalAtivo: v })}>
          <strong>Relatório mensal de contas a pagar</strong> — a lista de contas fixas do mês com datas e valores.
        </Linha>
        <div className="ml-7 flex flex-wrap gap-4">
          <div>
            <label className="label">Dia do mês</label>
            <input className="input tnum w-24" type="number" min={1} max={28} value={prefs.diaRelatorio} onChange={(e) => setPrefs({ ...prefs, diaRelatorio: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Horário</label>
            <input className="input w-32" type="time" value={prefs.horaEnvio} onChange={(e) => setPrefs({ ...prefs, horaEnvio: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <Linha checked={prefs.lembreteVencimentoAtivo} onChange={(v) => setPrefs({ ...prefs, lembreteVencimentoAtivo: v })}>
          <strong>Lembrete de contas fixas e parcelas</strong> — aviso quando algo está perto de vencer (e alerta de estouro de teto).
        </Linha>
        <div className="ml-7">
          <label className="label">Padrão: avisar quantos dias antes (0 = no dia)</label>
          <input className="input tnum w-24" type="number" min={0} max={15} value={prefs.contasFixasDiasAntes} onChange={(e) => setPrefs({ ...prefs, contasFixasDiasAntes: Number(e.target.value) })} />
          <p className="mt-1 text-xs t-faint">Vale para os itens marcados como “usar padrão”. Os demais usam o valor próprio.</p>
        </div>
      </div>

      <div className="card">
        <Linha checked={prefs.lembreteCartaoAtivo} onChange={(v) => setPrefs({ ...prefs, lembreteCartaoAtivo: v })}>
          <strong>Lembrete de fatura de cartão</strong> — conforme os dias configurados em cada cartão.
        </Linha>
      </div>

      <div className="card">
        <Linha checked={prefs.resumoSemanalAtivo} onChange={(v) => setPrefs({ ...prefs, resumoSemanalAtivo: v })}>
          <strong>Resumo semanal</strong> — toda segunda-feira, o que vence na semana.
        </Linha>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={salvar}>Salvar preferências</button>
        <button className="btn-ghost" onClick={() => testar(false)}>Pré-visualizar relatório</button>
        <button className="btn-ghost" onClick={() => testar(true)}>Enviar relatório agora</button>
      </div>

      {preview && (
        <div className="card">
          <p className="mb-2 text-xs t-faint">Pré-visualização do relatório:</p>
          <pre className="whitespace-pre-wrap text-sm">{preview}</pre>
        </div>
      )}
    </div>
  );
}
