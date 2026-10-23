import {
  estaleiroDoPeriodo,
  geracaoDoPeriodo,
  composicoesDoPeriodo,
  caminhoesDoPeriodo,
  trilheirosDoPeriodo,
  ROTULO_TLS,
  TIPOS_TLS,
  LIDERES,
  COMPOSICOES,
  CAMINHOES_ATIVOS,
  TRILHEIROS,
  listarCiclosAbertos,
  rotuloComposicao,
} from '@/lib/services/usina';
import { PERFIS } from '@/lib/validation/recebimento';
import { CarretasGeracao } from '@/components/usina/CarretasGeracao';
import { CamposGiro, type CicloAberto } from '@/components/usina/CamposGiro';
import { BotaoApagarRegistro } from '@/components/usina/BotaoApagarRegistro';
import { IconeImprimir } from '@/components/icones/Icones';

const SETORES: [string, string][] = [['estaleiro', 'Estaleiro'], ['geracao', 'Geração'], ['composicoes', 'Recolhimento serra'], ['caminhao', 'Caminhão de solda'], ['trilheiros', 'Trilheiros']];
import { fmtMetros, fmtPeso } from '@/lib/format';
import { ehIsoValido, faixaSemanaSegSex, type Periodo } from '@/lib/usina/periodo';
import { FormularioUsina } from '@/components/usina/FormularioUsina';
import { EscalaGrade } from '@/components/usina/EscalaGrade';
import { lerEscala, diasDaSemana } from '@/lib/usina/escala';
import { montarEscalaDaSemana, estaleiroDiasDaSemana } from '@/lib/services/usina';
import {
  salvarEstaleiroAction,
  salvarEstoqueTlsAction,
  salvarManutencaoAction,
  salvarEscalaAction,
  salvarGeracaoAction,
  salvarComposicaoAction,
  salvarCaminhaoAction,
  salvarGiroAction,
  salvarManutencaoTrilheiroAction,
  salvarEstaleiroSemanaAction,
  apagarGiroAction,
  apagarManutencaoTrilheiroAction,
  zerarTrilheiroAction,
} from './actions';

export const dynamic = 'force-dynamic';

const br = (iso: string) => iso.split('-').reverse().join('/');

function hojeIso(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10); // horário de Brasília
}

// A usina é lançada e relatada por semana (segunda a sexta): o período é sempre semana.
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

const NOME_DIA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
function somarDiasPagina(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export default async function UsinaPage({ searchParams }: { searchParams: Promise<{ periodo?: string; data?: string }> }) {
  const params = await searchParams;
  const periodo = periodoValido(params.periodo);
  const data = ehIsoValido(params.data) ? params.data : hojeIso();

  const ciclosAbertos = await listarCiclosAbertos();

  const [est, ger, comp, cam, tril] = await Promise.all([
    estaleiroDoPeriodo(periodo, data),
    geracaoDoPeriodo(periodo, data),
    composicoesDoPeriodo(periodo, data),
    caminhoesDoPeriodo(periodo, data),
    trilheirosDoPeriodo(periodo, data),
  ]);
  const escalaSalva = lerEscala(est.escala);
  const escalaSemana = await montarEscalaDaSemana(est.semana);
  const diasSemana = await estaleiroDiasDaSemana(est.semana);
  const totalSemana = diasSemana.reduce((t, d) => ({ soldas: t.soldas + (d.soldas ?? 0), cortes: t.cortes + (d.cortes ?? 0) }), { soldas: 0, cortes: 0 });
  const escalaLegada = !escalaSalva && est.escala.trim() !== '';

  return (
    <div className="space-y-8">
      <header className="page-header">
        <div>
          <h1 className="page-title">Relatório da usina</h1>
          <p className="text-sm text-ink-muted">Números da semana, de segunda a sexta. Escolha qualquer dia da semana.</p>
        </div>
      </header>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div className="field">
          <label htmlFor="data">Qualquer dia da semana</label>
          <input id="data" name="data" type="date" defaultValue={data} className="h-11" />
        </div>
        <button type="submit" className="btn btn-ghost h-11">Ver semana</button>
        <p className="w-full text-sm text-ink-muted">Semana de {faixaSemanaSegSex(data)} (segunda a sexta)</p>
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
          <Cartao rotulo="Tampões carregados" valor={est.carreta.tampoes} />
          <Cartao rotulo="Trilho novo (m)" valor={fmtMetros(est.carreta.trilhoNovoM)} />
          <Cartao rotulo="Sucata saída (t)" valor={fmtPeso(est.carreta.sucataT)} />
        </div>

        <div className="card space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">Semana de {br(est.semana)} a {br(somarDiasPagina(est.semana, 4))}</p>
            <p className="text-sm text-ink-muted">Lance cada dia e salve tudo de uma vez.</p>
          </div>
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
          </FormularioUsina>
        </div>

        <div className="card space-y-3">
          <p className="font-semibold">Produção de {br(data)}</p>
          <FormularioUsina acao={salvarEstaleiroAction}>
            <label className="field max-w-xs">Dia
              <input name="data" type="date" defaultValue={data} className="h-11" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label htmlFor="soldas">Quantidade de soldas</label>
                <input id="soldas" name="soldas" inputMode="numeric" defaultValue={est.diaDoLancamento?.soldas ?? ''} className="h-11" />
              </div>
              <div className="field">
                <label htmlFor="cortes">Quantidade de cortes</label>
                <input id="cortes" name="cortes" inputMode="numeric" defaultValue={est.diaDoLancamento?.cortes ?? ''} className="h-11" />
              </div>
            </div>
          </FormularioUsina>
        </div>

        <div className="card space-y-3">
          <p className="font-semibold">Estoque de TLS em {br(data)}</p>
          <FormularioUsina acao={salvarEstoqueTlsAction}>
            <label className="field max-w-xs">Dia
              <input name="data" type="date" defaultValue={data} className="h-11" />
            </label>
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
      <section className="space-y-4" aria-labelledby="geracao">
        <h2 id="geracao" className="section-title scroll-mt-24">Geração de trilho</h2>
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
        {LIDERES.map((l) => {
          const dia = ger.porLider.find((x) => x.valor === l.valor)?.lancamentoDia;
          return (
            <details className="card" key={l.valor}>
              <summary className="cursor-pointer font-semibold">Lançar {l.rotulo} — {br(data)}</summary>
              <div className="mt-3">
                <FormularioUsina acao={salvarGeracaoAction}>
                  <label className="field max-w-xs">Dia
                    <input name="data" type="date" defaultValue={data} className="h-11" />
                  </label>
                  <input type="hidden" name="lider" value={l.valor} />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="field"><label>Local</label><input name="local" defaultValue={dia?.local ?? ''} className="h-11" /></div>
                    <div className="field"><label>Corte do dia (m)</label><input name="corteM" inputMode="decimal" defaultValue={dia?.corteM != null ? String(dia.corteM) : ''} className="h-11" /></div>
                  </div>
                  <p className="text-sm font-semibold">Carretas do dia</p>
                  <CarretasGeracao
                    opcoesPerfis={PERFIS}
                    iniciais={(dia?.carretas ?? []).map((c) => ({
                      perfis: c.perfis,
                      quantidade: c.quantidade != null ? String(c.quantidade) : '',
                      carregamentoM: c.carregamentoM != null ? String(c.carregamentoM) : '',
                      deixadaViaM: c.deixadaViaM != null ? String(c.deixadaViaM) : '',
                    }))}
                  />
                  <div className="field"><label>Observação</label><textarea name="observacao" rows={2} defaultValue={dia?.observacao ?? ''} className="w-full" /></div>
                </FormularioUsina>
              </div>
            </details>
          );
        })}
      </section>

      {/* ── Recolhimento serra ─────────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="composicoes">
        <h2 id="composicoes" className="section-title scroll-mt-24">Recolhimento serra</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {comp.map((c) => (
            <div className="card space-y-3" key={c.ativo}>
              <p className="font-semibold">{rotuloComposicao(c.ativo)}</p>
              <p className="text-sm">No período: {c.barras} barras · {c.jacares} jacarés</p>
              <FormularioUsina acao={salvarComposicaoAction}>
                <label className="field max-w-xs">Dia
                  <input name="data" type="date" defaultValue={data} className="h-11" />
                </label>
                <input type="hidden" name="ativo" value={c.ativo} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="field"><label>Barras em {br(data)}</label><input name="barras" inputMode="numeric" defaultValue={c.lancamentoDia?.barras ?? ''} className="h-11" /></div>
                  <div className="field"><label>Jacarés em {br(data)}</label><input name="jacares" inputMode="numeric" defaultValue={c.lancamentoDia?.jacares ?? ''} className="h-11" /></div>
                </div>
                <div className="field">
                  <label>Observação</label>
                  <input name="observacao" defaultValue={c.lancamentoDia?.observacao ?? ''} className="h-11" />
                </div>
              </FormularioUsina>
            </div>
          ))}
        </div>
      </section>

      {/* ── Caminhão de solda ──────────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="caminhao">
        <h2 id="caminhao" className="section-title scroll-mt-24">Caminhão de solda</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {cam.map((c) => (
            <div className="card space-y-3" key={c.caminhao}>
              <p className="font-semibold">{c.caminhao}</p>
              <p className="text-sm">No período: produção {c.periodo.producao} · perda {c.periodo.perda}</p>
              <p className="text-xs text-ink-muted">Acumulado do mês: produção {c.mes.producao} · perda {c.mes.perda} — Acumulado do ano: produção {c.ano.producao} · perda {c.ano.perda}</p>
              <FormularioUsina acao={salvarCaminhaoAction}>
                <label className="field max-w-xs">Dia
                  <input name="data" type="date" defaultValue={data} className="h-11" />
                </label>
                <input type="hidden" name="caminhao" value={c.caminhao} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="field"><label>Produção diária</label><input name="producaoDiaria" inputMode="numeric" defaultValue={c.lancamentoDia?.producaoDiaria ?? ''} className="h-11" /></div>
                  <div className="field"><label>Perda diária</label><input name="perdaDiaria" inputMode="numeric" defaultValue={c.lancamentoDia?.perdaDiaria ?? ''} className="h-11" /></div>
                  <div className="field"><label>Local</label><input name="local" defaultValue={c.lancamentoDia?.local ?? ''} className="h-11" /></div>
                  <div className="field"><label>Início (macro 1)</label><input name="inicioMacro1" defaultValue={c.lancamentoDia?.inicioMacro1 ?? ''} className="h-11" placeholder="07:00" /></div>
                  <div className="field"><label>Término (macro 9)</label><input name="terminoMacro9" defaultValue={c.lancamentoDia?.terminoMacro9 ?? ''} className="h-11" placeholder="17:00" /></div>
                </div>
              </FormularioUsina>
            </div>
          ))}
          <div className="card space-y-2 opacity-70">
            <p className="font-semibold">CW03</p>
            <p className="text-sm text-ink-muted">Em breve.</p>
          </div>
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

        <div className="grid gap-4">
          {TRILHEIROS.map((t, i) => {
            const ciclo = ciclosAbertos[i];
            const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
            const valorCiclo: CicloAberto | null = ciclo
              ? {
                  boEm: iso(ciclo.boEm),
                  chegadaUsinaEm: iso(ciclo.chegadaUsinaEm),
                  partidaEm: iso(ciclo.partidaEm),
                  perfis: ciclo.perfis,
                  carregados: ciclo.carregados,
                  descarregados: ciclo.descarregados,
                  local: ciclo.local,
                  observacao: ciclo.observacao,
                }
              : null;
            return (
              <details className="card" key={t} open={Boolean(ciclo)}>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 font-semibold">
                  <span>{t}</span>
                  {ciclo ? (
                    <span className="text-sm font-normal text-ink-muted">
                      Saldo a descarregar: <strong className="font-mono text-ink">{ciclo.carregados - ciclo.descarregados}</strong> TLS
                      <span className="ml-2">({ciclo.carregados} carregados, {ciclo.descarregados} descarregados)</span>
                    </span>
                  ) : (
                    <span className="text-sm font-normal text-ink-muted">lançar giro</span>
                  )}
                </summary>
                <div className="mt-3">
                  <FormularioUsina acao={salvarGiroAction} rotuloBotao={ciclo ? 'Salvar ciclo' : 'Iniciar ciclo'}>
                    <input type="hidden" name="trilheiro" value={t} />
                    <CamposGiro ciclo={valorCiclo} opcoesPerfis={TIPOS_TLS.map((p) => ({ valor: p, rotulo: ROTULO_TLS[p] }))} />
                  </FormularioUsina>
                  <div className="mt-4 border-t border-line pt-3">
                    <BotaoApagarRegistro
                      acao={zerarTrilheiroAction}
                      campos={{ trilheiro: t }}
                      rotulo={`Reiniciar ${t} (apagar todos os giros e manutenções)`}
                      rotuloConfirmar={`Toque de novo para apagar tudo do ${t}`}
                    />
                  </div>
                </div>
              </details>
            );
          })}
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
