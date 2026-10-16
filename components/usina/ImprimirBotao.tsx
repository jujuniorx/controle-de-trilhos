'use client';

/** Abre a janela de impressão do navegador, que salva como PDF. */
export function ImprimirBotao() {
  return (
    <button type="button" className="btn btn-primary h-11" onClick={() => window.print()}>
      Imprimir / salvar PDF
    </button>
  );
}
