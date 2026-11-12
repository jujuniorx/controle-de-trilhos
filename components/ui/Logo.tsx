import Link from 'next/link';

interface LogoProps {
  size?: number;
  subtitle?: string;
  showText?: boolean;
  className?: string;
  /** Quando informado, a marca vira link (ex.: "/" leva ao início de tudo). */
  href?: string;
}

/** Centro de cada um dos cinco dormentes, na caixa de 56 × 56 da marca. */
export const MARCA_DORMENTES = [10.5, 19.25, 28, 36.75, 45.5];
/** Centro (altura) de cada um dos dois trilhos. */
export const MARCA_TRILHOS = [15, 41];

/** Um dormente com as duas placas de apoio, onde os trilhos passam. */
export function MarcaDormente({ x, className, style }: { x: number; className?: string; style?: React.CSSProperties }) {
  return (
    <g className={className} style={style}>
      <rect className="logo-dorm" x={x - 2} y="9" width="4" height="38" rx="1.6" opacity=".55" />
      {MARCA_TRILHOS.map((y) => (
        <rect key={y} className="logo-dorm" x={x - 3.5} y={y - 3.7} width="7" height="7.4" rx="1" />
      ))}
    </g>
  );
}

/** Um trilho, com o friso do boleto no meio. */
export function MarcaTrilho({ y, className, style }: { y: number; className?: string; style?: React.CSSProperties }) {
  return (
    <g className={className} style={style}>
      <rect className="logo-trilho" x="5.5" y={y - 2.5} width="45" height="5" rx="2.5" />
      <rect className="logo-friso" x="8.5" y={y - 0.55} width="39" height="1.1" rx=".55" />
    </g>
  );
}

/** Marca: a via vista de cima (dois trilhos sobre cinco dormentes, com as placas de apoio), sem letras. */
export function Logo({ size = 32, subtitle, showText = true, className, href }: LogoProps) {
  const marca = (
    <div className={`ct-logo-mark ${className ?? ''}`}>
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
        {/* Cores vêm do tema (classes logo-*), para a marca acompanhar o tema do sistema */}
        <rect className="logo-tile" width="56" height="56" rx="10" />
        {MARCA_DORMENTES.map((x) => <MarcaDormente key={x} x={x} />)}
        {MARCA_TRILHOS.map((y) => <MarcaTrilho key={y} y={y} />)}
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
