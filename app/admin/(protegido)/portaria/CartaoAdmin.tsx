import type { ReactNode } from 'react';

export interface LinhaDado {
  rotulo: string;
  valor: ReactNode;
}

/** Cartão padrão do painel da Portaria: o mesmo layout para caminhões e remetidos. Só consulta. */
export function CartaoAdmin({
  titulo,
  subtitulo,
  situacao,
  badge,
  dados,
  observacao,
  acoes,
}: {
  titulo: string;
  subtitulo: string | null;
  situacao: string;
  badge: string;
  dados: LinhaDado[];
  observacao: string | null;
  acoes: ReactNode;
}) {
  return (
    <article className="card space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{titulo}</p>
          {subtitulo && <p className="text-sm text-ink-muted">{subtitulo}</p>}
        </div>
        <span className={`badge shrink-0 ${badge}`} data-situacao={situacao}>
          {situacao}
        </span>
      </header>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {dados.map((d) => (
          <div key={d.rotulo} className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-ink-dim">{d.rotulo}</dt>
            <dd className="break-words text-ink">{d.valor}</dd>
          </div>
        ))}
      </dl>

      {observacao && (
        <p className="whitespace-pre-wrap rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-ink">
          <span className="font-semibold text-warn">Observação da Portaria: </span>
          {observacao}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">{acoes}</div>
    </article>
  );
}
