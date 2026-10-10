'use client';

import { useEffect } from 'react';
// Importado aqui para o ouvinte de instalação existir desde o primeiro carregamento de qualquer página.
import '@/lib/pwa/instalacao';

export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
  }, []);

  return null;
}
