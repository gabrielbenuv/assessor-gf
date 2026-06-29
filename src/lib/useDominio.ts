"use client";

import { useEffect, useState } from "react";
import { getDominioClient, type Dominio } from "./dominios";

/** Domínio selecionado (cookie) + reatividade quando o usuário troca no topo. */
export function useDominio(): Dominio {
  const [d, setD] = useState<Dominio>("pessoal");
  useEffect(() => {
    setD(getDominioClient());
    const h = (e: Event) => setD((e as CustomEvent).detail);
    window.addEventListener("dominio:troca", h);
    return () => window.removeEventListener("dominio:troca", h);
  }, []);
  return d;
}
