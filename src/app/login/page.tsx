"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setCarregando(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setErro(data.error || "Falha no login.");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="brand-bg" aria-hidden />

      <form onSubmit={submit} className="card relative z-10 w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <LogoMark className="mb-3 h-12 w-12" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">Assessor</h1>
          <p className="text-sm text-slate-400">Painel de controle</p>
        </div>

        <label className="label">E-mail</label>
        <input
          className="input mb-3"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          required
        />

        <label className="label">Senha</label>
        <input
          className="input mb-4"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {erro && <p className="mb-3 text-sm text-red-400">{erro}</p>}

        <button className="btn-primary w-full" disabled={carregando}>
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
