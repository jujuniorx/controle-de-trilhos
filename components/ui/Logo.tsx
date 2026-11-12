import Link from 'next/link';

interface LogoProps {
  size?: number;
  subtitle?: string;
  showText?: boolean;
  className?: string;
  /** Quando informado, a marca vira link (ex.: "/" leva ao início de tudo). */
  href?: string;
}

/** Corte do trilho (boleto, alma e patim), na caixa de 56 × 56 da marca. Usado também na marca animada. */
export const MARCA_PERFIL =
  'M12.5 45V42.2c0-.9.5-1.5 1.4-1.7L24.5 38V25.2c0-1.5-.8-2.5-2.3-2.8l-2.6-.5c-2-.4-3.1-1.8-3.1-3.8v-4.6c0-2.6 1.7-4.3 4.3-4.3h14.4c2.6 0 4.3 1.7 4.3 4.3v4.6c0 2-1.1 3.4-3.1 3.8l-2.6.5c-1.5.3-2.3 1.3-2.3 2.8V38l10.6 2.5c.9.2 1.4.8 1.4 1.7V45Z';

/** Marca: o perfil do trilho assentado no dormente, sem letras. Usada em sidebar, topo e telas de acesso. */
export function Logo({ size = 32, subtitle, showText = true, className, href }: LogoProps) {
  const marca = (
    <div className={`ct-logo-mark ${className ?? ''}`}>
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
        {/* Cores vêm do tema (classes logo-*), para a marca acompanhar o tema do sistema */}
        <rect className="logo-tile" width="56" height="56" rx="10" />
        <rect className="logo-dorm" x="8" y="45" width="40" height="4.5" rx="1.5" />
        <path className="logo-trilho" d={MARCA_PERFIL} />
        <rect className="logo-dorm" x="20.5" y="12.2" width="15" height="2.4" rx="1.2" opacity=".55" />
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
