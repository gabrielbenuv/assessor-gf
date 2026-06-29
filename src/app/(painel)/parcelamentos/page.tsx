"use client";

import { useCallback, useEffect, useState } from "react";
import { useDominio } from "@/lib/useDominio";
import { Icon } from "@/components/Icon";
import Modal from "@/components/Modal";

interface Parc {
  id: string;
  descricao: string;
  forma: string;
  cartao: string | null;
  banco: string | null;
  categoria: string | null;
  valorParcelaFormatado: string;
  numParcelas: number;
  pagas: number;
  restantes: number;
  totalFormatado: string;
  restanteFormatado: string;
  progresso: number;
  proxima: { numero: number; vencimento: string } | null;
  quitado: boolean;
}
interface Opt { id: string; nome?: string; apelido?: string }

export default function ParcelamentosPage() {
  const dominio = useDominio();
  const [lista, setLista] = useState<Parc[]>([]);
  const [bancos, setBancos] = useState<Opt[]>([]);
  const [cartoes, setCartoes] = useState<Opt[]>([]);
  const [categorias, setCategorias] = useState<Opt[]>([]);
  const [form, setForm] = useState({
    descricao: "",
    valorParcela: "",
    numParcelas: "",
    forma: "avulso",
    cartaoId: "",
    bancoId: "",
    categoriaId: "",
    dataPrimeira: "",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [baixa, setBaixa] = useState<Parc | null>(null);
  const [baixaBanco, setBaixaBanco] = useState("");

  const carregar = useCallback(async () => {
    const [p, b, c, cat] = await Promise.all([
      fetch(`/api/parcelamentos?dominio=${dominio}`).then((r) => r.json()),
      fetch(`/api/bancos?dominio=${dominio}`).then((r) => r.json()),
      fetch(`/api/cartoes?dominio=${dominio}`).then((r) => r.json()),
      fetch(`/api/categorias?dominio=${dominio}`).then((r) => r.json()),
    ]);
    setLista(p);
    setBancos(b);
    setCartoes(c);
    setCategorias((cat as any[]).filter((x) => x.tipo === "gasto"));
  }, [dominio]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    const r = await fetch("/api/parcelamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, dominio }),
    });
    setSalvando(false);
    if (r.ok) {
      setForm({ descricao: "", valorParcela: "", numParcelas: "", forma: "avulso", cartaoId: "", bancoId: "", categoriaId: "", dataPrimeira: "" });
      carregar();
    } else {
      setErro((await r.json().catch(() => ({}))).error || "Erro ao salvar.");
    }
  }

  async function confirmarBaixa(e: React.FormEvent) {
    e.preventDefault();
    if (!baixa) return;
    const r = await fetch("/api/parcelamentos/baixa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcelamentoId: baixa.id, bancoId: baixaBanco || undefined, formaPagamento: "pix", dominio }),
    });
    if (r.ok) {
      setBaixa(null);
      setBaixaBanco("");
      carregar();
    } else {
      alert((await r.json().catch(() => ({}))).error || "Erro ao dar baixa.");
    }
  }

  async function remover(id: string) {
    if (!confirm("Remover este parcelamento e suas parcelas?")) return;
    await fetch(`/api/parcelamentos/${id}`, { method: "DELETE" });
    carregar();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Painel</p>
        <h1>Parcelamentos</h1>
        <p className="text-sm t-muted">Compras divididas em parcelas. O valor de cada parcela é imutável; o status nasce das baixas.</p>
      </div>

      <form onSubmit={salvar} className="card grid gap-3 md:grid-cols-12">
        <div className="md:col-span-4">
          <label className="label">Descrição</label>
          <input className="input" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Colchão" required />
        </div>
        <div className="md:col-span-2">
          <label className="label">Valor da parcela</label>
          <input className="input tnum" type="number" step="0.01" value={form.valorParcela} onChange={(e) => setForm({ ...form, valorParcela: e.target.value })} placeholder="500,00" required />
        </div>
        <div className="md:col-span-2">
          <label className="label">Nº de parcelas</label>
          <input className="input tnum" type="number" value={form.numParcelas} onChange={(e) => setForm({ ...form, numParcelas: e.target.value })} placeholder="30" required />
        </div>
        <div className="md:col-span-2">
          <label className="label">Forma</label>
          <select className="input" value={form.forma} onChange={(e) => setForm({ ...form, forma: e.target.value })}>
            <option value="avulso">Avulso (pix/boleto)</option>
            <option value="cartao">Cartão</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">1ª parcela</label>
          <input className="input" type="date" value={form.dataPrimeira} onChange={(e) => setForm({ ...form, dataPrimeira: e.target.value })} />
        </div>
        {form.forma === "cartao" ? (
          <div className="md:col-span-4">
            <label className="label">Cartão</label>
            <select className="input" value={form.cartaoId} onChange={(e) => setForm({ ...form, cartaoId: e.target.value })}>
              <option value="">Selecione…</option>
              {cartoes.map((c) => <option key={c.id} value={c.id}>{c.apelido}</option>)}
            </select>
          </div>
        ) : (
          <div className="md:col-span-4">
            <label className="label">Conta (sugerida)</label>
            <select className="input" value={form.bancoId} onChange={(e) => setForm({ ...form, bancoId: e.target.value })}>
              <option value="">—</option>
              {bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
        )}
        <div className="md:col-span-4">
          <label className="label">Categoria</label>
          <select className="input" value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>
            <option value="">Automática</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        {erro && <p className="md:col-span-12 text-sm val-neg">{erro}</p>}
        <div className="md:col-span-12">
          <button className="btn-primary" disabled={salvando}>
            <Icon name="plus" className="h-4 w-4" /> {salvando ? "Criando…" : "Criar parcelamento"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {lista.length === 0 ? (
          <div className="card text-sm t-muted">Nenhum parcelamento ainda.</div>
        ) : (
          lista.map((p) => (
            <div key={p.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.descricao}</span>
                    <span className="pill pill-muted">{p.forma === "cartao" ? `Cartão · ${p.cartao || "?"}` : "Avulso"}</span>
                    {p.quitado && <span className="pill pill-pos">Quitado</span>}
                  </div>
                  <p className="mt-0.5 text-xs t-muted tnum">
                    {p.valorParcelaFormatado} × {p.numParcelas} = {p.totalFormatado}
                    {p.categoria ? ` · ${p.categoria}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!p.quitado && p.forma === "avulso" && (
                    <button className="btn-ghost btn-sm" onClick={() => { setBaixa(p); setBaixaBanco(""); }}>
                      <Icon name="check" className="h-4 w-4" /> Dar baixa
                    </button>
                  )}
                  <button className="btn-danger btn-sm" onClick={() => remover(p.id)} aria-label="Remover">
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="track flex-1">
                  <span style={{ width: `${p.progresso}%` }} />
                </div>
                <span className="shrink-0 text-xs t-muted tnum">
                  {p.proxima ? `parcela ${p.proxima.numero} de ${p.numParcelas}` : `${p.numParcelas} de ${p.numParcelas}`}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs t-faint tnum">
                <span>{p.pagas} pagas · {p.restantes} restantes</span>
                <span>{p.proxima ? `próx. vence ${p.proxima.vencimento}` : "—"} · falta {p.restanteFormatado}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={!!baixa} onClose={() => setBaixa(null)} title={`Dar baixa — ${baixa?.descricao || ""}`}>
        <form onSubmit={confirmarBaixa} className="space-y-3">
          <p className="text-sm t-muted">
            Parcela {baixa?.proxima?.numero} de {baixa?.numParcelas} · {baixa?.valorParcelaFormatado}. De qual conta saiu?
          </p>
          <div>
            <label className="label">Conta</label>
            <select className="input" value={baixaBanco} onChange={(e) => setBaixaBanco(e.target.value)} autoFocus>
              <option value="">Não especificar</option>
              {bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" type="submit">Confirmar baixa</button>
            <button className="btn-ghost" type="button" onClick={() => setBaixa(null)}>Cancelar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
