import Link from 'next/link';

interface LogoProps {
  size?: number;
  subtitle?: string;
  showText?: boolean;
  className?: string;
  /** Quando informado, a marca vira link (ex.: "/" leva ao início de tudo). */
  href?: string;
}

/** Marca (grafite + trilhos azul-aço, sem letras) — SVG do protótipo aprovado, usado em sidebar/topbar/acesso. */
export function Logo({ size = 32, subtitle, showText = true, className, href }: LogoProps) {
  const marca = (
    <div className={`ct-logo-mark ${className ?? ''}`}>
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
        {/* Cores vêm do tema (classes logo-*), para a marca acompanhar o tema do sistema */}
        <rect className="logo-tile" width="56" height="56" rx="10" />
        <rect className="logo-dorm" x="9" y="10" width="3.5" height="36" rx="1.5" opacity=".5" />
        <rect className="logo-dorm" x="18" y="10" width="3.5" height="36" rx="1.5" opacity=".5" />
        <rect className="logo-dorm" x="27" y="10" width="3.5" height="36" rx="1.5" opacity=".6" />
        <rect className="logo-dorm" x="36" y="10" width="3.5" height="36" rx="1.5" opacity=".5" />
        <rect className="logo-dorm" x="44.5" y="10" width="3.5" height="36" rx="1.5" opacity=".5" />
        <rect className="logo-trilho" x="7" y="13" width="42" height="4" rx="2" />
        <rect className="logo-trilho" x="7" y="39" width="42" height="4" rx="2" />
      </svg>
      {showText && (
        <div className="ct-logo-text">
          <span className="name">Controle de Trilhos</span>
          {subtitle && <span className="sub">{subtitle}</span>}
        </div>
      )}
    </div>
  );
  if (!href) return marca;
  return (
    <Link href={href} className="ct-logo-link" aria-label="Início: trocar de área" title="Início">
      {marca}
    </Link>
  );
}
