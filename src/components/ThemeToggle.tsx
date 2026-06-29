"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [tema, setTema] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const t = (localStorage.getItem("assessor-tema") as "dark" | "light") || "dark";
    setTema(t);
  }, []);

  function toggle() {
    const novo = tema === "dark" ? "light" : "dark";
    setTema(novo);
    document.documentElement.setAttribute("data-theme", novo);
    localStorage.setItem("assessor-tema", novo);
  }

  return (
    <button
      onClick={toggle}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-hair text-muted transition hover:text-fg hover:border-accent ${className}`}
      title={tema === "dark" ? "Tema claro" : "Tema escuro"}
      aria-label="Alternar tema"
    >
      <Icon name={tema === "dark" ? "sun" : "moon"} className="h-4 w-4" />
    </button>
  );
}
