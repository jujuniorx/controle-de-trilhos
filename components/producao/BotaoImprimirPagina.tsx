'use client';

/** Abre a caixa de impressao do navegador (a planilha do dia). */
export function BotaoImprimirPagina() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary no-print">
      Imprimir planilha
    </button>
  );
}
