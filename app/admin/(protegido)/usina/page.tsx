import { Fragment } from 'react';
import {
  estaleiroDoPeriodo,
  geracaoDoPeriodo,
  trilheirosDoPeriodo,
  ROTULO_TLS,
  TIPOS_TLS,
  LIDERES,
  COMPOSICOES,
  CAMINHOES_ATIVOS,
  TRILHEIROS,
} from '@/lib/services/usina';
import { PERFIS } from '@/lib/validation/recebimento';
import { GeracaoSemana } from '@/components/usina/GeracaoSemana';
import { BotaoApagarRegistro } from '@/components/usina/BotaoApagarRegistro';
import { SeletorDia } from '@/components/usina/SeletorDia';
import { IconeImprimir } from '@/components/icones/Icones';
import { CabecalhoSemana } from '@/components/usina/CabecalhoSemana';
import { br, somarDiasPagina } from '@/lib/usina/formatoData';

const SETORES: [string, string][] = [['estaleiro', 'Estaleiro'], ['geracao', 'Geração'], ['composicoes', 'Recolhimento serra'], ['caminhao', 'Caminhão de solda'], ['trilheiros', 'Trilheiros']];
import { fmtMetros, fmtPeso } from '@/lib/format';
import { ehIsoValido, faixaSemanaSegSex, type Periodo } from '@/lib/usina/periodo';
import { FormularioUsina } from '@/components/usina/FormularioUsina';
import { observacoesDoPeriodo } from '@/lib/services/observacaoSetor';
import { ObservacoesDoSetor } from '@/components/usina/ObservacoesDoSetor';
import { EscalaGrade } from '@/components/usina/EscalaGrade';
import { lerEscala, diasDaSemana } from '@/lib/usina/escala';
import { montarEscalaDaSemana, estaleiroDiasDaSemana, composicoesDaSemana, caminhoesDaSemana, geracaoDaSemana, trilheirosDaSemana } from '@/lib/services/usina';
import {
  salvarEstoqueTlsAction,
  salvarManutencaoAction,
  salvarEscalaAction,
  salvarTrilheirosSemanaAction,
  salvarManutencaoTrilheiroAction,
  salvarEstaleiroSemanaAction,
  salvarSerraSemanaAction,
  salvarCaminhoesSemanaAction,
  salvarGeracaoSemanaAction,
  apagarGiroAction,
  apagarManutencaoTrilheiroAction,
} from './actions';

export const dynamic = 'force-dynamic';


function hojeIso(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10); // horário de Brasília
}

// A usina é lançada e relatada por semana (segunda a domingo): o período é sempre semana.
function periodoValido(_v: string | undefined): Periodo {
  return 'semana';
}

function Cartao({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="card">
      <p className="kv-label">{rotulo}</p>
      <p className="text-2xl font-semibold">{valor}</p>
    </div>
  );
}

const NOME_DIA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export default async function UsinaPage({ searchParams }: { searchParams: Promise<{ periodo?: string; data?: string }> }) {
  const params = await searchParams;
  const periodo = periodoValido(params.periodo);
  const data = ehIsoValido(params.data) ? params.data : hojeIso();


  const [est, ger, tril] = await Promise.all([
    estaleiroDoPeriodo(periodo, data),
    geracaoDoPeriodo(periodo, data),
    trilheirosDoPeriodo(periodo, data),
  ]);
  const escalaSalva = lerEscala(est.escala);
  const escalaSemana = await montarEscalaDaSemana(est.semana);
  const diasSemana = await estaleiroDiasDaSemana(est.semana);
  const serraSemana = await composicoesDaSemana(est.semana);
  const caminhoesSemana = await caminhoesDaSemana(est.semana);
  const geracaoSemana = await geracaoDaSemana(est.semana);
  const trilheirosSemana = await trilheirosDaSemana(est.semana);
  const observacoesSemana = await observacoesDoPeriodo(est.semana, somarDiasPagina(est.semana, 6));
  const primeiroDaSemana = (t: (typeof TRILHEIROS)[number], campo: 'boEm' | 'partidaEm' | 'local' | 'observacao') =>
    trilheirosSemana.map((d) => d.trilheiros[t][campo]).find((v) => v) ?? '';
  const boSemana = Object.fromEntries(TRILHEIROS.map((t) => [t, primeiroDaSemana(t, 'boEm')]));
  const partidaSemana = Object.fromEntries(TRILHEIROS.map((t) => [t, primeiroDaSemana(t, 'partidaEm')]));
  const localSemana = Object.fromEntries(TRILHEIROS.map((t) => [t, primeiroDaSemana(t, 'local')]));
  const diasObservacao = Array.from({ length: 7 }, (_, i) => {
    const data = somarDiasPagina(est.semana, i);
    return { data, rotulo: `${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][i]} ${br(data)}` };
  });
  const obsSemana = Object.fromEntries(TRILHEIROS.map((t) => [t, primeiroDaSemana(t, 'observacao')]));
  const totalSemana = diasSemana.reduce((t, d) => ({ soldas: t.soldas + (d.soldas ?? 0), cortes: t.cortes + (d.cortes ?? 0) }), { soldas: 0, cortes: 0 });
  const escalaLegada = !escalaSalva && est.escala.trim() !== '';

  return (
    <div className="space-y-8">
      <header className="page-header">
        <div>
          <h1 className="page-title">Relatório da usina</h1>
          <p className="text-sm text-ink-muted">Números da semana, de segunda a domingo. Escolha qualquer dia da semana.</p>
        </div>
      </header>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div className="field">
          <label htmlFor="data">Qualquer dia da semana</label>
          <input id="data" name="data" type="date" defaultValue={data} className="h-11" />
        </div>
        <button type="submit" className="btn btn-ghost h-11">Ver semana</button>
        <p className="w-full text-sm text-ink-muted">Semana de {faixaSemanaSegSex(data)} (segunda a domingo)</p>
      </form>

      <nav aria-label="Setores" className="flex flex-wrap items-center gap-2 border-b border-line pb-3 text-sm">
        {SETORES.map(([valor, rotulo]) => (
          <a key={valor} className="btn btn-ghost btn-sm" href={`#${valor}`}>{rotulo}</a>
        ))}
        <details className="relative ml-auto">
          <summary className="btn btn-secondary btn-sm cursor-pointer list-none">
            <IconeImprimir size={14} /> Imprimir
          </summary>
          <div className="absolute right-0 z-10 mt-2 flex min-w-48 flex-col gap-1 rounded-lg border border-line bg-surface p-2 shadow-lg">
            {SETORES.map(([valor, rotulo]) => (
              <a key={valor} className="rounded px-3 py-2 hover:bg-surface-2" href={`/admin/usina/imprimir?data=${data}&setor=${valor}`}>{rotulo}</a>
            ))}
            <a className="rounded px-3 py-2 font-semibold hover:bg-surface-2" href={`/admin/usina/relatorio-gerencial?data=${data}`}>Relatório gerencial</a>
          </div>
        </details>
      </nav>

      {/* ── Estaleiro de solda ─────────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="estaleiro">
        <h2 id="estaleiro" className="section-title scroll-mt-24">Estaleiro de solda</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Cartao rotulo="Soldas" valor={est.totais.soldas} />
          <Cartao rotulo="Cortes" valor={est.totais.cortes} />
          <Cartao rotulo="Tampões carregados (m)" valor={fmtMetros(est.carreta.tampoesM)} />
          <Cartao rotulo="Trilho novo (m)" valor={fmtMetros(est.carreta.trilhoNovoM)} />
          <Cartao rotulo="Sucata saída (t)" valor={fmtPeso(est.carreta.sucataT)} />
        </div>

        <div className="card space-y-3">
          <CabecalhoSemana semana={est.semana} ajuda="Lance cada dia e salve tudo de uma vez." />
          <FormularioUsina acao={salvarEstaleiroSemanaAction} rotuloBotao="Salvar a semana">
            <input type="hidden" name="semana" value={est.semana} />
            <div className="tbl-wrap">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th className="py-2">Dia</th>
                    <th className="py-2 text-right">Soldas (UND)</th>
                    <th className="py-2 text-right">Cortes (UND)</th>
                  </tr>
                </thead>
                <tbody>
                  {diasSemana.map((d) => (
                    <tr key={d.data} className="border-t border-line">
                      <td className="py-2 font-medium">{NOME_DIA[diasSemana.indexOf(d)]} {br(d.data)}</td>
                      <td className="py-2 text-right">
                        <input name={`soldas_${d.data}`} inputMode="numeric" defaultValue={d.soldas ?? ''} className="h-11 w-28 text-right" aria-label={`Soldas ${br(d.data)}`} />
                      </td>
                      <td className="py-2 text-right">
                        <input name={`cortes_${d.data}`} inputMode="numeric" defaultValue={d.cortes ?? ''} className="h-11 w-28 text-right" aria-label={`Cortes ${br(d.data)}`} />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-line font-semibold">
                    <td className="py-2">Total da semana</td>
                    <td className="py-2 text-right font-mono">{totalSemana.soldas}</td>
                    <td className="py-2 text-right font-mono">{totalSemana.cortes}</td>
                  </tr>
                </tbody>
              </table>
            </div>
                      <ObservacoesDoSetor setor="estaleiro" dias={diasObservacao} obs={observacoesSemana} />
          </FormularioUsina>
        </div>

        <div className="card space-y-3">
          <p className="font-semibold">Estoque de TLS em {br(data)}</p>
          <FormularioUsina acao={salvarEstoqueTlsAction}>
            <SeletorDia valor={data} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {TIPOS_TLS.map((t) => (
                <div className="field" key={t}>
                  <label htmlFor={`tls_${t}`}>{ROTULO_TLS[t]}</label>
                  <input id={`tls_${t}`} name={`tls_${t}`} inputMode="numeric" defaultValue={est.estoqueDoDia[t] ?? ''} className="h-11" />
                </div>
              ))}
            </div>
          </FormularioUsina>
        </div>

        <div className="card space-y-3">
          <p className="font-semibold">Manutenção da semana</p>
          <p className="text-sm text-ink-muted">Padrão: sexta-feira. Troque a data se a manutenção for em outro dia.</p>
          <FormularioUsina acao={salvarManutencaoAction}>
            <input type="hidden" name="semana" value={est.semana} />
            <div className="field max-w-xs">
              <label htmlFor="diaManutencao">Dia da manutenção</label>
              <input id="diaManutencao" name="diaManutencao" type="date" defaultValue={est.manutencaoDia} className="h-11" />
            </div>
          </FormularioUsina>
        </div>

        <div className="card space-y-3 xl:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">Escala da semana</p>
            <a href={`/api/usina/escala/pdf?semana=${est.semana}`} className="btn btn-ghost h-10 px-4 text-sm">Baixar PDF da escala</a>
          </div>
          <p className="text-sm text-ink-muted">Preencha a semana toda. Use o seletor de status e, se for o caso, o local onde estava.</p>
          {escalaLegada && (
            <p className="rounded-lg border border-[var(--ln)] p-3 text-sm text-ink-muted">
              Escala anterior em texto: {est.escala}. Ao salvar a grade abaixo, ela é substituída.
            </p>
          )}
          <EscalaGrade valor={escalaSemana} dias={diasDaSemana(est.semana)} semana={est.semana} acao={salvarEscalaAction} />
        </div>
      </section>

      {/* ── Geração de trilho ──────────────────────────────────────── */}
      <details open className="group space-y-4" aria-labelledby="geracao">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 scroll-mt-24">
          <h2 id="geracao" className="section-title !mb-0">Geração de trilho</h2>
          <span className="text-sm text-ink-muted group-open:hidden">Mostrar</span>
          <span className="hidden text-sm text-ink-muted group-open:inline">Minimizar</span>
        </summary>
        <div className="grid gap-3 sm:grid-cols-3">
          {ger.porLider.map((l) => (
            <div className="card space-y-2" key={l.valor}>
              <p className="font-semibold">{l.rotulo}</p>
              <p className="text-sm">Corte: {fmtMetros(l.periodo.corteM)} m · Carregamento: {fmtMetros(l.periodo.carregamentoM)} m</p>
              <p className="text-sm">Barras: {l.periodo.quantidade} · Deixadas na via: {fmtMetros(l.periodo.deixadaViaM)} m</p>
              <p className="text-xs text-ink-muted">
                Mês: {fmtMetros(l.mes.totalM)} m (carregado + deixado)
              </p>
            </div>
          ))}
        </div>
        <div className="card space-y-3">
          <CabecalhoSemana semana={est.semana} ajuda="Lance as carretas de cada dia com os perfis, e salve a semana de uma vez." />
          <FormularioUsina acao={salvarGeracaoSemanaAction} rotuloBotao="Salvar a semana">
            <input type="hidden" name="semana" value={est.semana} />
            <GeracaoSemana
              dias={geracaoSemana.map((d, i) => ({ data: d.data, rotulo: `${NOME_DIA[i]} ${br(d.data)}`, lideres: d.lideres }))}
              lideres={LIDERES}
              opcoesPerfis={PERFIS}
            />
                      <ObservacoesDoSetor setor="geracao" dias={diasObservacao} obs={observacoesSemana} />
          </FormularioUsina>
        </div>
      </details>

      {/* ── Recolhimento serra ─────────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="composicoes">
        <h2 id="composicoes" className="section-title scroll-mt-24">Recolhimento serra</h2>
        <div className="card space-y-3">
          <CabecalhoSemana semana={est.semana} ajuda="Lance cada dia e salve tudo de uma vez." />
          <FormularioUsina acao={salvarSerraSemanaAction} rotuloBotao="Salvar a semana">
            <input type="hidden" name="semana" value={est.semana} />
            <div className="tbl-wrap">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th className="py-2">Dia</th>
                    <th className="py-2 text-right">W61 barras</th>
                    <th className="py-2 text-right">W61 jacarés</th>
                    <th className="py-2">W61 observação</th>
                    <th className="py-2 text-right">W62 barras</th>
                    <th className="py-2 text-right">W62 jacarés</th>
                    <th className="py-2">W62 observação</th>
                  </tr>
                </thead>
                <tbody>
                  {serraSemana.map((d, i) => (
                    <tr key={d.data} className="border-t border-line">
                      <td className="py-2 font-medium">{NOME_DIA[i]} {br(d.data)}</td>
                      {COMPOSICOES.map((a) => (
                        <Fragment key={a}>
                          <td className="py-2 text-right">
                            <input name={`barras_${a}_${d.data}`} inputMode="numeric" defaultValue={d.ativos[a].barras ?? ''} className="h-11 w-24 text-right" aria-label={`Barras ${a} ${br(d.data)}`} />
                          </td>
                          <td className="py-2 text-right">
                            <input name={`jacares_${a}_${d.data}`} inputMode="numeric" defaultValue={d.ativos[a].jacares ?? ''} className="h-11 w-24 text-right" aria-label={`Jacarés ${a} ${br(d.data)}`} />
                          </td>
                          <td className="py-2">
                            <input name={`obs_${a}_${d.data}`} defaultValue={d.ativos[a].observacao ?? ''} className="h-11 w-64" aria-label={`Observação ${a} ${br(d.data)}`} />
                          </td>
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
                      <ObservacoesDoSetor setor="serra" dias={diasObservacao} obs={observacoesSemana} />
          </FormularioUsina>
        </div>
      </section>

      {/* ── Caminhão de solda ──────────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="caminhao">
        <h2 id="caminhao" className="section-title scroll-mt-24">Caminhão de solda</h2>
        <div className="card space-y-3">
          <CabecalhoSemana semana={est.semana} ajuda="Lance cada dia e salve tudo de uma vez." />
          <FormularioUsina acao={salvarCaminhoesSemanaAction} rotuloBotao="Salvar a semana">
            <input type="hidden" name="semana" value={est.semana} />
            {CAMINHOES_ATIVOS.map((c) => (
              <div key={c} className="space-y-2">
                <p className="text-sm font-semibold">{c}</p>
                <div className="tbl-wrap">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-ink-muted">
                        <th className="py-2">Dia</th>
                        <th className="py-2 text-right">Produção</th>
                        <th className="py-2 text-right">Perda</th>
                        <th className="py-2">Local</th>
                        <th className="py-2">Início (macro 1)</th>
                        <th className="py-2">Término (macro 9)</th>
                        <th className="py-2">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caminhoesSemana.map((d, i) => (
                        <tr key={d.data} className="border-t border-line">
                          <td className="py-2 font-medium">{NOME_DIA[i]} {br(d.data)}</td>
                          <td className="py-2 text-right">
                            <input name={`producao_${c}_${d.data}`} inputMode="numeric" defaultValue={d.caminhoes[c].producaoDiaria ?? ''} className="h-11 w-24 text-right" aria-label={`Produção ${c} ${br(d.data)}`} />
                          </td>
                          <td className="py-2 text-right">
                            <input name={`perda_${c}_${d.data}`} inputMode="numeric" defaultValue={d.caminhoes[c].perdaDiaria ?? ''} className="h-11 w-24 text-right" aria-label={`Perda ${c} ${br(d.data)}`} />
                          </td>
                          <td className="py-2">
                            <input name={`local_${c}_${d.data}`} defaultValue={d.caminhoes[c].local ?? ''} className="h-11 w-36" aria-label={`Local ${c} ${br(d.data)}`} />
                          </td>
                          <td className="py-2">
                            <input name={`inicio_${c}_${d.data}`} defaultValue={d.caminhoes[c].inicioMacro1 ?? ''} className="h-11 w-24" placeholder="07:00" aria-label={`Início ${c} ${br(d.data)}`} />
                          </td>
                          <td className="py-2">
                            <input name={`termino_${c}_${d.data}`} defaultValue={d.caminhoes[c].terminoMacro9 ?? ''} className="h-11 w-24" placeholder="17:00" aria-label={`Término ${c} ${br(d.data)}`} />
                          </td>
                          <td className="py-2">
                            <input name={`obs_${c}_${d.data}`} defaultValue={d.caminhoes[c].observacao ?? ''} className="h-11 w-64" aria-label={`Observação ${c} ${br(d.data)}`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
                      <ObservacoesDoSetor setor="caminhao" dias={diasObservacao} obs={observacoesSemana} />
          </FormularioUsina>
        </div>
        <div className="card space-y-2 opacity-70">
          <p className="font-semibold">CW03</p>
          <p className="text-sm text-ink-muted">Em breve.</p>
        </div>
      </section>

      {/* ── Trilheiros ─────────────────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="trilheiros">
        <h2 id="trilheiros" className="section-title scroll-mt-24">Trilheiros</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Cartao rotulo="Média de dias úteis na usina" valor={tril.mediaDiasUteisNaUsina ?? '—'} />
          <Cartao rotulo="Giros com tempo medido" valor={tril.girosComTempo} />
          <Cartao rotulo="Manutenções no período" valor={tril.manutencoes.length} />
        </div>

        {tril.giros.length > 0 && (
          <details className="card">
            <summary className="cursor-pointer font-semibold">Histórico de giros antigos ({tril.giros.length})</summary>
            <p className="mt-2 text-sm text-ink-muted">Lançamentos do sistema anterior. Não são usados no relatório atual.</p>
            <div className="mt-3">
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th>Trilheiro</th><th>B.O.</th><th>Chegada</th><th>Partida</th><th>Retorno</th><th>Perfis</th><th>Carregados</th><th>Descarregados</th><th>Saldo</th><th>Local</th><th></th>
                </tr>
              </thead>
              <tbody>
                {tril.giros.map((g) => (
                  <tr key={g.id} className="border-t border-line">
                    <td className="font-mono">{g.trilheiro}</td>
                    <td>{g.boEm ? br(g.boEm.toISOString().slice(0, 10)) : '—'}</td>
                    <td>{g.chegadaUsinaEm ? br(g.chegadaUsinaEm.toISOString().slice(0, 10)) : '—'}</td>
                    <td>{g.partidaEm ? br(g.partidaEm.toISOString().slice(0, 10)) : '—'}</td>
                    <td>{g.retornoEm ? br(g.retornoEm.toISOString().slice(0, 10)) : '—'}</td>
                    <td>{g.perfis.length > 0 ? g.perfis.map((p) => ROTULO_TLS[p]).join(', ') : g.perfil ? ROTULO_TLS[g.perfil] : '—'}</td>
                    <td>{g.carregados}</td>
                    <td>{g.descarregados}</td>
                    <td className="font-mono">{g.carregados - g.descarregados}</td>
                    <td>{g.local ?? '—'}</td>
                    <td className="text-right">
                      <BotaoApagarRegistro acao={apagarGiroAction} campos={{ id: g.id }} />
                    </td>
                  </tr>
                ))}
                {tril.giros.length === 0 && (
                  <tr><td colSpan={11} className="py-3 text-ink-muted">Nenhum giro neste período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
            </div>
          </details>
        )}

        <div className="card space-y-3">
          <CabecalhoSemana semana={est.semana} ajuda="Preencha o B.O., a partida, o local e a observação de cada trilheiro. Depois, as barras de cada dia." />
          <FormularioUsina acao={salvarTrilheirosSemanaAction} rotuloBotao="Salvar a semana">
            <input type="hidden" name="semana" value={est.semana} />
            {TRILHEIROS.map((t) => (
              <div key={t} className="space-y-2 rounded-lg border border-line p-3">
                <p className="text-sm font-semibold">{t}</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="field">
                    <label htmlFor={`bo_${t}`}>Data do B.O.</label>
                    <input id={`bo_${t}`} type="date" name={`bo_${t}`} defaultValue={boSemana[t] ?? ''} className="h-11" />
                  </div>
                  <div className="field">
                    <label htmlFor={`partida_${t}`}>Partida da usina</label>
                    <input id={`partida_${t}`} type="date" name={`partida_${t}`} defaultValue={partidaSemana[t] ?? ''} className="h-11" />
                  </div>
                  <div className="field">
                    <label htmlFor={`local_${t}`}>Local atual</label>
                    <input id={`local_${t}`} name={`local_${t}`} defaultValue={localSemana[t] ?? ''} className="h-11" placeholder="Ex.: EFH" />
                  </div>
                  <div className="field">
                    <label htmlFor={`obs_${t}`}>Observação</label>
                    <input id={`obs_${t}`} name={`obs_${t}`} defaultValue={obsSemana[t] ?? ''} className="h-11" />
                  </div>
                </div>
                <div className="tbl-wrap">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-ink-muted">
                        <th className="py-2">Dia</th>
                        <th className="py-2 text-right">Total do giro</th>
                        <th className="py-2 text-right">Descarregadas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trilheirosSemana.map((d, i) => (
                        <tr key={d.data} className="border-t border-line">
                          <td className="py-2 font-medium">{NOME_DIA[i]} {br(d.data)}</td>
                          <td className="py-2 text-right">
                            <input name={`total_${t}_${d.data}`} inputMode="numeric" defaultValue={d.trilheiros[t].total ?? ''} className="h-11 w-24 text-right" aria-label={`Total do giro ${t} ${br(d.data)}`} />
                          </td>
                          <td className="py-2 text-right">
                            <input name={`desc_${t}_${d.data}`} inputMode="numeric" defaultValue={d.trilheiros[t].descarregadas ?? ''} className="h-11 w-24 text-right" aria-label={`Descarregadas ${t} ${br(d.data)}`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </FormularioUsina>
        </div>

        <details className="card">
          <summary className="cursor-pointer font-semibold">Registrar manutenção do trilheiro</summary>
          <div className="mt-3">
            <FormularioUsina acao={salvarManutencaoTrilheiroAction} rotuloBotao="Registrar">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="field"><label>Data</label><input name="data" type="date" defaultValue={data} className="h-11" /></div>
                <div className="field"><label>Trilheiro</label>
                  <select name="trilheiro" className="h-11">{TRILHEIROS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                </div>
                <div className="field"><label>Local</label><input name="local" className="h-11" /></div>
                <div className="field"><label>Tipo</label><input name="tipo" className="h-11" placeholder="Comporta, Gerador…" /></div>
              </div>
              <div className="field"><label>Detalhamento</label><textarea name="detalhamento" rows={3} className="w-full" /></div>
            </FormularioUsina>
          </div>
        </details>

        {tril.manutencoes.length > 0 && (
          <ul className="card space-y-2 text-sm">
            {tril.manutencoes.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span><span className="font-mono">{br(m.data.toISOString().slice(0, 10))}</span> · {m.trilheiro} · {m.tipo ?? 'Manutenção'}{m.local ? ` · ${m.local}` : ''}{m.detalhamento ? ` — ${m.detalhamento}` : ''}</span>
                <BotaoApagarRegistro acao={apagarManutencaoTrilheiroAction} campos={{ id: m.id }} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
