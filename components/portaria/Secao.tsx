import type { ReactNode } from 'react';

/** Bloco de campos do cartão da Portaria: título em caixa-alta (12 px) + grade responsiva. */
export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-line bg-surface-2/50 p-3">
      <legend className="px-1.5 text-xs font-bold uppercase tracking-[.08em] text-ink-muted">{titulo}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** Caixa de observação para o Pátio (usa só tokens do tema, vale no claro e no escuro). */
export function CampoObservacao({ id, valor, aoMudar, desabilitado }: { id: string; valor: string; aoMudar: (v: string) => void; desabilitado: boolean }) {
  return (
    <div className="field rounded-xl border border-warn/40 bg-warn/10 p-3">
      <label htmlFor={id}>Observação para o Pátio (opcional)</label>
      <textarea
        id={id}
        rows={3}
        maxLength={500}
        className="min-h-[5rem] w-full"
        placeholder="Ex.: caminhão com lona rasgada, motorista só chega às 14h..."
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        disabled={desabilitado}
      />
      <p className="mt-1 text-right text-xs text-ink-muted tabular-nums">{valor.length}/500</p>
    </div>
  );
}

export const ICONE_CAMINHAO = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0-.01M17 18.5a1.5 1.5 0 1 0 0-.01" />
  </svg>
);
