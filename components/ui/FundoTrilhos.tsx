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

/** Frente de uma locomotiva diesel (vista de frente), desenhada em SVG. */
function Locomotiva() {
  return (
    <svg viewBox="0 0 100 88" aria-hidden="true">
      <defs>
        <linearGradient id="loco-corpo" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#aebccf" />
          <stop offset=".25" stopColor="#eef3f9" />
          <stop offset=".75" stopColor="#eef3f9" />
          <stop offset="1" stopColor="#aebccf" />
        </linearGradient>
        <linearGradient id="loco-azul" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b86d8" />
          <stop offset="1" stopColor="#1a4b8c" />
        </linearGradient>
        <linearGradient id="loco-vidro" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d3048" />
          <stop offset="1" stopColor="#0a1420" />
        </linearGradient>
        <linearGradient id="loco-teto" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#56677f" />
          <stop offset="1" stopColor="#2c384b" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="86" rx="42" ry="2.6" fill="#000" opacity=".5" />
      {/* teto e buzina */}
      <path d="M14 15q36-14 72 0l3 8H11z" fill="url(#loco-teto)" />
      <rect x="45" y="5" width="10" height="4" rx="1.5" fill="#6d7e96" />
      <rect x="38" y="16" width="24" height="6" rx="1.5" fill="#0d1724" stroke="#56718f" strokeWidth=".6" />
      <circle cx="43" cy="19" r="1" fill="#ffd36b" />
      <circle cx="50" cy="19" r="1" fill="#ffd36b" />
      <circle cx="57" cy="19" r="1" fill="#ffd36b" />
      {/* rosto */}
      <rect x="8" y="22" width="84" height="54" rx="6" fill="url(#loco-corpo)" stroke="#8fa2bb" strokeWidth=".8" />
      <rect x="8" y="22" width="5" height="54" rx="2" fill="#5a6e8a" opacity=".28" />
      <rect x="87" y="22" width="5" height="54" rx="2" fill="#5a6e8a" opacity=".28" />
      {/* para-brisas */}
      <path d="M17 27h29v20q0 1-1 1H19q-2 0-2-2z" fill="url(#loco-vidro)" stroke="#6f8aa8" strokeWidth=".9" />
      <path d="M54 27h29v19q0 2-2 2H55q-1 0-1-1z" fill="url(#loco-vidro)" stroke="#6f8aa8" strokeWidth=".9" />
      <path d="M20 29l11 0-8 17h-4zM57 29h11l-8 17h-4z" fill="#9ec3ec" opacity=".2" />
      <rect x="46" y="27" width="8" height="21" fill="#d2dbe7" />
      <path d="M22 45l14-12M64 45l14-12" stroke="#9eb0c6" strokeWidth=".8" strokeLinecap="round" />
      {/* faixa azul + cinza */}
      <rect x="8" y="52" width="84" height="11" fill="url(#loco-azul)" />
      <rect x="8" y="63" width="84" height="2.4" fill="#8696ad" />
      <rect x="8" y="51" width="84" height="1" fill="#fff" opacity=".5" />
      {/* grade frontal e placa */}
      <rect x="25" y="67" width="50" height="7" rx="2" fill="#16202d" />
      <rect x="29" y="68.5" width="2" height="4" fill="#3a4b62" />
      <rect x="34" y="68.5" width="2" height="4" fill="#3a4b62" />
      <rect x="39" y="68.5" width="2" height="4" fill="#3a4b62" />
      <rect x="59" y="68.5" width="2" height="4" fill="#3a4b62" />
      <rect x="64" y="68.5" width="2" height="4" fill="#3a4b62" />
      <rect x="69" y="68.5" width="2" height="4" fill="#3a4b62" />
      <rect x="44" y="66.5" width="12" height="7.5" rx="1.2" fill="#dde5ef" />
      <rect x="46" y="68.2" width="8" height="4" rx=".8" fill="#8fa0b6" />
      {/* faróis e luzes laterais */}
      <g className="loco-luz">
        <circle cx="22" cy="57.5" r="5.6" fill="#fff8e1" />
        <circle cx="78" cy="57.5" r="5.6" fill="#fff8e1" />
      </g>
      <circle cx="22" cy="57.5" r="5.6" fill="none" stroke="#c9d6e6" strokeWidth=".8" />
      <circle cx="78" cy="57.5" r="5.6" fill="none" stroke="#c9d6e6" strokeWidth=".8" />
      <circle cx="12" cy="71" r="1.6" fill="#ffe7a8" />
      <circle cx="88" cy="71" r="1.6" fill="#ffe7a8" />
      {/* corrimão e degraus */}
      <path d="M10 26v40M90 26v40" stroke="#f4f8fc" strokeWidth="1.1" strokeLinecap="round" opacity=".85" />
      <rect x="3" y="68" width="8" height="2.4" rx=".8" fill="#4d5a70" />
      <rect x="89" y="68" width="8" height="2.4" rx=".8" fill="#4d5a70" />
      {/* limpador de trilhos (pilot) com listras */}
      <path d="M12 76h76l-6 9H18z" fill="#2a3446" />
      <path d="M20 76h6l-3 9h-6zM34 76h6l-3 9h-6zM48 76h6l-3 9h-6zM62 76h6l-3 9h-6zM76 76h6l-3 9h-6z" fill="#e2b92f" />
      <rect x="44" y="72" width="12" height="6" rx="1.4" fill="#566278" />
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
