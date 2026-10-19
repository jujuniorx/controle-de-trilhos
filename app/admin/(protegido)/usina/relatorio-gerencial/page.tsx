import { montarDadosRelatorio, type SetorRelatorio } from '@/lib/services/onePageUsina';
import { GraficoBarras } from '@/components/usina/GraficoBarras';
import { ehIsoValido } from '@/lib/usina/periodo';

export const dynamic = 'force-dynamic';

const br = (iso: string) => iso.split('-').reverse().join('/');

/** Um setor: cabeçalho colorido, tabela Dia | Mês e o gráfico dos dias do mês. */
function Setor({ s, rotulosDias, largo = false }: { s: SetorRelatorio; rotulosDias: string[]; largo?: boolean }) {
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
function Resumo({ rotulo, cor, dia, mes }: { rotulo: string; cor: string; dia: string; mes: string }) {
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

export default async function RelatorioGerencialUsina({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const params = await searchParams;
  const data = ehIsoValido(params.data) ? params.data : new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const dados = await montarDadosRelatorio(data);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <a className="btn btn-primary h-11" href={`/api/usina/relatorio-gerencial/pdf?data=${data}`}>Baixar PDF</a>
        <a className="btn btn-ghost h-11" href={`/admin/usina?data=${data}`}>Voltar</a>
        <form action="" className="flex items-center gap-2 text-sm">
          <label htmlFor="data">Dia</label>
          <input id="data" name="data" type="date" defaultValue={data} className="h-11" />
          <button className="btn btn-ghost h-11" type="submit">Ver</button>
        </form>
      </div>

      <article className="space-y-4 rounded-2xl bg-slate-50 p-5 text-slate-900">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-slate-900 pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Controle de Trilhos</p>
            <h1 className="text-2xl font-extrabold tracking-tight">Relatório gerencial</h1>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Dia de referência</p>
            <p className="text-lg font-bold tabular-nums">{br(data)}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dados.resumo.map((r) => (
            <Resumo key={r.rotulo} rotulo={r.rotulo} cor={r.cor} dia={r.dia} mes={r.mes} />
          ))}
        </div>

        <p className="text-xs text-slate-500">Cada setor mostra o valor do dia e o acumulado do mês, com o gráfico dos dias do mês.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {dados.setores.slice(0, 3).map((s) => (
            <Setor key={s.titulo} s={s} rotulosDias={dados.rotulosDias} />
          ))}
        </div>
        <div className="grid gap-4">
          {dados.setores.slice(3).map((s) => (
            <Setor key={s.titulo} s={s} rotulosDias={dados.rotulosDias} largo />
          ))}
        </div>
      </article>
    </main>
  );
}
