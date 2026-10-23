import { montarDadosRelatorio, montarTrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { Setor, Resumo, TrilheirosBloco } from '@/components/usina/RelatorioSetores';
import { ehIsoValido, faixaSemanaSegSex } from '@/lib/usina/periodo';
import { ImprimirBotao } from '@/components/usina/ImprimirBotao';

export const dynamic = 'force-dynamic';

const SETORES = ['todos', 'estaleiro', 'geracao', 'composicoes', 'caminhao', 'trilheiros'] as const;
type ChaveSetor = (typeof SETORES)[number];

/** Titulo do setor no relatorio (igual ao usado em montarDadosRelatorio). */
const TITULO_SETOR: Record<Exclude<ChaveSetor, 'todos'>, string> = {
  estaleiro: 'Estaleiro de solda',
  geracao: 'Geração de trilho',
  composicoes: 'Recolhimento serra',
  caminhao: 'Caminhão de solda',
  trilheiros: 'Trilheiros',
};

/** Nome do relatorio de cada setor, como aparece no titulo da pagina. */
const TITULO_RELATORIO: Record<Exclude<ChaveSetor, 'todos'>, string> = {
  estaleiro: 'Relatório do estaleiro de solda',
  geracao: 'Relatório da geração de trilho',
  composicoes: 'Relatório do recolhimento serra',
  caminhao: 'Relatório do caminhão de solda',
  trilheiros: 'Relatório dos trilheiros',
};

const br = (iso: string) => iso.split('-').reverse().join('/');

export default async function ImprimirUsina({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; setor?: string }>;
}) {
  const params = await searchParams;
  const data = ehIsoValido(params.data) ? params.data : new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const setor: ChaveSetor = (SETORES as readonly string[]).includes(params.setor ?? '') ? (params.setor as ChaveSetor) : 'todos';

  const dados = await montarDadosRelatorio(data);
  const tril = await montarTrilheirosRelatorio(data);
  const setores = dados.setores.filter((s) => s.titulo !== 'Trilheiros' && (setor === 'todos' || s.titulo === TITULO_SETOR[setor]));
  const mostraTril = setor === 'todos' || setor === 'trilheiros';
  const resumo = dados.resumo.filter((r) => setor === 'todos' || r.grupo === TITULO_SETOR[setor]);
  const titulo = setor === 'todos' ? 'Relatório da usina' : TITULO_RELATORIO[setor];

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #relatorio-usina, #relatorio-usina * { visibility: visible; }
          #relatorio-usina { position: absolute; left: 0; top: 0; width: 100%; }
          .sem-impressao { display: none !important; }
          section { break-inside: avoid-page; }
        }
      `}</style>

      <div className="sem-impressao flex flex-wrap items-center gap-3">
        <ImprimirBotao />
        <a className="btn btn-ghost h-11" href={`/admin/usina?data=${data}`}>Voltar</a>
        <a className="btn btn-ghost h-11" href={`/admin/usina/relatorio-gerencial?data=${data}`}>Relatório gerencial</a>
      </div>

      <article id="relatorio-usina" className="space-y-4 rounded-2xl bg-slate-50 p-5 text-slate-900">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-slate-900 pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Controle de Trilhos</p>
            <h1 className="text-2xl font-extrabold tracking-tight">{titulo}</h1>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Semana (segunda a sexta)</p>
            <p className="text-lg font-bold tabular-nums">{faixaSemanaSegSex(data)}</p>
          </div>
        </header>

        {resumo.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {resumo.map((r) => (
              <Resumo key={r.rotulo} rotulo={r.rotulo} cor={r.cor} dia={r.dia} mes={r.mes} />
            ))}
          </div>
        )}

        {setor === 'todos' ? (
          <>
            <div className="grid gap-4">
              {setores.map((s) => (
                <Setor key={s.titulo} s={s} rotulosDias={dados.rotulosDias} largo />
              ))}
            </div>
          </>
        ) : (
          <div className="grid gap-4">
            {setores.map((s) => (
              <Setor key={s.titulo} s={s} rotulosDias={dados.rotulosDias} largo />
            ))}
          </div>
        )}
        {mostraTril && <TrilheirosBloco t={tril} />}
      </article>
    </main>
  );
}
