'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';

export type AbaEstoque = { id: string; rotulo: string; curto: string };

/**
 * Abas do Estoque (Trilhos e as áreas de materiais), no mesmo visual das abas de setores
 * da Usina: uma faixa com a marca deslizante. No celular usa os nomes curtos para caber.
 */
export function AbasEstoque({ abas, ativa }: { abas: AbaEstoque[]; ativa: string }) {
  const indice = Math.max(0, abas.findIndex((a) => a.id === ativa));
  return (
    <nav aria-label="Áreas do estoque" className="setores-nav" style={{ '--n': abas.length, '--ativo': indice } as CSSProperties}>
      <span className="setores-marca" aria-hidden="true" />
      {abas.map((a) => (
        <Link key={a.id} href={`/admin/estoque?area=${a.id}`} className="setores-item" aria-current={a.id === ativa ? 'page' : undefined}>
          <span className="setores-longo">{a.rotulo}</span>
          {/* Sem "display" aqui: o CSS esconde o nome curto no computador e mostra no celular. */}
          <span className="setores-curto" aria-hidden="true" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{a.curto}</span>
        </Link>
      ))}
    </nav>
  );
}
