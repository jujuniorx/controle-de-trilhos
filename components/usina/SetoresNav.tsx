'use client';

import Link from 'next/link';
import type { CSSProperties, MouseEvent } from 'react';

export type SetorNav = { id: string; rotulo: string; curto: string };

/** Pergunta antes de sair de um setor com lançamento ainda não salvo. */
export function sairSemSalvar(e: MouseEvent): boolean {
  if (!document.querySelector('form[data-sujo="true"]')) return true;
  if (window.confirm('Há lançamentos que ainda não foram salvos. Sair sem salvar?')) return true;
  e.preventDefault();
  return false;
}

/**
 * Abas dos setores da Usina: mostra um setor por vez. A faixa fica presa no topo.
 * No celular usa os nomes curtos para os cinco caberem numa linha.
 */
export function SetoresNav({ setores, ativo, data }: { setores: SetorNav[]; ativo: string; data: string }) {
  const indice = Math.max(0, setores.findIndex((s) => s.id === ativo));
  return (
    <nav aria-label="Setores da usina" className="setores-nav" style={{ '--n': setores.length, '--ativo': indice } as CSSProperties}>
      <span className="setores-marca" aria-hidden="true" />
      {setores.map((s) => (
        <Link key={s.id} href={`/admin/usina?data=${data}&setor=${s.id}`} className="setores-item" aria-current={s.id === ativo ? 'page' : undefined} onClick={sairSemSalvar}>
          <span className="setores-longo">{s.rotulo}</span>
          <span className="setores-curto" aria-hidden="true">{s.curto}</span>
        </Link>
      ))}
    </nav>
  );
}
