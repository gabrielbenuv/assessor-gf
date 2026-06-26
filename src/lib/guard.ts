import { NextResponse } from "next/server";
import { getSession } from "./auth";

/** Retorna uma resposta 401 se não autenticado, ou null se ok. */
export function guard(): NextResponse | null {
  if (!getSession()) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return null;
}
