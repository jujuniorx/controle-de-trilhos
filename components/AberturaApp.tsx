'use client';

import { CordaoTls } from '@/components/ui/CordaoTls';
import { useEffect, useState } from 'react';
import { LogoAnimada } from '@/components/ui/LogoAnimada';
import { FundoTrilhos } from '@/components/ui/FundoTrilhos';
import { jaInstalado } from '@/lib/pwa/instalacao';

const CHAVE = 'ct_abertura';

/** Tela de abertura do app instalado, uma vez por sessão: a abertura completa da cena da ferrovia (cerca de 3 s). */
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
    const sair = setTimeout(() => setSaindo(true), 2700);
    const fim = setTimeout(() => setVisivel(false), 3200);
    return () => {
      clearTimeout(sair);
      clearTimeout(fim);
    };
  }, []);

  if (!visivel) return null;
  return (
    <div className={`abertura ${saindo ? 'abertura-saindo' : ''}`} role="presentation">
      <FundoTrilhos modo="abertura" intro="completa" />
      <div className="abertura-marca">
        <LogoAnimada size={96} />
        <p className="abertura-nome">Controle de Trilhos</p>
        <CordaoTls />
      </div>
    </div>
  );
}
