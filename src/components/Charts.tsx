import { formatBRL } from "@/lib/money";

type Mov = { label: string; entradasCents: number; saidasCents: number; sobraCents: number };
type Prev = { label: string; saldoFimCents: number };

/** Movimentação: barras lado a lado (entrou/saiu) + tabela-resumo de 3 linhas. */
export function BarsMovimento({ data }: { data: Mov[] }) {
  if (!data.length) return <p className="text-sm t-muted">Sem dados ainda.</p>;
  const max = Math.max(1, ...data.flatMap((d) => [d.entradasCents, d.saidasCents]));
  const step = 60;
  const H = 120;
  const W = data.length * step;
  const barH = (v: number) => (v / max) * (H - 12);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none">
        {data.map((d, i) => {
          const x = i * step + step / 2;
          const he = barH(d.entradasCents);
          const hs = barH(d.saidasCents);
          return (
            <g key={d.label}>
              <rect x={x - 20} y={H - he} width="16" height={he} rx="3" fill="var(--pos)" />
              <rect x={x + 4} y={H - hs} width="16" height={hs} rx="3" fill="var(--neg)" />
            </g>
          );
        })}
      </svg>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs tnum">
          <thead>
            <tr className="t-faint">
              <th className="th pb-1 pr-2"></th>
              {data.map((d) => (
                <th key={d.label} className="th pb-1 text-right capitalize">{d.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-0.5 pr-2 val-pos">Entrou</td>
              {data.map((d) => (
                <td key={d.label} className="py-0.5 text-right val-pos">{formatBRL(d.entradasCents)}</td>
              ))}
            </tr>
            <tr>
              <td className="py-0.5 pr-2 val-neg">Saiu</td>
              {data.map((d) => (
                <td key={d.label} className="py-0.5 text-right val-neg">{formatBRL(d.saidasCents)}</td>
              ))}
            </tr>
            <tr className="tr">
              <td className="py-0.5 pr-2 font-medium">Sobrou</td>
              {data.map((d) => (
                <td key={d.label} className={`py-0.5 text-right font-medium ${d.sobraCents < 0 ? "val-neg" : ""}`}>
                  {formatBRL(d.sobraCents)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Previsão: área/linha do saldo projetado mês a mês. */
export function AreaPrevisao({ data }: { data: Prev[] }) {
  if (data.length < 2) return <p className="text-sm t-muted">Sem dados suficientes para projeção.</p>;
  const W = 320;
  const H = 120;
  const pad = 8;
  const vals = data.map((d) => d.saldoFimCents);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 1);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (data.length - 1);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.saldoFimCents).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  const zeroY = y(0);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none">
        {min < 0 && <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 3" />}
        <path d={area} fill="var(--accent-soft)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.saldoFimCents)} r="2.5" fill="var(--accent)" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[11px] t-faint">
        {data.map((d) => (
          <span key={d.label} className="capitalize">{d.label.slice(0, 5)}</span>
        ))}
      </div>
    </div>
  );
}
