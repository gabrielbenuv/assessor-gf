// Domínios — helpers seguros p/ cliente e servidor (sem Prisma).
export const DOMINIOS = ["pessoal", "chess", "klivy"] as const;
export type Dominio = (typeof DOMINIOS)[number];

export const DOMINIO_LABELS: Record<string, string> = {
  pessoal: "Pessoal",
  chess: "Chess",
  klivy: "Klivy",
};

export const DOMINIO_COOKIE = "dominio";

export function normDominio(d?: string | null): Dominio {
  return d && (DOMINIOS as readonly string[]).includes(d) ? (d as Dominio) : "pessoal";
}

export function getDominioClient(): Dominio {
  if (typeof document === "undefined") return "pessoal";
  const m = document.cookie.match(/(?:^|; )dominio=([^;]+)/);
  return normDominio(m?.[1]);
}

export function setDominioClient(d: Dominio) {
  document.cookie = `${DOMINIO_COOKIE}=${d}; path=/; max-age=31536000`;
}
