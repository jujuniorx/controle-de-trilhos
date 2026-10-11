'use client';

import { useEffect, useState } from 'react';
import { LogoAnimada } from '@/components/ui/LogoAnimada';
import { jaInstalado } from '@/lib/pwa/instalacao';

const CHAVE = 'ct_abertura';

/** Tela de abertura curta, só no app instalado e uma vez por sessão (como num app de verdade). */
export function AberturaApp() {
  const [visivel, setVisivel] = useState(false);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (!jaInstalado()) return;
    try {
      if (sessionStorage.getItem(CHAVE)) return;
      sessionStorage.setItem(CHAVE, '1');
    } catch {
      /* sem armazenamento: mostra mesmo assim */
    }
    setVisivel(true);
    const sair = setTimeout(() => setSaindo(true), 1300);
    const fim = setTimeout(() => setVisivel(false), 1800);
    return () => {
      clearTimeout(sair);
      clearTimeout(fim);
    };
  }, []);

  if (!visivel) return null;
  return (
    <div className={`abertura ${saindo ? 'abertura-saindo' : ''}`} role="presentation">
      <LogoAnimada size={96} />
      <p className="abertura-nome">Controle de Trilhos</p>
    </div>
  );
}
