"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <form onSubmit={submit} className="card w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-2xl">
            💸
          </div>
          <h1 className="text-xl font-semibold">Assessor GF</h1>
          <p className="text-sm text-slate-500">Painel de controle</p>
        </div>

        <label className="label">E-mail</label>
        <input
          className="input mb-3"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@assessor.local"
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

        {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}

        <button className="btn-primary w-full" disabled={carregando}>
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
