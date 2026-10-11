import type { CSSProperties } from 'react';
import { DURACAO_DORMENTES_S, QTD_DORMENTES, geometriaVia } from '@/lib/ui/geometriaVia';

const GEO = geometriaVia();
const RECORTE_LASTRO = `polygon(${GEO.lastro
  .split(' ')
  .map((par) => {
    const [x, y] = par.split(',');
    return `${x}% ${y}%`;
  })
  .join(', ')})`;

/** Frente de uma locomotiva (vista de frente), desenhada em SVG. */
function Locomotiva() {
  return (
    <svg viewBox="0 0 100 88" aria-hidden="true">
      <rect x="6" y="12" width="88" height="72" rx="10" fill="#1d2838" stroke="#41536c" strokeWidth="1" />
      <rect x="13" y="6" width="74" height="12" rx="6" fill="#2a374a" stroke="#41536c" strokeWidth=".8" />
      <rect x="17" y="21" width="30" height="24" rx="4" fill="#0c1520" stroke="#56718f" strokeWidth=".9" />
      <rect x="53" y="21" width="30" height="24" rx="4" fill="#0c1520" stroke="#56718f" strokeWidth=".9" />
      <path d="M19 40l9-17h9l-9 17zM55 40l9-17h9l-9 17z" fill="#8fb4de" opacity=".18" />
      <rect x="47.5" y="21" width="5" height="24" fill="#2a374a" />
      <rect x="6" y="48" width="88" height="5" fill="#2f6fb8" />
      <rect x="16" y="56" width="68" height="20" rx="4" fill="#131c28" />
      {[24, 31, 38, 62, 69, 76].map((x) => (
        <rect key={x} x={x - 1.5} y="59" width="3" height="14" rx="1.2" fill="#243245" />
      ))}
      <rect x="42" y="60" width="16" height="9" rx="1.5" fill="#d9e1ec" />
      <rect x="44" y="62" width="12" height="5" fill="#9aa8bb" />
      <g className="loco-luz">
        <circle cx="22" cy="53" r="5.5" fill="#fff6dc" />
        <circle cx="78" cy="53" r="5.5" fill="#fff6dc" />
        <circle cx="50" cy="12" r="3.2" fill="#fff6dc" />
      </g>
      <rect x="28" y="78" width="44" height="6" rx="2" fill="#0b121b" />
    </svg>
  );
}

/**
 * Fundo decorativo: linha férrea em perspectiva, com curva, lastro de brita, trilhos de aço com
 * reflexo, dormentes vindo em direção a quem olha e, de tempos em tempos, um trem se aproximando.
 * Geometria em lib/ui/geometriaVia.ts; animações no bloco "trilhos" de app/globals.css.
 */
export function FundoTrilhos({ className = '' }: { className?: string }) {
  return (
    <div className={`fundo-trilhos ${className}`} aria-hidden="true">
      <div className="fundo-trilhos-brilho" />
      <div className="fundo-trilhos-via">
        <div className="via-neblina" />
        <svg className="via-cena" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lastro-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgb(150,170,195)" stopOpacity=".1" />
              <stop offset="1" stopColor="rgb(120,140,165)" stopOpacity=".42" />
            </linearGradient>
          </defs>
          <polygon className="via-lastro-borda" points={GEO.lastroBorda} />
          <polygon className="via-lastro" points={GEO.lastro} />
        </svg>
        <div className="via-brita" style={{ clipPath: RECORTE_LASTRO }} />
        {Array.from({ length: QTD_DORMENTES }, (_, i) => (
          <div
            key={i}
            className="via-dorm"
            style={{ '--atraso': `${-(i / QTD_DORMENTES) * DURACAO_DORMENTES_S}s`, '--dur': `${DURACAO_DORMENTES_S}s` } as CSSProperties}
          />
        ))}
        <svg className="via-cena" viewBox="0 0 100 100" preserveAspectRatio="none">
          {GEO.sombra.map((p, i) => (
            <polygon key={`s${i}`} className="via-sombra" points={p} />
          ))}
          {GEO.corpo.map((p, i) => (
            <polygon key={`c${i}`} className="via-trilho-corpo" points={p} />
          ))}
          {GEO.topo.map((p, i) => (
            <polygon key={`t${i}`} className="via-trilho-topo" points={p} />
          ))}
          {GEO.brilho.map((p, i) => (
            <polyline key={`b${i}`} className="via-reflexo" points={p} pathLength={100} />
          ))}
        </svg>
        <div className="via-farol-distante" />
        <div className="via-trem">
          <div className="via-farol" />
          <div className="via-loco">
            <Locomotiva />
          </div>
        </div>
      </div>
    </div>
  );
}
