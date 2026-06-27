"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";

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
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-ink-900">
      <div className="px-5 py-5">
        <Logo />
        <p className="mt-1 pl-[2.7rem] text-xs text-slate-500">Financeiro & Agenda</p>
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
                  ? "bg-brand-500/15 font-medium text-brand-400 ring-1 ring-inset ring-brand-500/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-offwhite"
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
