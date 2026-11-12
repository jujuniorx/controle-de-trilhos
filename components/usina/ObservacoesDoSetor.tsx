// Observação do dia de um setor: fica dentro do próprio cartão do setor e é salva com o formulário dele.
export function ObservacoesDoSetor({
  setor,
  dias,
  obs,
  antigas = false,
}: {
  setor: string;
  dias: { data: string; rotulo: string }[];
  obs: Record<string, string>;
  /** Setor que passou a lançar a observação em cada item: o bloco só aparece para passar o texto antigo para lá. */
  antigas?: boolean;
}) {
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <div>
        <p className="text-sm font-semibold">{antigas ? 'Observações antigas do setor' : 'Observações do dia'}</p>
        <p className="text-xs text-ink-muted">
          {antigas
            ? 'Agora a observação é lançada em cada item, na tabela acima. Passe o texto para lá e apague aqui.'
            : 'O que justifica a produção do dia (falta de energia, parada, extra).'}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dias.map((d) => (
          <label key={d.data} className="field" data-dia={d.data}>
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
