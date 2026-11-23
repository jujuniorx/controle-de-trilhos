import { montarDadosRelatorio, montarTrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { totaisDoAnoAte } from '@/lib/services/usina';
import { fmtMetros } from '@/lib/format';
import { Setor, Resumo, TrilheirosBloco, CaminhoesBloco } from '@/components/usina/RelatorioSetores';
import { CampoObservacao, CHAVE_SETOR } from '@/components/usina/ObservacoesSetorRelatorio';
import { ehIsoValido, modoValido, linksModo, rotuloPeriodo, colunasValidas, desdeValido, ultimoFimDeSemana, rotuloFaixaCurta, TODAS_COLUNAS, type Coluna } from '@/lib/usina/periodo';
import { BotaoCompartilharPdf } from '@/components/usina/BotaoCompartilharPdf';

export const dynamic = 'force-dynamic';

const br = (iso: string) => iso.split('-').reverse().join('/');

const NOME_COLUNA: Record<Coluna, string> = { dia: 'Dia', semana: 'Semana', mes: 'No mês' };

/** Explica, com as colunas escolhidas, o que cada número dos setores quer dizer. */
function legendaColunas(colunas: Coluna[], modo: string): string {
  if (modo === 'mensal') return 'Cada setor mostra o acumulado do mês até o dia escolhido.';
  const partes: string[] = [];
  if (colunas.includes('dia')) partes.push('o valor do dia');
  if (colunas.includes('semana')) partes.push('o acumulado da semana (segunda a domingo)');
  if (colunas.includes('mes')) partes.push('o acumulado do mês até o dia');
  const lista = partes.length <= 1 ? (partes[0] ?? 'os valores') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
  return `Cada setor mostra ${lista}, com o gráfico dos dias da semana.`;
}

export default async function RelatorioGerencialUsina({ searchParams }: { searchParams: Promise<{ data?: string; modo?: string; col?: string | string[]; desde?: string }> }) {
  const params = await searchParams;
  const modo = modoValido(params.modo);
  const colunas = colunasValidas(params.col);
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const data = ehIsoValido(params.data) ? params.data : hoje;
  // Vários dias (ex.: na segunda, sexta a domingo) só no formato diário.
  const desde = modo === 'diario' ? desdeValido(params.desde, data) : data;
  const varios = desde < data;
  const fds = ultimoFimDeSemana(hoje);
  const dados = await montarDadosRelatorio(data, desde);
  const tril = await montarTrilheirosRelatorio(data, desde);
  const qsDesde = varios ? `&desde=${desde}` : '';
  const anual = await totaisDoAnoAte(data);
  // O estoque de TLS fica fora do relatório por enquanto: tira as linhas dele do cartão do estaleiro.
  const estaleiro = dados.setores.find((s) => s.titulo === 'Estaleiro de solda');
  const iTls = estaleiro ? estaleiro.linhas.findIndex((l) => l.secao?.startsWith('Estoque TLS')) : -1;
  const setoresTela = dados.setores.map((s) => (s.titulo === 'Estaleiro de solda' && iTls >= 0 ? { ...s, linhas: s.linhas.slice(0, iTls) } : s));
  const periodo = rotuloPeriodo(data, modo, desde);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8">
      <header className="page-header">
        <div>
          <h1 className="page-title">Relatório gerencial</h1>
          <p className="text-sm text-ink-muted">{periodo.titulo}: {periodo.valor}</p>
        </div>
        <div className="usina-acoes">
          <a className="btn btn-ghost h-11" href={`/admin/usina?data=${data}`}>Voltar</a>
          <BotaoCompartilharPdf url={`/api/usina/relatorio-gerencial/pdf?data=${data}&modo=${modo}&pagina=tudo&col=${colunas.join(',')}${qsDesde}`} nomeArquivo={varios ? `relatorio-gerencial-usina-${desde}-a-${data}.png` : `relatorio-gerencial-usina-${data}.png`} titulo={varios ? `Relatório da usina ${br(desde)} a ${br(data)}` : `Relatório da usina ${br(data)}`} rotulo="Imagem do relatório" png />
        </div>
      </header>

      <section className="card space-y-4" aria-label="Opções do relatório">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <p className="kv-label">Formato</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Formato do relatório">
              {linksModo('/admin/usina/relatorio-gerencial', modo, varios ? { data, desde } : { data }, true).map((l) => (
                <a key={l.modo} href={l.href} aria-current={l.ativo ? 'true' : undefined} className={`btn h-11 ${l.ativo ? 'btn-secondary' : 'btn-ghost'}`}>{l.rotulo}</a>
              ))}
            </div>
          </div>

          <form action="" method="get" className="space-y-1" aria-label="Colunas do relatório">
            <input type="hidden" name="data" value={data} />
            <input type="hidden" name="modo" value={modo} />
            {varios && <input type="hidden" name="desde" value={desde} />}
            <p className="kv-label">Colunas</p>
            <div className="flex flex-wrap items-center gap-2">
              {TODAS_COLUNAS.map((c) => (
                <label key={c} className="flex h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm">
                  <input type="checkbox" name="col" value={c} defaultChecked={colunas.includes(c)} />
                  {NOME_COLUNA[c]}
                </label>
              ))}
              <button className="btn btn-ghost h-11" type="submit">Aplicar colunas</button>
            </div>
          </form>

          <form action="" className="space-y-1">
            <input type="hidden" name="modo" value={modo} />
            {colunas.length < TODAS_COLUNAS.length && colunas.map((c) => <input key={c} type="hidden" name="col" value={c} />)}
            <div className="flex flex-wrap items-end gap-2">
              {modo === 'diario' && (
                <div className="space-y-1">
                  <label className="kv-label" htmlFor="desde">De (opcional)</label>
                  <input id="desde" name="desde" type="date" defaultValue={varios ? desde : ''} max={data} className="h-11" />
                </div>
              )}
              <div className="space-y-1">
                <label className="kv-label" htmlFor="data">{modo === 'diario' ? 'Até o dia' : 'Dia'}</label>
                <input id="data" name="data" type="date" defaultValue={data} className="h-11" />
              </div>
              <button className="btn btn-ghost h-11" type="submit">Ver</button>
            </div>
            {modo === 'diario' && (
              <p className="text-xs text-ink-muted">Deixe &quot;De&quot; vazio para um dia só. Com &quot;De&quot;, o relatório soma os dias e mostra a observação de cada um.</p>
            )}
          </form>

          {modo === 'diario' && (
            <div className="space-y-1">
              <p className="kv-label">Atalho</p>
              <a
                className={`btn h-11 ${varios && desde === fds.desde && data === fds.data ? 'btn-secondary' : 'btn-ghost'}`}
                href={`/admin/usina/relatorio-gerencial?modo=diario&desde=${fds.desde}&data=${fds.data}${colunas.length < TODAS_COLUNAS.length ? colunas.map((c) => `&col=${c}`).join('') : ''}`}
              >
                Fim de semana ({rotuloFaixaCurta(fds.desde, fds.data)})
              </a>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="resumo-relatorio">
        <h2 id="resumo-relatorio" className="section-title scroll-mt-24">Resumo</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dados.resumo.map((r) => (
            <Resumo key={r.rotulo} rotulo={r.rotulo} cor={r.cor} dia={r.dia} semana={r.semana} mes={r.mes} mensal={modo === 'mensal'} linhas={r.linhas} legenda={r.legenda} colunas={colunas} rotuloDia={modo === 'diario' ? dados.rotuloValorDia : dados.rotuloDia} />
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="ano-relatorio">
        <h2 id="ano-relatorio" className="section-title scroll-mt-24">No ano</h2>
        <p className="text-sm text-ink-muted">De {br(anual.inicio)} a {br(anual.fim)}.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { rotulo: 'Soldas (und)', valor: `${anual.soldas}` },
            { rotulo: 'Cortes (und)', valor: `${anual.cortes}` },
            { rotulo: 'Geração de trilho (m)', valor: fmtMetros(anual.metrosGeracao) },
            { rotulo: 'Recolhimento serra (m)', valor: fmtMetros(anual.metrosSerra) },
            ...anual.caminhoes.map((c) => ({ rotulo: `${c.caminhao} soldas (und)`, valor: `${c.soldas}` })),
          ].map((c) => (
            <div key={c.rotulo} className="card">
              <p className="kv-label">{c.rotulo}</p>
              <p className="text-2xl font-semibold tabular-nums">{c.valor}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="setores-relatorio">
        <h2 id="setores-relatorio" className="section-title scroll-mt-24">Setores</h2>
        <p className="text-sm text-ink-muted">{legendaColunas(colunas, modo)}</p>
        <div className="grid gap-4">
          {setoresTela.filter((s) => s.titulo !== 'Trilheiros').map((s) => (
            <div key={s.titulo} className="card">
              {s.caminhoes ? (
                <CaminhoesBloco s={s} modo={modo} colunas={colunas} />
              ) : (
                <Setor
                  s={s}
                  rotulosDias={dados.rotulosDias}
                  largo
                  mensal={modo === 'mensal'}
                  colunas={colunas}
                  diaDestaque={modo === 'diario' ? dados.diasDestaque : undefined}
                  rodape={modo === 'diario' ? <CampoObservacao texto={s.observacao ?? dados.observacoes[`${data}|${CHAVE_SETOR[s.titulo] ?? ''}`] ?? ''} /> : undefined}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-3" aria-labelledby="trilheiros-relatorio">
        <h2 id="trilheiros-relatorio" className="section-title scroll-mt-24">Trilheiros</h2>
        <TrilheirosBloco t={tril} />
      </section>
    </main>
  );
}
