"use client";

import { useState } from "react";

interface Msg {
  autor: "voce" | "assessor";
  texto: string;
}

const EXEMPLOS = [
  "Gastei 32 reais num hot dog hoje",
  "Paguei 250 no mercado no crédito do Nubank",
  "Quanto gastei essa semana?",
  "Quanto está em aberto no cartão?",
  "Qual meu saldo?",
];

export default function SimuladorPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [imagem, setImagem] = useState<string | undefined>();
  const [carregando, setCarregando] = useState(false);

  async function enviar(t?: string) {
    const conteudo = t ?? texto;
    if (!conteudo && !imagem) return;
    setMsgs((m) => [...m, { autor: "voce", texto: conteudo || "(imagem de recibo)" }]);
    setTexto("");
    setCarregando(true);
    const imgEnviar = imagem;
    setImagem(undefined);

    try {
      const r = await fetch("/api/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: conteudo, imagemBase64: imgEnviar }),
      });
      const data = await r.json();
      setMsgs((m) => [...m, { autor: "assessor", texto: data.resposta || data.error || "(sem resposta)" }]);
    } catch {
      setMsgs((m) => [...m, { autor: "assessor", texto: "Erro de conexão." }]);
    } finally {
      setCarregando(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagem(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function limpar() {
    await fetch("/api/simular", { method: "DELETE" });
    setMsgs([]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Simulador 🤖</h1>
          <p className="text-sm text-slate-500">
            Converse com o assessor como se fosse pelo WhatsApp (ele lembra da conversa). Requer a chave da OpenAI em{" "}
            <a className="text-brand-600 underline" href="/integracoes">
              Integrações
            </a>
            .
          </p>
        </div>
        <button className="btn-ghost shrink-0" onClick={limpar}>
          Limpar conversa
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXEMPLOS.map((ex) => (
          <button key={ex} className="badge bg-brand-50 text-brand-700 hover:bg-brand-100" onClick={() => enviar(ex)}>
            {ex}
          </button>
        ))}
      </div>

      <div className="card flex h-[55vh] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {msgs.length === 0 && (
            <p className="mt-10 text-center text-sm text-slate-400">
              Mande uma mensagem para começar. Ex: <em>“gastei 15 reais de uber”</em>
            </p>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.autor === "voce" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                  m.autor === "voce" ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.texto}
              </div>
            </div>
          ))}
          {carregando && <div className="text-sm text-slate-400">Assessor digitando…</div>}
        </div>

        {imagem && (
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            🖼️ recibo anexado
            <button onClick={() => setImagem(undefined)} className="text-red-500">
              remover
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="mt-3 flex items-center gap-2"
        >
          <label className="btn-ghost cursor-pointer">
            📎
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
          <input
            className="input"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva uma mensagem…"
          />
          <button className="btn-primary" disabled={carregando}>
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
