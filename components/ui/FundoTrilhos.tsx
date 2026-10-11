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

/**
 * Fundo decorativo: linha férrea em perspectiva, com curva, lastro de brita, trilhos de aço com
 * reflexo, dormentes vindo em direção a quem olha e.
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
              <stop offset="0" stopColor="rgb(150,172,200)" stopOpacity=".14" />
              <stop offset="1" stopColor="rgb(110,135,168)" stopOpacity=".5" />
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
      </div>
    </div>
  );
}
