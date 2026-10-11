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

/** Locomotiva diesel vista de lado (azul, branco e cinza), sem marcas ou textos. */
function Locomotiva({ x }: { x: number }) {
  return (
    <svg x={x} y="0" viewBox="0 0 230 64" width="230" height="64" aria-hidden="true">
      {/* truques (rodas) */}
      <rect x="22" y="50" width="62" height="7" rx="2" fill="#1b1f25" />
      <rect x="146" y="50" width="62" height="7" rx="2" fill="#1b1f25" />
      {[30, 46, 62, 78, 154, 170, 186, 202].map((x) => (
        <circle key={x} cx={x} cy="57" r="5.2" fill="#262b33" stroke="#4a515c" strokeWidth="1" />
      ))}
      {/* tanque / plataforma */}
      <rect x="14" y="44" width="202" height="8" rx="2" fill="#2d333d" />
      {/* corpo inferior azul */}
      <path d="M6 44V30l12-6h194l12 6v14z" fill="#1f5fa8" />
      {/* corpo superior branco */}
      <path d="M18 24h194l-4-9H92l-6-7H44l-6 7h-8z" fill="#e9edf2" />
      {/* cabine */}
      <path d="M150 8h54l8 16h-62z" fill="#e9edf2" />
      <path d="M156 11h24v11h-27zM184 11h17l6 11h-23z" fill="#16222f" />
      <path d="M158 12h8l-5 9h-6z" fill="#8fb4de" opacity=".4" />
      {/* faixa cinza */}
      <rect x="14" y="30" width="204" height="4" fill="#7b8696" />
      {/* grades de ventilação */}
      {[48, 58, 68, 78, 88, 98, 108, 118].map((x) => (
        <rect key={x} x={x} y="13" width="5" height="9" rx="1" fill="#aeb8c6" />
      ))}
      <rect x="40" y="9" width="48" height="4" rx="1.5" fill="#5f6b7c" />
      {/* nariz curto + faróis */}
      <path d="M6 44V30l-3 14z" fill="#16406f" />
      <rect x="9" y="33" width="5" height="5" rx="1" fill="#fff4d2" />
      <rect x="213" y="33" width="5" height="5" rx="1" fill="#fff4d2" />
      {/* portas */}
      <path d="M130 26h4v18h-4zM138 26h4v18h-4z" fill="#c4ccd8" opacity=".55" />
    </svg>
  );
}

/** Vagão graneleiro cinza (tremonha). */
function Vagao({ x }: { x: number }) {
  return (
    <svg x={x} y="0" viewBox="0 0 120 64" width="120" height="64" aria-hidden="true">
      <rect x="12" y="52" width="26" height="6" rx="2" fill="#1b1f25" />
      <rect x="82" y="52" width="26" height="6" rx="2" fill="#1b1f25" />
      {[18, 32, 88, 102].map((x) => (
        <circle key={x} cx={x} cy="58" r="4.6" fill="#262b33" stroke="#4a515c" strokeWidth="1" />
      ))}
      <rect x="4" y="46" width="112" height="6" rx="1.5" fill="#2d333d" />
      <path d="M6 14h108v26l-14 8H20L6 40z" fill="#8b95a3" />
      <path d="M6 14h108v5H6z" fill="#a9b3c0" />
      {[30, 60, 90].map((x) => (
        <rect key={x} x={x - 1} y="19" width="2" height="26" fill="#6d7786" />
      ))}
      <rect x="6" y="40" width="108" height="3" fill="#6d7786" />
    </svg>
  );
}

const QTD_VAGOES = 9;

/**
 * Fundo decorativo: linha férrea em perspectiva, com curva, lastro de brita, trilhos de aço com
 * reflexo, dormentes vindo em direção a quem olha e, de tempos em tempos, um trem cruzando ao longe.
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
              <stop offset="0" stopColor="rgb(170,172,176)" stopOpacity=".12" />
              <stop offset="1" stopColor="rgb(150,152,158)" stopOpacity=".5" />
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
        <div className="via-trem-lateral">
          <svg viewBox={`0 0 ${232 + QTD_VAGOES * 122 + 230} 66`} aria-hidden="true">
            <line x1="0" y1="64" x2="3000" y2="64" stroke="#6a3a22" strokeWidth="2" />
            <Locomotiva x={0} />
            {Array.from({ length: QTD_VAGOES }, (_, i) => (
              <Vagao key={i} x={232 + i * 122} />
            ))}
            <Locomotiva x={232 + QTD_VAGOES * 122} />
          </svg>
        </div>
      </div>
    </div>
  );
}
