'use client';

import { IconeImprimir } from '@/components/icones/Icones';

/** Abre a caixa de impressao do navegador (a planilha do dia). */
export function BotaoImprimirPagina() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-secondary btn-sm no-print">
      <IconeImprimir size={14} /> Imprimir
    </button>
  );
}
