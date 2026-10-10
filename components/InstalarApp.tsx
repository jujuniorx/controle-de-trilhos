'use client';

import { useEffect, useState } from 'react';

type EventoInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const CHAVE_DISPENSADO = 'ct_instalar_dispensado';

function lerDispensado(): boolean {
  try {
    return localStorage.getItem(CHAVE_DISPENSADO) === '1';
  } catch {
    return false;
  }
}

/**
 * Convite para instalar o sistema como aplicativo.
 * Android/Chrome: botão "Instalar" (evento beforeinstallprompt).
 * iPhone/iPad (Safari): não existe instalação por botão, então mostra o passo a passo.
 * Some sozinho quando já está instalado (modo standalone) ou depois de dispensado.
 */
export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalacao | null>(null);
  const [ios, setIos] = useState(false);
  const [oculto, setOculto] = useState(true);

  useEffect(() => {
    const instalado =
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (instalado || lerDispensado()) return;

    const ua = navigator.userAgent;
    const ehIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
    if (ehIos) {
      setIos(true);
      setOculto(false);
    }

    function aoOferecer(e: Event) {
      e.preventDefault();
      setEvento(e as EventoInstalacao);
      setOculto(false);
    }
    function aoInstalar() {
      setOculto(true);
    }
    window.addEventListener('beforeinstallprompt', aoOferecer);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoOferecer);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  function dispensar() {
    setOculto(true);
    try {
      localStorage.setItem(CHAVE_DISPENSADO, '1');
    } catch {
      /* sem armazenamento: só some até recarregar */
    }
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    if (outcome === 'accepted') setOculto(true);
  }

  if (oculto || (!evento && !ios)) return null;

  return (
    <div className="instalar-app" role="region" aria-label="Instalar aplicativo">
      <div className="instalar-app-texto">
        <strong>Instale o Controle de Trilhos</strong>
        {evento ? (
          <span>Abre em tela cheia, como um aplicativo, direto da tela inicial.</span>
        ) : (
          <span>
            No Safari, toque em <b>Compartilhar</b> (quadrado com seta) e depois em <b>Adicionar à Tela de Início</b>.
          </span>
        )}
      </div>
      <div className="instalar-app-acoes">
        {evento && (
          <button type="button" className="btn btn-primary" onClick={instalar}>
            Instalar
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={dispensar}>
          Agora não
        </button>
      </div>
    </div>
  );
}
