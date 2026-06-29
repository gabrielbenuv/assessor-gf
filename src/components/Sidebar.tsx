"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { Icon, type IconName } from "./Icon";

type Item = { href: string; label: string; icon: IconName };
type Grupo = { titulo: string; itens: Item[] };

const GRUPOS: Grupo[] = [
  {
    titulo: "Painel",
    itens: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/transacoes", label: "Transações", icon: "transacoes" },
      { href: "/parcelamentos", label: "Parcelamentos", icon: "parcelas" },
      { href: "/faturas", label: "Faturas", icon: "fatura" },
      { href: "/contas-fixas", label: "Contas fixas", icon: "recorrente" },
      { href: "/contas-receber", label: "Contas a receber", icon: "receber" },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { href: "/bancos", label: "Bancos", icon: "banco" },
      { href: "/cartoes", label: "Cartões", icon: "cartao" },
      { href: "/categorias", label: "Categorias", icon: "tag" },
      { href: "/perfil", label: "Perfil financeiro", icon: "perfil" },
    ],
  },
  {
    titulo: "Configuração",
    itens: [
      { href: "/numeros", label: "Números autorizados", icon: "shield" },
      { href: "/notificacoes", label: "Notificações", icon: "bell" },
      { href: "/simulador", label: "Simulador", icon: "chat" },
      { href: "/integracoes", label: "Integrações", icon: "plug" },
    ],
  },
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
    <aside className="flex w-60 shrink-0 flex-col border-r border-hair bg-surface">
      <div className="px-5 py-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {GRUPOS.map((g) => (
          <div key={g.titulo}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">{g.titulo}</p>
            <div className="space-y-0.5">
              {g.itens.map((l) => {
                const active = pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-accent/10 font-medium text-accent ring-1 ring-inset ring-accent/25"
                        : "text-muted hover:bg-accent/5 hover:text-fg"
                    }`}
                  >
                    <Icon name={l.icon} className="h-[18px] w-[18px] shrink-0" />
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <button onClick={logout} className="btn-ghost m-3 text-sm">
        <Icon name="logout" className="h-4 w-4" />
        Sair
      </button>
    </aside>
  );
}
