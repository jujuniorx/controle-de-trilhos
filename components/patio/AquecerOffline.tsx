'use client';

import { useEffect } from 'react';

const TELAS_DO_PATIO = ['/patio', '/patio/recebimentos/novo', '/patio/remetidos', '/patio/remetidos/novo'];
const CHAVE = 'patio-offline-aquecido-em';
const INTERVALO_MS = 30 * 60 * 1000;

/**
 * Pede ao service worker que guarde, neste aparelho, as telas do Pátio e os arquivos que elas
 * usam — assim o Pátio abre e funciona sem internet. Roda com internet, no máximo a cada 30 min.
 */
export function AquecerOffline() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelado = false;

    async function aquecer(forcar = false) {
      if (!navigator.onLine) return;
      try {
        const ultimo = Number(localStorage.getItem(CHAVE) ?? 0);
        if (!forcar && Date.now() - ultimo < INTERVALO_MS) return;
        const registro = await navigator.serviceWorker.ready;
        if (cancelado || !registro.active) return;
        registro.active.postMessage({ tipo: 'aquecer-patio', urls: TELAS_DO_PATIO });
        localStorage.setItem(CHAVE, String(Date.now()));
      } catch {
        // Sem service worker ou sem armazenamento: o Pátio continua funcionando online.
      }
    }

    void aquecer();
    const aoFicarOnline = () => void aquecer();
    window.addEventListener('online', aoFicarOnline);
    return () => {
      cancelado = true;
      window.removeEventListener('online', aoFicarOnline);
    };
  }, []);

  return null;
}
