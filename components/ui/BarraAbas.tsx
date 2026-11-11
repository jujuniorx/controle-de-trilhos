'use client';

import type { CSSProperties, ReactNode } from 'react';
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

/**
 * Barra de navegação flutuante no rodapé, no estilo "bolinha que sobe": os ícones ficam
 * numa barra arredondada e o item ativo sobe numa bolinha colorida acima dela. A bolinha
 * desliza de um item para o outro ao trocar de tela (a barra fica montada no layout).
 *
 * `largura` escolhe em que telas a barra aparece: "celular" (até 767 px), "larga" (768 px
 * ou mais) ou "todas". Assim o celular pode ter 4 abas + Mais e o computador a lista toda.
 */
export function BarraAbas({ abas, raiz, largura = 'todas' }: { abas: Aba[]; raiz: string; largura?: 'celular' | 'larga' | 'todas' }) {
  const pathname = usePathname().replace(/\/$/, '') || '/';

  function ativa(a: Aba): boolean {
    if (!a.href) return false;
    if (a.href === raiz || a.href === '/') return pathname === a.href;
    return pathname === a.href || pathname.startsWith(`${a.prefixo ?? a.href}/`) || pathname === a.prefixo;
  }

  const indiceAtivo = abas.findIndex(ativa);
  const estilo = { '--n': abas.length, '--ativo': Math.max(indiceAtivo, 0) } as CSSProperties;

  return (
    <nav className="barra-abas barra-bolha" data-largura={largura} data-tem-ativo={indiceAtivo >= 0} style={estilo} aria-label="Navegação principal">
      <span className="bolha" aria-hidden="true" />
      {abas.map((a, i) => {
        const conteudo = (
          <>
            <span className="aba-icone">{a.icone}</span>
            <span className="aba-rotulo">{a.rotulo}</span>
          </>
        );
        const estiloAba = { '--i': i } as CSSProperties;
        if (!a.href) {
          return (
            <button key={a.rotulo} type="button" className="aba" style={estiloAba} title={a.rotulo} onClick={() => window.dispatchEvent(new Event(EVENTO_MENU))}>
              {conteudo}
            </button>
          );
        }
        const eAtiva = i === indiceAtivo;
        return (
          <Link key={a.href} href={a.href} className="aba" style={estiloAba} title={a.rotulo} data-ativa={eAtiva} aria-current={eAtiva ? 'page' : undefined}>
            {conteudo}
          </Link>
        );
      })}
    </nav>
  );
}
