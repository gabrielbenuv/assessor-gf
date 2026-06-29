import * as React from "react";

// Ícones SVG line-style (grid 24, traço 1.5, currentColor) — sem emoji em lugar nenhum.
const PATHS: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  transacoes: (
    <>
      <path d="M7 7h13l-3-3" />
      <path d="M17 17H4l3 3" />
    </>
  ),
  parcelas: (
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 13 9 5 9-5" />
      <path d="m3 18 9 5 9-5" opacity=".5" />
    </>
  ),
  fatura: (
    <>
      <path d="M5 3h10l4 4v14H5z" />
      <path d="M15 3v4h4" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  banco: (
    <>
      <path d="M3 10 12 4l9 6" />
      <path d="M5 10v8M19 10v8M9 10v8M15 10v8" />
      <path d="M3 21h18" />
    </>
  ),
  cartao: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </>
  ),
  tag: (
    <>
      <path d="M20 12 12 20l-8-8V4h8z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </>
  ),
  recorrente: (
    <>
      <path d="M17 2.1 21 6l-4 3.9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 21.9 3 18l4-3.9" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  receber: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12l4 4 4-4" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4 3 7 7 9 4-2 7-5 7-9V6z" />
      <path d="m9.5 12 1.8 1.8 3.2-3.4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  chat: (
    <>
      <path d="M21 11.5a8.5 8.5 0 0 1-12 7.7L3 21l1.8-6A8.5 8.5 0 1 1 21 11.5Z" />
      <path d="M8 11h8M8 14h5" />
    </>
  ),
  plug: (
    <>
      <path d="M9 2v6M15 2v6" />
      <path d="M7 8h10v3a5 5 0 0 1-10 0z" />
      <path d="M12 16v6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  arrowDown: <path d="M12 5v14M5 12l7 7 7-7" />,
  wallet: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h12v4" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9H5a2 2 0 0 1-2-2Z" />
      <circle cx="16.5" cy="13.5" r="1.2" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 11l5 4 5-4" />
      <path d="M5 21h14" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z" />
      <path d="M19 14l.7 1.8L21.5 16l-1.8.7L19 18l-.7-1.3L16.5 16l1.8-.2z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className = "h-5 w-5",
  strokeWidth = 1.5,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
