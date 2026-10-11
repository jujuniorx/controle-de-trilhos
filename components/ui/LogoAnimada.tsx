/** Marca com entrada animada: o quadro aparece, os dormentes surgem em sequência e os trilhos se desenham. */
export function LogoAnimada({ size = 72, className = '' }: { size?: number; className?: string }) {
  const dormentes = [9, 18, 27, 36, 44.5];
  return (
    <svg className={`logo-animada ${className}`} width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <rect className="la-quadro" width="56" height="56" rx="10" fill="#2c333c" />
      {dormentes.map((x, i) => (
        <rect
          key={x}
          className="la-dorm"
          x={x}
          y="10"
          width="3.5"
          height="36"
          rx="1.5"
          fill="#3b82c4"
          opacity={x === 27 ? 0.6 : 0.5}
          style={{ animationDelay: `${0.35 + i * 0.08}s` }}
        />
      ))}
      <rect className="la-trilho" x="7" y="13" width="42" height="4" rx="2" fill="#5b9bd5" style={{ animationDelay: '0.2s' }} />
      <rect className="la-trilho" x="7" y="39" width="42" height="4" rx="2" fill="#5b9bd5" style={{ animationDelay: '0.45s' }} />
    </svg>
  );
}
