import { fmtPeso } from '@/lib/format';
import type { DadosGraficos, ItemRanking } from '@/lib/services/graficosRelatorio';

function Ranking({ titulo, itens, vazio }: { titulo: string; itens: ItemRanking[]; vazio: string }) {
  const max = Math.max(...itens.map((i) => i.valor), 0);
  return (
    <div className="card grafico">
      <h3 className="card-title">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-sm text-ink-dim">{vazio}</p>
      ) : (
        <ul className="grafico-rank">
          {itens.map((i) => (
            <li key={i.rotulo}>
              <span className="grafico-rank-nome" title={i.rotulo}>{i.rotulo}</span>
              <span className="grafico-rank-trilha" aria-hidden>
                <span className="grafico-rank-barra" style={{ width: `${max > 0 ? Math.max((i.valor / max) * 100, 2) : 0}%` }} />
              </span>
              <span className="grafico-rank-valor">{fmtPeso(i.valor)} t</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GraficosRelatorio({ dados }: { dados: DadosGraficos }) {
  const max = Math.max(...dados.serie.flatMap((p) => [p.recebido, p.enviado]), 0);
  const altura = (v: number) => (max > 0 && v > 0 ? Math.max((v / max) * 100, 3) : 0);
  const resumoSerie = dados.serie
    .map((p) => `${p.rotulo}: recebido ${fmtPeso(p.recebido)} t, enviado ${fmtPeso(p.enviado)} t`)
    .join('; ');

  return (
    <section className="space-y-3" aria-labelledby="titulo-graficos">
      <h2 id="titulo-graficos" className="font-condensed text-base font-semibold uppercase tracking-wide text-ink">
        Gráficos <span className="font-sans text-xs font-normal normal-case tracking-normal text-ink-dim">(seguem os filtros acima)</span>
      </h2>

      <div className="card grafico">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="card-title">Toneladas por {dados.granularidade === 'semana' ? 'semana' : 'mês'}</h3>
          <div className="grafico-legenda">
            <span><i className="grafico-cor grafico-cor-rec" /> Recebido</span>
            <span><i className="grafico-cor grafico-cor-env" /> Enviado</span>
          </div>
        </div>
        <div className="grafico-colunas" role="img" aria-label={`Toneladas por ${dados.granularidade}. ${resumoSerie}`}>
          {dados.serie.map((p) => (
            <div key={p.rotulo} className="grafico-grupo">
              <div className="grafico-par">
                <div className="grafico-col">
                  {p.recebido > 0 && <span className="grafico-val">{fmtPeso(p.recebido)}</span>}
                  <span className="grafico-barra grafico-cor-rec" style={{ height: `${altura(p.recebido)}%` }} />
                </div>
                <div className="grafico-col">
                  {p.enviado > 0 && <span className="grafico-val">{fmtPeso(p.enviado)}</span>}
                  <span className="grafico-barra grafico-cor-env" style={{ height: `${altura(p.enviado)}%` }} />
                </div>
              </div>
              <span className="grafico-eixo">{p.rotulo}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-dim">
          {dados.granularidade === 'semana' ? 'Semanas começam na segunda-feira.' : null}
          {dados.serieTruncada ? ' Mostrando só os 12 períodos mais recentes.' : null}
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Ranking titulo="Recebido por origem (t)" itens={dados.origens} vazio="Nenhum recebimento nesses filtros." />
        <Ranking titulo="Enviado por destino (t)" itens={dados.destinos} vazio="Nenhum remetido nesses filtros." />
        <Ranking titulo="Toneladas por perfil" itens={dados.perfis} vazio="Sem peso registrado nesses filtros." />
      </div>
    </section>
  );
}
