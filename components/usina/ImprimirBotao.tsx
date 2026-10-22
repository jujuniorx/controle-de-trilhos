'use client';

/** Abre a janela de impressão do navegador, onde dá para salvar como PDF. */
export function ImprimirBotao({ rotulo = 'Imprimir / salvar PDF' }: { rotulo?: string }) {
  return (
    <button type="button" className="btn btn-primary h-11" onClick={() => window.print()}>
      {rotulo}
    </button>
  );
}
