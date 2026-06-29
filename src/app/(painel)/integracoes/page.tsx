"use client";

import { useEffect, useState } from "react";

interface Status {
  status: Record<string, { preenchido: boolean; preview: string }>;
  evolution: boolean;
  googleConfigurado: boolean;
  googleConectado: boolean;
}

const CAMPOS = [
  { key: "openai_api_key", label: "OpenAI API Key", ph: "sk-...", grupo: "OpenAI" },
  { key: "openai_model", label: "Modelo (opcional)", ph: "gpt-4o", grupo: "OpenAI" },
  { key: "evolution_api_url", label: "Evolution API URL", ph: "https://evo.seudominio.com", grupo: "Evolution (WhatsApp)" },
  { key: "evolution_api_key", label: "Evolution API Key", ph: "sua-apikey", grupo: "Evolution (WhatsApp)" },
  { key: "evolution_instance", label: "Instância", ph: "assessor", grupo: "Evolution (WhatsApp)" },
  { key: "google_client_id", label: "Google Client ID", ph: "...apps.googleusercontent.com", grupo: "Google Calendar" },
  { key: "google_client_secret", label: "Google Client Secret", ph: "GOCSPX-...", grupo: "Google Calendar" },
  { key: "google_calendar_id", label: "Calendar ID (opcional)", ph: "primary", grupo: "Google Calendar" },
];

export default function IntegracoesPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [webhook, setWebhook] = useState("");

  async function carregar() {
    const r = await fetch("/api/config");
    if (r.ok) setStatus(await r.json());
  }
  useEffect(() => {
    carregar();
    setWebhook(`${window.location.origin}/api/webhook`);
    const p = new URLSearchParams(window.location.search).get("google");
    if (p === "ok") setMsg("Google Calendar conectado!");
    if (p === "erro") setMsg("Falha ao conectar o Google.");
    if (p === "falta_credencial") setMsg("Preencha e salve o Client ID/Secret antes de conectar.");
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(valores)) if (v.trim()) payload[k] = v.trim();
    const r = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok) { setMsg("Chaves salvas."); setValores({}); carregar(); }
  }

  const grupos = Array.from(new Set(CAMPOS.map((c) => c.grupo)));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Configuração</p>
        <h1>Integrações & chaves</h1>
        <p className="text-sm t-muted">As chaves ficam guardadas criptografadas no banco.</p>
      </div>

      {msg && <div className="card-flat text-sm t-accent">{msg}</div>}

      <div className="card">
        <h2 className="mb-1">Webhook do WhatsApp</h2>
        <p className="mb-2 text-sm t-muted">Configure este endereço na Evolution (evento <code>messages.upsert</code>):</p>
        <code className="block rounded-lg border border-hair bg-[var(--card-2)] px-3 py-2 text-sm">{webhook || "…"}</code>
      </div>

      <form onSubmit={salvar} className="space-y-6">
        {grupos.map((g) => (
          <div key={g} className="card space-y-3">
            <h2>{g}</h2>
            {CAMPOS.filter((c) => c.grupo === g).map((c) => {
              const st = status?.status[c.key];
              return (
                <div key={c.key}>
                  <label className="label">
                    {c.label} {st?.preenchido && <span className="val-pos">• salvo ({st.preview})</span>}
                  </label>
                  <input
                    className="input"
                    type={c.key.includes("secret") || c.key.includes("key") ? "password" : "text"}
                    placeholder={st?.preenchido ? "•••• (deixe vazio p/ manter)" : c.ph}
                    value={valores[c.key] || ""}
                    onChange={(e) => setValores({ ...valores, [c.key]: e.target.value })}
                  />
                </div>
              );
            })}

            {g === "Google Calendar" && (
              <div className="flex items-center gap-3 pt-1">
                <a href="/api/google/connect" className="btn-ghost">
                  {status?.googleConectado ? "Reconectar Google" : "Conectar Google Calendar"}
                </a>
                <span className={`text-sm ${status?.googleConectado ? "val-pos" : "t-muted"}`}>
                  {status?.googleConectado ? "conectado" : "não conectado"}
                </span>
              </div>
            )}
          </div>
        ))}

        <button className="btn-primary">Salvar chaves</button>
      </form>
    </div>
  );
}
