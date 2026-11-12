import { MARCA_DORMENTES, MARCA_TRILHOS, MarcaDormente, MarcaTrilho } from '@/components/ui/Logo';

/** Marca com entrada animada: o quadro aparece, os dormentes surgem em sequência e os trilhos se desenham. */
export function LogoAnimada({ size = 72, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`logo-animada ${className}`} width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <rect className="la-quadro logo-tile" width="56" height="56" rx="10" />
      {MARCA_DORMENTES.map((x, i) => (
        <MarcaDormente key={x} x={x} className="la-dorm" style={{ animationDelay: `${0.35 + i * 0.08}s` }} />
      ))}
      {MARCA_TRILHOS.map((y, i) => (
        <MarcaTrilho key={y} y={y} className="la-trilho" style={{ animationDelay: `${0.2 + i * 0.25}s` }} />
      ))}
    </svg>
  );
}
