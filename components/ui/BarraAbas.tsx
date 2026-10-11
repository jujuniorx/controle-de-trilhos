'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { EVENTO_MENU } from '@/components/ui/GestosApp';

export type Aba = {
  /** Destino da aba; sem href, a aba abre o menu "Mais". */
  href?: string;
  rotulo: string;
  icone: ReactNode;
  /** Quando preenchido, a aba fica ativa em qualquer rota que comece por este prefixo. */
  prefixo?: string;
};

/** Barra de abas fixa no rodapé do celular (estilo aplicativo). Some em telas médias e grandes. */
export function BarraAbas({ abas, raiz }: { abas: Aba[]; raiz: string }) {
  const pathname = usePathname().replace(/\/$/, '') || '/';

  function ativa(a: Aba): boolean {
    if (!a.href) return false;
    if (a.href === raiz) return pathname === raiz;
    return pathname === a.href || pathname.startsWith(`${a.prefixo ?? a.href}/`);
  }

  return (
    <nav className="barra-abas" aria-label="Navegação principal">
      {abas.map((a) => {
        const conteudo = (
          <>
            <span className="aba-icone">{a.icone}</span>
            <span className="aba-rotulo">{a.rotulo}</span>
          </>
        );
        if (!a.href) {
          return (
            <button key={a.rotulo} type="button" className="aba" onClick={() => window.dispatchEvent(new Event(EVENTO_MENU))}>
              {conteudo}
            </button>
          );
        }
        return (
          <Link key={a.href} href={a.href} className="aba" data-ativa={ativa(a)} aria-current={ativa(a) ? 'page' : undefined}>
            {conteudo}
          </Link>
        );
      })}
    </nav>
  );
}
