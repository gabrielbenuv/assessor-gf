export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  // Marca: discos/lentes sobrepostos — usa currentColor (adapta ao tema).
  return (
    <svg viewBox="0 0 44 44" className={className} fill="currentColor" aria-hidden>
      <ellipse cx="15" cy="22" rx="8" ry="15" opacity="0.3" />
      <ellipse cx="21" cy="22" rx="8" ry="15" opacity="0.6" />
      <ellipse cx="27" cy="22" rx="8" ry="15" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-8 w-8 shrink-0 text-accent" />
      <span className="font-display text-xl font-bold tracking-tight text-fg">Assessor</span>
    </div>
  );
}
