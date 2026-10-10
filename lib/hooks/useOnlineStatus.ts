'use client';

import { useSyncExternalStore } from 'react';

function inscrever(aoMudar: () => void): () => void {
  window.addEventListener('online', aoMudar);
  window.addEventListener('offline', aoMudar);
  return () => {
    window.removeEventListener('online', aoMudar);
    window.removeEventListener('offline', aoMudar);
  };
}

function snapshotCliente(): boolean {
  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
}

/**
 * Reflete o status online/offline do navegador (navigator.onLine), atualizado
 * reativamente pelos eventos `online`/`offline` do `window`.
 *
 * Usa useSyncExternalStore com um snapshot de servidor explícito (`true`). Isso é
 * o que mantém a renderização do servidor e a primeira renderização do cliente
 * IDÊNTICAS: sem isso o React aborta a hidratação por mismatch, descarta a árvore
 * SSR inteira e re-renderiza do zero — o que apaga tudo que o operador já tiver
 * digitado no wizard antes da hidratação terminar.
 *
 * Checar `typeof navigator === 'undefined'` não bastava: a partir do Node 21 existe
 * um `navigator` global no servidor, sem a propriedade `onLine`, então o servidor
 * avaliava `undefined` (falsy) e renderizava "Offline" enquanto o cliente
 * renderizava "Sincronizado".
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(inscrever, snapshotCliente, () => true);
}
