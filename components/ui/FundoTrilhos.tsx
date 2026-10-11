import type { CSSProperties } from 'react';

const QTD_DORMENTES = 9;
const DURACAO_S = 3.6;

/**
 * Fundo decorativo: uma linha férrea em perspectiva. Os dois trilhos convergem para o horizonte e
 * os dormentes vêm em direção a quem olha (mais devagar longe, mais rápido perto), como numa viagem de trem.
 */
export function FundoTrilhos({ className = '' }: { className?: string }) {
  return (
    <div className={`fundo-trilhos ${className}`} aria-hidden="true">
      <div className="fundo-trilhos-brilho" />
      <div className="fundo-trilhos-via">
        <div className="via-lastro" />
        {Array.from({ length: QTD_DORMENTES }, (_, i) => (
          <div
            key={i}
            className="via-dorm"
            style={{ '--atraso': `${-(i / QTD_DORMENTES) * DURACAO_S}s`, '--dur': `${DURACAO_S}s` } as CSSProperties}
          />
        ))}
        <svg className="via-trilhos" viewBox="0 0 100 60" preserveAspectRatio="none">
          <polygon className="via-trilho-corpo" points="49.2,0 49.8,0 18,60 8,60" />
          <polygon className="via-trilho-corpo" points="50.2,0 50.8,0 92,60 82,60" />
          <polygon className="via-trilho-brilho" points="49.4,0 49.7,0 15.5,60 12,60" />
          <polygon className="via-trilho-brilho" points="50.3,0 50.6,0 88,60 84.5,60" />
        </svg>
      </div>
    </div>
  );
}
