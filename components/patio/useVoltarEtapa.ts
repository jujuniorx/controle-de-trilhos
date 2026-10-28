'use client';

import { useEffect } from 'react';

/**
 * Faz o botão Voltar do aparelho (Android) voltar uma etapa do assistente em vez de
 * sair da tela. Sem isso, um gesto de voltar no meio de uma medição tira a pessoa do
 * lançamento inteiro — que era o jeito mais fácil de perder trabalho já feito no pátio.
 *
 * Como funciona: cada etapa acima da primeira empurra uma entrada no histórico do
 * navegador. Quando o aparelho volta, a entrada é consumida e o assistente desce uma
 * etapa. Na primeira etapa não há entrada empurrada, então o Voltar sai normalmente.
 */
export function useVoltarEtapa(etapa: number, voltarPara: (etapa: number) => void): void {
  useEffect(() => {
    if (etapa <= 1) return;
    const marca = { assistenteEtapa: etapa };
    window.history.pushState(marca, '');
    const aoVoltar = () => voltarPara(etapa - 1);
    window.addEventListener('popstate', aoVoltar);
    return () => window.removeEventListener('popstate', aoVoltar);
  }, [etapa, voltarPara]);
}
