export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  // Marca: discos/lentes sobrepostos (inspirado na identidade), em off-white.
  return (
    <svg viewBox="0 0 44 44" className={className} fill="none" aria-hidden>
      <ellipse cx="15" cy="22" rx="8" ry="15" fill="#FFFCE6" opacity="0.28" />
      <ellipse cx="21" cy="22" rx="8" ry="15" fill="#FFFCE6" opacity="0.55" />
      <ellipse cx="27" cy="22" rx="8" ry="15" fill="#FFFCE6" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className="font-display text-xl font-semibold tracking-tight text-offwhite">
        Assessor
      </span>
    </div>
  );
}
