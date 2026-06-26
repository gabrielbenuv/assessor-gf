"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/transacoes", label: "Transações", icon: "💳" },
  { href: "/contas-fixas", label: "Contas fixas", icon: "📌" },
  { href: "/bancos", label: "Bancos", icon: "🏦" },
  { href: "/cartoes", label: "Cartões", icon: "💳" },
  { href: "/categorias", label: "Categorias", icon: "🏷️" },
  { href: "/numeros", label: "Números autorizados", icon: "🔒" },
  { href: "/notificacoes", label: "Notificações", icon: "🔔" },
  { href: "/simulador", label: "Simulador", icon: "🤖" },
  { href: "/integracoes", label: "Integrações / Chaves", icon: "🔌" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-lg">💸</div>
        <div>
          <p className="font-semibold leading-tight">Assessor GF</p>
          <p className="text-xs text-slate-400">Financeiro & Agenda</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <button onClick={logout} className="m-3 btn-ghost text-sm">
        Sair
      </button>
    </aside>
  );
}
