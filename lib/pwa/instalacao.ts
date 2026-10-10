'use client';

import { useSyncExternalStore } from 'react';

// O navegador (Chrome/Android) dispara "beforeinstallprompt" UMA vez por carregamento de página.
// Guardamos o evento aqui, no escopo do módulo, para que qualquer botão "Instalar" do sistema
// (aviso do topo, tela inicial) consiga usá-lo mesmo depois de o aviso ter sido dispensado.

export interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let evento: EventoInstalacao | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evento = e as EventoInstalacao;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    evento = null;
    avisar();
  });
}

function assinar(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function jaInstalado(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function ehIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

/** O evento de instalação guardado (Android/Chrome) ou null. */
export function useEventoInstalacao(): EventoInstalacao | null {
  return useSyncExternalStore(assinar, () => evento, () => null);
}

/** Abre o diálogo de instalação do navegador. Devolve true se a pessoa aceitou. */
export async function instalarAgora(): Promise<boolean> {
  if (!evento) return false;
  const e = evento;
  await e.prompt();
  const { outcome } = await e.userChoice;
  evento = null;
  avisar();
  return outcome === 'accepted';
}
