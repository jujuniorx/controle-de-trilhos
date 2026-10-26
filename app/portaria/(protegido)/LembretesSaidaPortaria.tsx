'use client';

import { useEffect } from 'react';
import { verificarLembretesSaidaAction } from './actions';

/** Enquanto a tela da Portaria está aberta, pede ao servidor os lembretes de saída pendente. Não mostra nada. */
export function LembretesSaidaPortaria({ segundos = 60 }: { segundos?: number }) {
  useEffect(() => {
    const verificar = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        verificarLembretesSaidaAction().catch(() => {});
      }
    };
    verificar();
    const id = window.setInterval(verificar, segundos * 1000);
    return () => window.clearInterval(id);
  }, [segundos]);
  return null;
}
