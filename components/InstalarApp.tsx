'use client';

import { useEffect, useState } from 'react';
import { ehIos, instalarAgora, jaInstalado, useEventoInstalacao } from '@/lib/pwa/instalacao';

const CHAVE_DISPENSADO = 'ct_instalar_dispensado_em';
const DIAS_SEM_INCOMODAR = 7;

function dispensadoRecentemente(): boolean {
  try {
    const em = Number(localStorage.getItem(CHAVE_DISPENSADO));
    return em > 0 && Date.now() - em < DIAS_SEM_INCOMODAR * 86_400_000;
  } catch {
    return false;
  }
}

function PassoAPassoIos() {
  return (
    <span>
      No Safari, toque em <b>Compartilhar</b> (quadrado com seta) e depois em <b>Adicionar à Tela de Início</b>.
    </span>
  );
}

/**
 * Aviso no topo para instalar o sistema como aplicativo. "Agora não" esconde por 7 dias;
 * a qualquer momento dá para instalar pelo botão "Instalar aplicativo" da tela inicial
 * (ver BotaoInstalar) ou pelo menu do navegador.
 */
export function InstalarApp() {
  const evento = useEventoInstalacao();
  const [ios, setIos] = useState(false);
  const [oculto, setOculto] = useState(true);

  useEffect(() => {
    if (jaInstalado() || dispensadoRecentemente()) return;
    setIos(ehIos());
    setOculto(false);
  }, []);

  function dispensar() {
    setOculto(true);
    try {
      localStorage.setItem(CHAVE_DISPENSADO, String(Date.now()));
    } catch {
      /* sem armazenamento: só some até recarregar */
    }
  }

  async function instalar() {
    if (await instalarAgora()) setOculto(true);
  }

  if (oculto || (!evento && !ios)) return null;

  return (
    <div className="instalar-app" role="region" aria-label="Instalar aplicativo">
      <div className="instalar-app-texto">
        <strong>Instale o Controle de Trilhos</strong>
        {evento ? <span>Abre em tela cheia, como um aplicativo, direto da tela inicial.</span> : <PassoAPassoIos />}
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

/**
 * Botão permanente "Instalar aplicativo" (fica na tela inicial). Aparece enquanto o app não
 * estiver instalado: no Android abre o diálogo de instalação; no iPhone mostra o passo a passo;
 * nos demais casos explica o caminho pelo menu do navegador.
 */
export function BotaoInstalar({ className = '' }: { className?: string }) {
  const evento = useEventoInstalacao();
  const [visivel, setVisivel] = useState(false);
  const [ios, setIos] = useState(false);
  const [ajuda, setAjuda] = useState(false);

  useEffect(() => {
    setVisivel(!jaInstalado());
    setIos(ehIos());
  }, []);

  if (!visivel) return null;

  async function aoClicar() {
    if (evento) await instalarAgora();
    else setAjuda((v) => !v);
  }

  return (
    <div className={className}>
      <button type="button" className="btn btn-ghost btn-lg" onClick={aoClicar}>
        Instalar aplicativo
      </button>
      {ajuda && (
        <p className="mt-2 text-sm text-ink-muted">
          {ios ? (
            <PassoAPassoIos />
          ) : (
            <span>
              No Chrome, abra o menu <b>⋮</b> e toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).
            </span>
          )}
        </p>
      )}
    </div>
  );
}
