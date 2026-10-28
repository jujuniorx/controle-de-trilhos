'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Recarrega os dados da tela de tempos em tempos (só com a aba visível e com internet). Não mostra nada. */
export function AtualizarAuto({ segundos = 20 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      // Não recarrega enquanto alguém está digitando num campo: a atualização não pode apagar o que está sendo preenchido.
      const digitando = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '');
      if (document.visibilityState === 'visible' && navigator.onLine && !digitando) router.refresh();
    }, segundos * 1000);
    return () => window.clearInterval(id);
  }, [router, segundos]);
  return null;
}
