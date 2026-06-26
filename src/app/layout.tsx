import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assessor GF",
  description: "Assessor financeiro e de agenda via WhatsApp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
