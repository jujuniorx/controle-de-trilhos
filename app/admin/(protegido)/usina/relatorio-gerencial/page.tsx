import { montarDadosRelatorio, montarTrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { Setor, Resumo, TrilheirosBloco, CaminhoesBloco, EstoqueTlsBloco } from '@/components/usina/RelatorioSetores';
import { ObservacaoDoDia } from '@/components/usina/ObservacoesSetorRelatorio';
import { ehIsoValido, modoValido, linksModo, rotuloPeriodo, colunasValidas, TODAS_COLUNAS, type Coluna } from '@/lib/usina/periodo';
import { BotaoCompartilharPdf } from '@/components/usina/BotaoCompartilharPdf';

export const dynamic = 'force-dynamic';

const br = (iso: string) => iso.split('-').reverse().join('/');

const NOME_COLUNA: Record<Coluna, string> = { dia: 'Dia', semana: 'Semana', mes: 'No mês' };

export default async function RelatorioGerencialUsina({ searchParams }: { searchParams: Promise<{ data?: string; modo?: string; col?: string | string[] }> }) {
  const params = await searchParams;
  const modo = modoValido(params.modo);
  const colunas = colunasValidas(params.col);
  const data = ehIsoValido(params.data) ? params.data : new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const dados = await montarDadosRelatorio(data);
  const tril = await montarTrilheirosRelatorio(data);
  // O estoque de TLS sai do cartão do estaleiro e vai para uma faixa própria, como no PDF.
  const estaleiro = dados.setores.find((s) => s.titulo === 'Estaleiro de solda');
  const iTls = estaleiro ? estaleiro.linhas.findIndex((l) => l.secao?.startsWith('Estoque TLS')) : -1;
  const tlsLinhas = estaleiro && iTls >= 0 ? estaleiro.linhas.slice(iTls) : [];
  const setoresTela = dados.setores.map((s) => (s.titulo === 'Estaleiro de solda' && iTls >= 0 ? { ...s, linhas: s.linhas.slice(0, iTls) } : s));

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Formato do relatório">
          {linksModo('/admin/usina/relatorio-gerencial', modo, { data }, true).map((l) => (
            <a key={l.modo} href={l.href} aria-current={l.ativo ? 'true' : undefined} className={`h-11 px-4 leading-[2.75rem] text-sm font-semibold ${l.ativo ? 'bg-slate-900 text-white' : 'bg-surface text-ink-muted'}`}>{l.rotulo}</a>
          ))}
        </div>
        <form action="" method="get" className="flex flex-wrap items-center gap-2 text-sm" aria-label="Colunas do relatório">
          <input type="hidden" name="data" value={data} />
          <input type="hidden" name="modo" value={modo} />
          {TODAS_COLUNAS.map((c) => (
            <label key={c} className="flex h-11 items-center gap-2 rounded-lg border border-line px-3">
              <input type="checkbox" name="col" value={c} defaultChecked={colunas.includes(c)} />
              {NOME_COLUNA[c]}
            </label>
          ))}
          <button className="btn btn-ghost h-11" type="submit">Aplicar colunas</button>
        </form>
        <BotaoCompartilharPdf url={`/api/usina/relatorio-gerencial/pdf?data=${data}&modo=${modo}&pagina=tudo&col=${colunas.join(',')}`} nomeArquivo={`relatorio-gerencial-usina-${data}.svg`} titulo={`Relatório da usina ${br(data)}`} rotulo="Imagem do relatório" />
        <a className="btn btn-ghost h-11" href={`/admin/usina?data=${data}`}>Voltar</a>
        <form action="" className="flex items-center gap-2 text-sm">
          <label htmlFor="data">Dia</label>
          <input id="data" name="data" type="date" defaultValue={data} className="h-11" />
          <button className="btn btn-ghost h-11" type="submit">Ver</button>
        </form>
      </div>

      <article className="space-y-4 rounded-2xl bg-slate-50 p-5 text-slate-900">
        {/* Faixa com os setores da usina, para o relatório da tela (o PDF não usa). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/banner-relatorio.jpg" alt="Estaleiro de solda, caminhão de solda, geração de trilhos reemprego e trilheiro" className="w-full rounded-xl object-cover" />
        <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-slate-900 pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Controle de Trilhos</p>
            <h1 className="text-2xl font-extrabold tracking-tight">Relatório gerencial</h1>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-rumo.png" alt="Rumo" className="h-10 w-auto self-center" />
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{rotuloPeriodo(data, modo).titulo}</p>
            <p className="text-lg font-bold tabular-nums">{rotuloPeriodo(data, modo).valor}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dados.resumo.map((r) => (
            <Resumo key={r.rotulo} rotulo={r.rotulo} cor={r.cor} dia={r.dia} semana={r.semana} mes={r.mes} mensal={modo === 'mensal'} linhas={r.linhas} colunas={colunas} rotuloDia={modo === 'diario' ? 'Do dia' : dados.rotuloDia} />
          ))}
        </div>

        <p className="text-xs text-slate-500">Cada setor mostra o valor do dia e o acumulado da semana (segunda a domingo), com o gráfico desses dias.</p>
        <div className="grid gap-4">
          {setoresTela.filter((s) => s.titulo !== 'Trilheiros').map((s) => (
            <div key={s.titulo}>
              {s.caminhoes ? (
                <CaminhoesBloco s={s} modo={modo} colunas={colunas} />
              ) : (
                <Setor
                  s={s}
                  rotulosDias={dados.rotulosDias}
                  largo
                  mensal={modo === 'mensal'}
                  colunas={colunas}
                  diaDestaque={modo === 'diario' ? (new Date(`${data}T12:00:00Z`).getUTCDay() + 6) % 7 : undefined}
                  rodape={modo === 'diario' ? (s.observacao ? <div className="space-y-1 text-[13px] text-slate-700">{s.observacao.split('\n').map((t) => <p key={t}>{t}</p>)}</div> : <ObservacaoDoDia titulo={s.titulo} observacoes={dados.observacoes} data={data} />) : undefined}
                />
              )}
            </div>
          ))}
        </div>
        {tlsLinhas.length > 0 && estaleiro && <EstoqueTlsBloco linhas={tlsLinhas} cor={estaleiro.cor} />}
        <TrilheirosBloco t={tril} />
      </article>
    </main>
  );
}
