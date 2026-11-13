import type { CSSProperties } from 'react';

const BARRAS = 13;
const LARGURA = 220;
const PASSO = LARGURA / BARRAS;

/**
 * Embaixo do nome do sistema: um TLS sendo montado. As 13 barras chegam uma a uma e cada emenda é soldada
 * (acende em brasa e esfria), até virar um trilho só. Cores do texto do tema; a brasa é sempre laranja.
 */
export function CordaoTls({ className = '' }: { className?: string }) {
  return (
    <svg className={`cordao-tls ${className}`} viewBox={`0 0 ${LARGURA} 8`} aria-hidden="true">
      {Array.from({ length: BARRAS }, (_, i) => (
        <rect key={`b${i}`} className="ct-barra" x={i * PASSO + 0.4} y="2" width={PASSO - 0.8} height="4" rx="1" style={{ '--i': i } as CSSProperties} />
      ))}
      {Array.from({ length: BARRAS - 1 }, (_, i) => (
        <rect key={`e${i}`} className="ct-emenda" x={(i + 1) * PASSO - 1.2} y="1" width="2.4" height="6" rx="1" style={{ '--i': i } as CSSProperties} />
      ))}
    </svg>
  );
}
