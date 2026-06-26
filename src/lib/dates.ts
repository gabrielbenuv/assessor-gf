import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  addMonths,
  setDate,
  getDate,
  format,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export const TZ = process.env.TZ || "America/Sao_Paulo";

/** Agora, como "relógio de parede" em SP (Date cujos campos UTC = horário local SP). */
export function nowZoned(): Date {
  return toZonedTime(new Date(), TZ);
}

/** Converte um relógio-de-parede SP de volta para o instante UTC real. */
function toUtc(zoned: Date): Date {
  return fromZonedTime(zoned, TZ);
}

export interface Periodo {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Resolve um período em linguagem simples para um intervalo [start, end] em UTC.
 * Aceita: hoje, ontem, semana, semana_passada, mes, mes_passado, ano, 7dias, 30dias, ou "YYYY-MM".
 */
export function resolvePeriodo(periodo?: string | null): Periodo {
  const p = (periodo || "mes").toLowerCase().trim();
  const z = nowZoned();

  // mês explícito "YYYY-MM"
  const m = p.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const ref = new Date(Number(m[1]), Number(m[2]) - 1, 1, 12, 0, 0);
    return {
      start: toUtc(startOfMonth(ref)),
      end: toUtc(endOfMonth(ref)),
      label: format(ref, "MM/yyyy"),
    };
  }

  switch (p) {
    case "hoje":
      return { start: toUtc(startOfDay(z)), end: toUtc(endOfDay(z)), label: "hoje" };
    case "ontem": {
      const y = subDays(z, 1);
      return { start: toUtc(startOfDay(y)), end: toUtc(endOfDay(y)), label: "ontem" };
    }
    case "semana":
    case "essa_semana":
      return {
        start: toUtc(startOfWeek(z, { weekStartsOn: 1 })),
        end: toUtc(endOfWeek(z, { weekStartsOn: 1 })),
        label: "esta semana",
      };
    case "semana_passada": {
      const w = subWeeks(z, 1);
      return {
        start: toUtc(startOfWeek(w, { weekStartsOn: 1 })),
        end: toUtc(endOfWeek(w, { weekStartsOn: 1 })),
        label: "semana passada",
      };
    }
    case "7dias":
    case "ultimos7":
      return { start: toUtc(startOfDay(subDays(z, 6))), end: toUtc(endOfDay(z)), label: "últimos 7 dias" };
    case "30dias":
    case "ultimos30":
      return { start: toUtc(startOfDay(subDays(z, 29))), end: toUtc(endOfDay(z)), label: "últimos 30 dias" };
    case "mes_passado": {
      const mp = subMonths(z, 1);
      return { start: toUtc(startOfMonth(mp)), end: toUtc(endOfMonth(mp)), label: "mês passado" };
    }
    case "ano":
      return { start: toUtc(startOfYear(z)), end: toUtc(endOfYear(z)), label: "este ano" };
    case "mes":
    case "este_mes":
    default:
      return { start: toUtc(startOfMonth(z)), end: toUtc(endOfMonth(z)), label: "este mês" };
  }
}

/**
 * Dado a data da compra e os dias de fechamento/vencimento do cartão,
 * calcula em qual fatura cai (competência = mês do vencimento) e a data de vencimento.
 */
export function calcularFatura(
  dataCompra: Date,
  diaFechamento: number,
  diaVencimento: number
): { mesReferencia: string; vencimento: Date } {
  const z = toZonedTime(dataCompra, TZ);
  const dia = getDate(z);

  // Mês em que a fatura FECHA
  let fechamento = setDate(z, Math.min(diaFechamento, 28));
  if (dia > diaFechamento) {
    fechamento = addMonths(fechamento, 1);
  }

  // Vencimento: se cai depois do fechamento, é no mesmo mês; senão no mês seguinte
  let vencBase = fechamento;
  if (diaVencimento <= diaFechamento) {
    vencBase = addMonths(fechamento, 1);
  }
  const vencZoned = setDate(vencBase, Math.min(diaVencimento, 28));
  const vencNoon = new Date(
    vencZoned.getFullYear(),
    vencZoned.getMonth(),
    vencZoned.getDate(),
    12,
    0,
    0
  );

  return {
    mesReferencia: format(vencNoon, "yyyy-MM"),
    vencimento: toUtc(vencNoon),
  };
}

/** Formata um instante UTC como data/hora legível em SP. */
export function formatBR(date: Date, fmt = "dd/MM/yyyy HH:mm"): string {
  return format(toZonedTime(date, TZ), fmt);
}

/** Data ISO atual (em SP) para dar contexto à IA. */
export function contextoDataHora(): string {
  return format(nowZoned(), "EEEE, dd/MM/yyyy HH:mm");
}
