"use client";

import { useCallback, useEffect, useState } from "react";
import { useDominio } from "@/lib/useDominio";
import { Icon } from "@/components/Icon";
import Modal from "@/components/Modal";

interface FaturaItem { mes: string; cents: number; formatado: string; vencimento: string | null }
interface CartaoFat { cartao: string; totalCents: number; totalFormatado: string; faturas: FaturaItem[] }
interface Opt { id: string; nome: string }

export default function FaturasPage() {
  const dominio = useDominio();
  const [cartoes, setCartoes] = useState<CartaoFat[]>([]);
  const [total, setTotal] = useState("");
  const [bancos, setBancos] = useState<Opt[]>([]);
  const [pag, setPag] = useState<{ cartao: string; fatura: FaturaItem } | null>(null);
  const [pagBanco, setPagBanco] = useState("");
  const [pagValor, setPagValor] = useState("");

  const carregar = useCallback(async () => {
    const [f, b] = await Promise.all([
      fetch(`/api/faturas?dominio=${dominio}`).then((r) => r.json()),
      fetch(`/api/bancos?dominio=${dominio}`).then((r) => r.json()),
    ]);
    setCartoes((f.cartoes || []).filter((c: CartaoFat) => c.faturas.length > 0));
    setTotal(f.totalFormatado || "R$ 0,00");
    setBancos(b);
  }, [dominio]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirPagamento(cartao: string, fatura: FaturaItem) {
    setPag({ cartao, fatura });
    setPagBanco("");
    setPagValor((fatura.cents / 100).toFixed(2));
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!pag) return;
    const r = await fetch("/api/faturas/pagar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartao: pag.cartao, mes: pag.fatura.mes, valor: pagValor, bancoId: pagBanco || undefined, dominio }),
    });
    if (r.ok) {
      setPag(null);
      carregar();
    } else {
      alert((await r.json().catch(() => ({}))).error || "Erro ao pagar fatura.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Painel</p>
          <h1>Faturas</h1>
          <p className="text-sm t-muted">Pagar a fatura quita o ciclo inteiro (parcelas + compras no crédito).</p>
        </div>
        <div className="text-right">
          <p className="kpi-label">Total em aberto</p>
          <p className="text-xl font-bold val-neg tnum">{total}</p>
        </div>
      </div>

      {cartoes.length === 0 ? (
        <div className="card text-sm t-muted">Nenhuma fatura em aberto.</div>
      ) : (
        cartoes.map((c) => (
          <div key={c.cartao} className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2>{c.cartao}</h2>
              <span className="val-neg font-semibold tnum">{c.totalFormatado}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th pb-2">Competência</th>
                  <th className="th pb-2">Vencimento</th>
                  <th className="th pb-2 text-right">Total</th>
                  <th className="th pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {c.faturas.map((f) => (
                  <tr key={f.mes} className="tr">
                    <td className="py-2.5 tnum">{f.mes}</td>
                    <td className="py-2.5 t-muted tnum">{f.vencimento || "—"}</td>
                    <td className="py-2.5 text-right font-medium tnum">{f.formatado}</td>
                    <td className="py-2.5 text-right">
                      <button className="btn-primary btn-sm" onClick={() => abrirPagamento(c.cartao, f)}>
                        <Icon name="check" className="h-4 w-4" /> Pagar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      <Modal open={!!pag} onClose={() => setPag(null)} title={`Pagar fatura — ${pag?.cartao || ""}`}>
        <form onSubmit={confirmar} className="space-y-3">
          <p className="text-sm t-muted">Competência {pag?.fatura.mes} · vence {pag?.fatura.vencimento || "—"}.</p>
          <div>
            <label className="label">Valor pago (R$)</label>
            <input className="input tnum" type="number" step="0.01" value={pagValor} onChange={(e) => setPagValor(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Conta de pagamento</label>
            <select className="input" value={pagBanco} onChange={(e) => setPagBanco(e.target.value)}>
              <option value="">Usar conta do cartão</option>
              {bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" type="submit">Confirmar pagamento</button>
            <button className="btn-ghost" type="button" onClick={() => setPag(null)}>Cancelar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
