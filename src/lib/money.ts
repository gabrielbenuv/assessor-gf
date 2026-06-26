// Dinheiro é sempre guardado em CENTAVOS (Int) no banco.

/** Converte um valor em reais (number/string "10,50" ou "10.50") para centavos. */
export function toCents(input: number | string): number {
  if (typeof input === "number") return Math.round(input * 100);
  const normalized = input
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // remove separador de milhar
    .replace(",", ".");
  const n = parseFloat(normalized);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Centavos -> reais (number). */
export function toReais(cents: number): number {
  return cents / 100;
}

/** Formata centavos como "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
