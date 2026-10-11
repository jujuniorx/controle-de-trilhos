/** Barra de etapas do formulário: segmentos que se enchem conforme o avanço. */
export function ProgressoEtapas({ etapa, total }: { etapa: number; total: number }) {
  return (
    <div className="progresso" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={etapa} aria-label={`Etapa ${etapa} de ${total}`}>
      <div className="progresso-segmentos">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`progresso-seg ${i < etapa ? 'progresso-seg-ok' : ''} ${i === etapa - 1 ? 'progresso-seg-atual' : ''}`} />
        ))}
      </div>
      <p className="progresso-texto">
        Etapa {etapa} de {total}
      </p>
    </div>
  );
}
