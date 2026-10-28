'use client';

/** Faixa que aparece quando o assistente reabriu com um lançamento já começado. */
export function AvisoRascunho({ resumo, aoDescartar }: { resumo: string; aoDescartar: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-ok/50 bg-ok/10 px-4 py-3">
      <p className="min-w-0 flex-1 text-sm text-ink">
        <b>Lançamento retomado.</b> {resumo} Tudo fica guardado neste aparelho enquanto você mede.
      </p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={aoDescartar}>
        Começar do zero
      </button>
    </div>
  );
}
