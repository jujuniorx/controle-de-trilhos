// Observação do dia de um setor: fica dentro do próprio cartão do setor e é salva com o formulário dele.
export function ObservacoesDoSetor({
  setor,
  dias,
  obs,
}: {
  setor: string;
  dias: { data: string; rotulo: string }[];
  obs: Record<string, string>;
}) {
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <div>
        <p className="text-sm font-semibold">Observações do dia</p>
        <p className="text-xs text-ink-muted">O que justifica a produção do dia (falta de energia, parada, extra).</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dias.map((d) => (
          <label key={d.data} className="field">
            <span className="text-sm text-ink-muted">{d.rotulo}</span>
            <input
              name={`obsdia_${setor}_${d.data}`}
              defaultValue={obs[`${d.data}|${setor}`] ?? ''}
              maxLength={500}
              className="h-11"
              aria-label={`Observação ${setor} ${d.rotulo}`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
