import { GraficoBarras } from '@/components/usina/GraficoBarras';
import type { SetorRelatorio, TrilheirosRelatorio } from '@/lib/services/onePageUsina';

/** Um setor: cabeçalho colorido, tabela Dia | Semana e o gráfico de segunda a sexta. */
export function Setor({ s, rotulosDias, largo = false }: { s: SetorRelatorio; rotulosDias: string[]; largo?: boolean }) {
  const tabela = (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-slate-500">
          <th className="pb-1 text-left font-semibold"> </th>
          <th className="pb-1 text-right font-semibold">Dia</th>
          <th className="pb-1 text-right font-semibold">Semana</th>
        </tr>
      </thead>
      <tbody>
        {s.linhas.map((l) => (
          <tr key={l.rotulo} className="border-t border-slate-100">
            <td className="py-1 text-slate-700">{l.rotulo}</td>
            <td className="py-1 text-right font-medium tabular-nums text-slate-900">{l.dia}</td>
            <td className="py-1 text-right font-bold tabular-nums" style={{ color: s.cor }}>{l.mes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const grafico = s.grafico ? (
    <div>
      <GraficoBarras
        titulo={s.grafico.titulo}
        rotulos={rotulosDias}
        series={s.grafico.series.map((x) => ({ nome: x.nome, cor: x.cor, valores: x.valores }))}
      />
      <p className="mt-1 text-right text-[11px] font-semibold text-slate-500">Semana de segunda a sexta</p>
    </div>
  ) : (
    <p className="py-6 text-center text-xs text-slate-400">Sem gráfico diário para este setor.</p>
  );
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white break-inside-avoid">
      <header className="px-4 py-2.5 text-white" style={{ background: s.cor }}>
        <span className="text-sm font-bold uppercase tracking-wide">{s.titulo}</span>
      </header>
      {largo ? (
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="shrink-0">{tabela}</div>
          <div className="shrink-0 border-t border-slate-100 pt-2 md:border-l md:border-t-0 md:pl-4 md:pt-0">{grafico}</div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="shrink-0">{tabela}</div>
          <div className="mt-auto shrink-0 border-t border-slate-100 pt-2">{grafico}</div>
        </div>
      )}
    </section>
  );
}

/** Indicador de setor: o valor do dia e o da semana em blocos separados. */
export function Resumo({ rotulo, cor, dia, mes }: { rotulo: string; cor: string; dia: string; mes: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3" style={{ borderTop: `3px solid ${cor}` }}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{rotulo}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-slate-50 p-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Do dia</p>
          <p className="text-base font-bold tabular-nums text-slate-900">{dia}</p>
        </div>
        <div className="rounded-md p-2" style={{ background: `${cor}14` }}>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Da semana</p>
          <p className="text-base font-bold tabular-nums" style={{ color: cor }}>{mes}</p>
        </div>
      </div>
    </div>
  );
}


const brData = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

/** Trilheiros: indicadores de topo e uma linha por equipe, como no informativo da Rumo. */
export function TrilheirosBloco({ t }: { t: TrilheirosRelatorio }) {
  const cor = '#0891b2';
  const cards = [
    { rotulo: 'Trilheiros ativos', valor: String(t.ativos) },
    { rotulo: 'Total de barras', valor: String(t.totalBarras) },
    { rotulo: 'Barras descarregadas', valor: String(t.descarregadas) },
    { rotulo: 'Progresso geral', valor: t.progresso == null ? '—' : `${t.progresso}%` },
  ];
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white break-inside-avoid">
      <header className="px-4 py-2.5 text-white" style={{ background: cor }}>
        <span className="text-sm font-bold uppercase tracking-wide">Trilheiros</span>
      </header>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {cards.map((c) => (
            <div key={c.rotulo} className="rounded-lg border border-slate-200 p-3" style={{ borderTop: `3px solid ${cor}` }}>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{c.rotulo}</p>
              <p className="text-lg font-bold tabular-nums text-slate-900">{c.valor}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                <th className="pb-1 text-left font-semibold">Trilheiro</th>
                <th className="pb-1 text-right font-semibold">Giro (dias)</th>
                <th className="pb-1 text-right font-semibold">Partida da usina</th>
                <th className="pb-1 text-left font-semibold">Local atual</th>
                <th className="pb-1 text-right font-semibold">Barras desc. / total</th>
                <th className="pb-1 text-right font-semibold">% exec.</th>
                <th className="pb-1 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {t.equipes.map((e) => (
                <tr key={e.trilheiro} className="border-t border-slate-100">
                  <td className="py-1.5 font-bold text-slate-900">{e.trilheiro}</td>
                  <td className="py-1.5 text-right tabular-nums">{e.giroDias ?? '—'}</td>
                  <td className="py-1.5 text-right tabular-nums">{brData(e.partida)}</td>
                  <td className="py-1.5">{e.local ?? '—'}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{e.descarregados} / {e.carregados}</td>
                  <td className="py-1.5 text-right tabular-nums">{e.percentual == null ? '—' : `${e.percentual}%`}</td>
                  <td className="py-1.5">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${e.status === 'Sem giro' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-800'}`}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
