import { MARCA_PERFIL } from '@/components/ui/Logo';

/** Marca com entrada animada: o quadro aparece, o dormente se estende e o trilho pousa em cima dele. */
export function LogoAnimada({ size = 72, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`logo-animada ${className}`} width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <rect className="la-quadro logo-tile" width="56" height="56" rx="10" />
      <rect className="la-trilho logo-dorm" x="8" y="45" width="40" height="4.5" rx="1.5" style={{ animationDelay: '0.2s' }} />
      <g className="la-perfil" style={{ animationDelay: '0.5s' }}>
        <path className="logo-trilho" d={MARCA_PERFIL} />
        <rect className="logo-dorm" x="20.5" y="12.2" width="15" height="2.4" rx="1.2" opacity=".55" />
      </g>
    </svg>
  );
}
