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
  useEffect(() => {
    carregar();
  }, []);

  async function salvar() {
    if (!prefs) return;
    const r = await fetch("/api/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setMsg(r.ok ? "✅ Preferências salvas." : "Erro ao salvar.");
  }

  async function testar(enviar: boolean) {
    setMsg(enviar ? "Enviando..." : "Gerando...");
    const r = await fetch(`/api/notificacoes/testar${enviar ? "?enviar=1" : ""}`, { method: "POST" });
    const data = await r.json();
    setPreview(data.texto || "");
    if (enviar) {
      setMsg(
        data.evolution
          ? `✅ Enviado para ${data.enviadoPara} número(s).`
          : "⚠️ Evolution não configurada — texto gerado, mas não enviado no WhatsApp."
      );
    } else {
      setMsg("Pré-visualização gerada abaixo.");
    }
  }

  if (!prefs) return <p className="text-sm text-slate-400">Carregando…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notificações 🔔</h1>
        <p className="text-sm text-slate-400">Escolha o que o assessor te envia automaticamente no WhatsApp.</p>
      </div>

      {msg && <div className="card bg-brand-500/10 text-sm text-brand-400">{msg}</div>}

      <div className="card space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={prefs.relatorioMensalAtivo}
            onChange={(e) => setPrefs({ ...prefs, relatorioMensalAtivo: e.target.checked })}
          />
          <span className="text-sm">
            <strong>Relatório mensal de contas a pagar</strong> — recebo a lista de contas fixas do mês com datas e valores.
          </span>
        </label>
        <div className="ml-7 flex flex-wrap gap-4">
          <div>
            <label className="label">Dia do mês</label>
            <input
              className="input w-24"
              type="number"
              min={1}
              max={28}
              value={prefs.diaRelatorio}
              onChange={(e) => setPrefs({ ...prefs, diaRelatorio: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Horário</label>
            <input
              className="input w-32"
              type="time"
              value={prefs.horaEnvio}
              onChange={(e) => setPrefs({ ...prefs, horaEnvio: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={prefs.lembreteVencimentoAtivo}
            onChange={(e) => setPrefs({ ...prefs, lembreteVencimentoAtivo: e.target.checked })}
          />
          <span className="text-sm">
            <strong>Lembrete de contas fixas</strong> — aviso quando uma conta fixa está perto de vencer (se ainda não paga).
          </span>
        </label>
        <div className="ml-7">
          <label className="label">Padrão: avisar quantos dias antes (0 = no dia)</label>
          <input
            className="input w-24"
            type="number"
            min={0}
            max={15}
            value={prefs.contasFixasDiasAntes}
            onChange={(e) => setPrefs({ ...prefs, contasFixasDiasAntes: Number(e.target.value) })}
          />
          <p className="mt-1 text-xs text-slate-400">
            Vale para as contas fixas marcadas como “usar padrão”. As demais usam o valor próprio.
          </p>
        </div>
      </div>

      <div className="card space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={prefs.lembreteCartaoAtivo}
            onChange={(e) => setPrefs({ ...prefs, lembreteCartaoAtivo: e.target.checked })}
          />
          <span className="text-sm">
            <strong>Lembrete de fatura de cartão</strong> — aviso da fatura conforme os dias configurados em cada cartão.
          </span>
        </label>
      </div>

      <div className="card space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={prefs.resumoSemanalAtivo}
            onChange={(e) => setPrefs({ ...prefs, resumoSemanalAtivo: e.target.checked })}
          />
          <span className="text-sm">
            <strong>Resumo semanal</strong> — toda segunda-feira, o que vence na semana.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={salvar}>
          Salvar preferências
        </button>
        <button className="btn-ghost" onClick={() => testar(false)}>
          Pré-visualizar relatório
        </button>
        <button className="btn-ghost" onClick={() => testar(true)}>
          Enviar relatório agora
        </button>
      </div>

      {preview && (
        <div className="card">
          <p className="mb-2 text-xs text-slate-400">Pré-visualização do relatório:</p>
          <pre className="whitespace-pre-wrap text-sm">{preview}</pre>
        </div>
      )}
    </div>
  );
}
