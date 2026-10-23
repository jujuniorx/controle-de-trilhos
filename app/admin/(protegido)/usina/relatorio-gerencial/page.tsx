import { montarDadosRelatorio, montarTrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { Setor, Resumo, TrilheirosBloco } from '@/components/usina/RelatorioSetores';
import { ehIsoValido, faixaSemanaSegSex } from '@/lib/usina/periodo';
import { BotaoCompartilharPdf } from '@/components/usina/BotaoCompartilharPdf';

export const dynamic = 'force-dynamic';

const br = (iso: string) => iso.split('-').reverse().join('/');

export default async function RelatorioGerencialUsina({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const params = await searchParams;
  const data = ehIsoValido(params.data) ? params.data : new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const dados = await montarDadosRelatorio(data);
  const tril = await montarTrilheirosRelatorio(data);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <BotaoCompartilharPdf url={`/api/usina/relatorio-gerencial/pdf?data=${data}`} nomeArquivo={`relatorio-gerencial-usina-${data}.pdf`} titulo={`Relatório da usina ${br(data)}`} />
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
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Semana (segunda a quinta)</p>
            <p className="text-lg font-bold tabular-nums">{faixaSemanaSegSex(data)}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dados.resumo.map((r) => (
            <Resumo key={r.rotulo} rotulo={r.rotulo} cor={r.cor} dia={r.dia} mes={r.mes} />
          ))}
        </div>

        <p className="text-xs text-slate-500">Cada setor mostra o valor do dia e o acumulado da semana (segunda a quinta), com o gráfico desses dias.</p>
        <div className="grid gap-4">
          {dados.setores.filter((s) => s.titulo !== 'Trilheiros').map((s) => (
            <Setor key={s.titulo} s={s} rotulosDias={dados.rotulosDias} largo />
          ))}
        </div>
        <TrilheirosBloco t={tril} />
      </article>
    </main>
  );
}
