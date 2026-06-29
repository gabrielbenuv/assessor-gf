"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DOMINIOS, DOMINIO_LABELS, getDominioClient, setDominioClient, type Dominio } from "@/lib/dominios";

export default function DominioSwitcher() {
  const router = useRouter();
  const [dom, setDom] = useState<Dominio>("pessoal");

  useEffect(() => {
    setDom(getDominioClient());
  }, []);

  function trocar(d: Dominio) {
    setDom(d);
    setDominioClient(d);
    router.refresh();
    // dispara recarga dos dados nas telas client-side
    window.dispatchEvent(new CustomEvent("dominio:troca", { detail: d }));
  }

  return (
    <div className="seg" role="tablist" aria-label="Domínio">
      {DOMINIOS.map((d) => (
        <button key={d} role="tab" data-active={dom === d} onClick={() => trocar(d)}>
          {DOMINIO_LABELS[d]}
        </button>
      ))}
    </div>
  );
}
