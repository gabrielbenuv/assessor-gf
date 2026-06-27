import { requireAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  requireAuth();
  return (
    <div className="relative flex min-h-screen">
      <div className="brand-bg" aria-hidden />
      <Sidebar />
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
