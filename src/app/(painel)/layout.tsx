import { requireAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  requireAuth();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
