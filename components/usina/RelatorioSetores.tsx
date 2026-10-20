import { GraficoBarras } from '@/components/usina/GraficoBarras';
import type { SetorRelatorio } from '@/lib/services/onePageUsina';

/** Um setor: cabeçalho colorido, tabela Dia | Mês e o gráfico dos dias do mês. */
export function Setor({ s, rotulosDias, largo = false }: { s: SetorRelatorio; rotulosDias: string[]; largo?: boolean }) {
  const tabela = (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-slate-500">
          <th className="pb-1 text-left font-semibold"> </th>
          <th className="pb-1 text-right font-semibold">Dia</th>
          <th className="pb-1 text-right font-semibold">Mês</th>
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
      <p className="mt-1 text-right text-[11px] font-semibold text-slate-500">Dias do mês: 1 a {rotulosDias.length} (embaixo)</p>
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
          <div>{tabela}</div>
          <div className="border-t border-slate-100 pt-2 md:border-l md:border-t-0 md:pl-4 md:pt-0">{grafico}</div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 p-4">
          {tabela}
          <div className="mt-auto border-t border-slate-100 pt-2">{grafico}</div>
        </div>
      )}
    </section>
  );
}

/** Indicador de setor: o valor do dia e o do mês em blocos separados. */
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
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Do mês</p>
          <p className="text-base font-bold tabular-nums" style={{ color: cor }}>{mes}</p>
        </div>
      </div>
    </div>
  );
}

