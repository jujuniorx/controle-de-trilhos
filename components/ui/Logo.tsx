interface LogoProps {
  size?: number;
  subtitle?: string;
  showText?: boolean;
  className?: string;
}

/** Marca (grafite + trilhos azul-aço, sem letras) — SVG do protótipo aprovado, usado em sidebar/topbar/acesso. */
export function Logo({ size = 32, subtitle, showText = true, className }: LogoProps) {
  return (
    <div className={`ct-logo-mark ${className ?? ''}`}>
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
        <rect width="56" height="56" rx="10" fill="#2c333c" />
        <rect x="9" y="10" width="3.5" height="36" rx="1.5" fill="#3b82c4" opacity=".5" />
        <rect x="18" y="10" width="3.5" height="36" rx="1.5" fill="#3b82c4" opacity=".5" />
        <rect x="27" y="10" width="3.5" height="36" rx="1.5" fill="#3b82c4" opacity=".6" />
        <rect x="36" y="10" width="3.5" height="36" rx="1.5" fill="#3b82c4" opacity=".5" />
        <rect x="44.5" y="10" width="3.5" height="36" rx="1.5" fill="#3b82c4" opacity=".5" />
        <rect x="7" y="13" width="42" height="4" rx="2" fill="#5b9bd5" />
        <rect x="7" y="39" width="42" height="4" rx="2" fill="#5b9bd5" />
      </svg>
      {showText && (
        <div className="ct-logo-text">
          <span className="name">Controle de Trilhos</span>
          {subtitle && <span className="sub">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
