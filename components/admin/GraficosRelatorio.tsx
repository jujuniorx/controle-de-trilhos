import type { CSSProperties } from 'react';
import { fmtPeso } from '@/lib/format';
import type { DadosGraficos, ItemRanking } from '@/lib/services/graficosRelatorio';

const idx = (n: number) => ({ '--i': n }) as CSSProperties;

/** Cor de cada fatia pela posição (ordem fixa); "Outros" sempre no cinza neutro. */
function corDa(i: ItemRanking, indice: number): string {
  return i.rotulo === 'Outros' ? 'var(--viz-outros)' : `var(--viz-${indice + 1})`;
}

const GAP = 0.8; // vão entre fatias, em % da circunferência

function Donut({ titulo, itens, vazio }: { titulo: string; itens: ItemRanking[]; vazio: string }) {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  let inicio = 0;
  const fatias = itens.map((item, indice) => {
    const pct = total > 0 ? (item.valor / total) * 100 : 0;
    const f = { item, indice, pct, inicio };
    inicio += pct;
    return f;
  });
  const resumo = itens.map((i) => `${i.rotulo}: ${fmtPeso(i.valor)} t`).join('; ');

  return (
    <div className="card grafico">
      <h3 className="card-title">{titulo}</h3>
      {total <= 0 ? (
        <p className="text-sm text-ink-dim">{vazio}</p>
      ) : (
        <div className="donut-wrap">
          <svg viewBox="0 0 42 42" className="donut" role="img" aria-label={`${titulo}. ${resumo}`}>
            <circle className="donut-trilha" cx="21" cy="21" r="15.9155" fill="none" strokeWidth="5.5" />
            <g transform="rotate(-90 21 21)">
              {fatias.map(({ item, indice, pct, inicio: ini }) => {
                const tam = fatias.length === 1 ? 100 : Math.max(pct - GAP, 0.4);
                return (
                  <circle
                    key={item.rotulo}
                    className="donut-fatia"
                    cx="21"
                    cy="21"
                    r="15.9155"
                    fill="none"
                    strokeWidth="5.5"
                    stroke={corDa(item, indice)}
                    strokeDasharray={`${tam} ${100 - tam}`}
                    strokeDashoffset={-(ini + (fatias.length === 1 ? 0 : GAP / 2))}
                    style={idx(indice)}
                  >
                    <title>{`${item.rotulo}: ${fmtPeso(item.valor)} t (${pct.toFixed(1).replace('.', ',')}%)`}</title>
                  </circle>
                );
              })}
            </g>
            <text x="21" y="20.5" textAnchor="middle" className="donut-total">{fmtPeso(total)}</text>
            <text x="21" y="25.5" textAnchor="middle" className="donut-unidade">toneladas</text>
          </svg>
          <ul className="donut-legenda">
            {fatias.map(({ item, indice, pct }) => (
              <li key={item.rotulo} style={idx(indice)}>
                <i className="grafico-cor" style={{ background: corDa(item, indice) }} />
                <span className="donut-nome">{item.rotulo}</span>
                <span className="donut-valor">{fmtPeso(item.valor)} t</span>
                <span className="donut-pct">{pct.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Ranking({ titulo, itens, vazio }: { titulo: string; itens: ItemRanking[]; vazio: string }) {
  const max = Math.max(...itens.map((i) => i.valor), 0);
  return (
    <div className="card grafico">
      <h3 className="card-title">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-sm text-ink-dim">{vazio}</p>
      ) : (
        <ul className="grafico-rank">
          {itens.map((i, n) => (
            <li key={i.rotulo} style={idx(n)}>
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
    <section className="grafico-area space-y-3" aria-labelledby="titulo-graficos">
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
          {dados.serie.map((p, n) => (
            <div
              key={p.rotulo}
              className="grafico-grupo"
              style={idx(n)}
              title={`${p.rotulo} — recebido ${fmtPeso(p.recebido)} t, enviado ${fmtPeso(p.enviado)} t`}
            >
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

      <div className="grid gap-3 lg:grid-cols-2">
        <Donut titulo="Toneladas por perfil" itens={dados.perfis} vazio="Sem peso registrado nesses filtros." />
        <Donut titulo="Toneladas por material" itens={dados.materiais} vazio="Sem peso registrado nesses filtros." />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Ranking titulo="Recebido por origem (t)" itens={dados.origens} vazio="Nenhum recebimento nesses filtros." />
        <Ranking titulo="Enviado por destino (t)" itens={dados.destinos} vazio="Nenhum remetido nesses filtros." />
      </div>
    </section>
  );
}
