import { requireAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import DominioSwitcher from "@/components/DominioSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  requireAuth();
  return (
    <div className="flex min-h-screen bg-bgc">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-hair bg-surface/80 px-6 py-3 backdrop-blur">
          <DominioSwitcher />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
