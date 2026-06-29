"use client";

import { useState } from "react";
import { useDominio } from "@/lib/useDominio";
import { Icon } from "@/components/Icon";

interface Msg {
  autor: "voce" | "assessor";
  texto: string;
  planilha?: boolean;
}

const EXEMPLOS = [
  "Gastei 32 reais num hot dog hoje",
  "Parcelei o colchão em 30x de 500 no pix",
  "Paguei a parcela do colchão",
  "Quanto gastei essa semana?",
  "Quanto está em aberto no cartão?",
  "Exporta a planilha",
];

export default function SimuladorPage() {
  const dominio = useDominio();
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
      setMsgs((m) => [...m, { autor: "assessor", texto: data.resposta || data.error || "(sem resposta)", planilha: data.planilha }]);
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
          <p className="eyebrow">Configuração</p>
          <h1>Simulador</h1>
          <p className="text-sm t-muted">
            Converse com o assessor como no WhatsApp (ele lembra da conversa). Requer a chave da OpenAI em{" "}
            <a className="t-accent underline" href="/integracoes">Integrações</a>.
          </p>
        </div>
        <button className="btn-ghost shrink-0" onClick={limpar}>Limpar conversa</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXEMPLOS.map((ex) => (
          <button key={ex} className="pill pill-accent hover:opacity-80" onClick={() => enviar(ex)}>{ex}</button>
        ))}
      </div>

      <div className="card flex h-[55vh] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {msgs.length === 0 && (
            <p className="mt-10 text-center text-sm t-muted">
              Mande uma mensagem para começar. Ex: <em>“gastei 15 reais de uber”</em>
            </p>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.autor === "voce" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                  m.autor === "voce" ? "bg-accent text-white" : "bg-[var(--card-2)] text-fg"
                }`}
              >
                {m.texto}
                {m.planilha && (
                  <a href={`/api/planilha?dominio=${dominio}`} className="mt-2 flex items-center gap-1.5 text-xs underline">
                    <Icon name="download" className="h-3.5 w-3.5" /> baixar planilha (.xlsx)
                  </a>
                )}
              </div>
            </div>
          ))}
          {carregando && <div className="text-sm t-muted">Assessor digitando…</div>}
        </div>

        {imagem && (
          <div className="mb-2 flex items-center gap-2 text-xs t-muted">
            recibo anexado
            <button onClick={() => setImagem(undefined)} className="val-neg">remover</button>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="mt-3 flex items-center gap-2">
          <label className="btn-ghost cursor-pointer px-3" title="Anexar recibo">
            <Icon name="plus" className="h-4 w-4" />
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
          <input className="input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva uma mensagem…" />
          <button className="btn-primary" disabled={carregando}>Enviar</button>
        </form>
      </div>
    </div>
  );
}
