'use client';

import { useLayoutEffect, type RefObject } from 'react';

/**
 * Pílula do menu lateral: mede o item ativo e grava a posição em variáveis CSS
 * (--pilula-y, --pilula-h, --pilula-on), que o ::before do menu usa para deslizar.
 * Mede de novo quando o menu muda de tamanho (fonte que carrega, tema que troca),
 * para a pílula nunca ficar desalinhada do item.
 */
export function usePilulaMenu(navRef: RefObject<HTMLElement | null>, chave: unknown) {
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const medir = () => {
      const ativo = nav.querySelector<HTMLElement>('a[data-active="true"]');
      if (!ativo) {
        nav.style.setProperty('--pilula-on', '0');
        return;
      }
      nav.style.setProperty('--pilula-y', `${ativo.offsetTop}px`);
      nav.style.setProperty('--pilula-h', `${ativo.offsetHeight}px`);
      nav.style.setProperty('--pilula-on', '1');
    };
    medir();
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    observador?.observe(nav);
    const temas = new MutationObserver(medir);
    temas.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
    return () => {
      observador?.disconnect();
      temas.disconnect();
    };
  }, [navRef, chave]);
}
