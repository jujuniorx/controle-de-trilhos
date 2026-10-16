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
} from '@/lib/services/usina';
import { fmtMetros, fmtPeso } from '@/lib/format';
import { PERIODOS, ehIsoValido, type Periodo } from '@/lib/usina/periodo';
import { FormularioUsina } from '@/components/usina/FormularioUsina';
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
} from './actions';

export const dynamic = 'force-dynamic';

const br = (iso: string) => iso.split('-').reverse().join('/');

function hojeIso(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10); // horário de Brasília
}

function periodoValido(v: string | undefined): Periodo {
  return v === 'semana' || v === 'mes' ? v : 'dia';
}

function Cartao({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="card">
      <p className="kv-label">{rotulo}</p>
      <p className="text-2xl font-semibold">{valor}</p>
    </div>
  );
}

export default async function UsinaPage({ searchParams }: { searchParams: Promise<{ periodo?: string; data?: string }> }) {
  const params = await searchParams;
  const periodo = periodoValido(params.periodo);
  const data = ehIsoValido(params.data) ? params.data : hojeIso();

  const [est, ger, comp, cam, tril] = await Promise.all([
    estaleiroDoPeriodo(periodo, data),
    geracaoDoPeriodo(periodo, data),
    composicoesDoPeriodo(periodo, data),
    caminhoesDoPeriodo(periodo, data),
    trilheirosDoPeriodo(periodo, data),
  ]);

  return (
    <div className="space-y-8">
      <header className="page-header">
        <div>
          <h1 className="page-title">Relatório da usina</h1>
          <p className="text-sm text-ink-muted">Escolha o período para ver os números. Os lançamentos são feitos em cada setor, na data de referência.</p>
        </div>
      </header>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        <div className="field">
          <label htmlFor="periodo">Período</label>
          <select id="periodo" name="periodo" defaultValue={periodo} className="h-11">
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>{p.rotulo}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="data">Data de referência</label>
          <input id="data" name="data" type="date" defaultValue={data} className="h-11" />
        </div>
        <button type="submit" className="btn btn-ghost h-11">Ver</button>
        <p className="w-full text-sm text-ink-muted">Mostrando: {br(est.inicio)}{est.inicio !== est.fim ? ` a ${br(est.fim)}` : ''}</p>
      </form>

      {/* ── Estaleiro de solda ─────────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="estaleiro">
        <h2 id="estaleiro" className="section-title">Estaleiro de solda</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Cartao rotulo="Soldas" valor={est.totais.soldas} />
          <Cartao rotulo="Cortes" valor={est.totais.cortes} />
          <Cartao rotulo="Tampões carregados" valor={est.carreta.tampoes} />
          <Cartao rotulo="Trilho novo (m)" valor={fmtMetros(est.carreta.trilhoNovoM)} />
          <Cartao rotulo="Sucata saída (t)" valor={fmtPeso(est.carreta.sucataT)} />
        </div>

        <div className="card space-y-3">
          <p className="font-semibold">Produção de {br(data)}</p>
          <FormularioUsina acao={salvarEstaleiroAction}>
            <input type="hidden" name="data" value={data} />
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
            <input type="hidden" name="data" value={data} />
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

        <div className="card space-y-3">
          <p className="font-semibold">Escala da semana</p>
          <p className="text-sm text-ink-muted">Enviada na segunda-feira. O formato ainda será definido.</p>
          <FormularioUsina acao={salvarEscalaAction}>
            <input type="hidden" name="semana" value={est.semana} />
            <div className="field">
              <label htmlFor="conteudo">Escala</label>
              <textarea id="conteudo" name="conteudo" rows={4} defaultValue={est.escala} className="w-full" />
            </div>
          </FormularioUsina>
        </div>
      </section>

      {/* ── Geração de trilho ──────────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="geracao">
        <h2 id="geracao" className="section-title">Geração de trilho</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {ger.porLider.map((l) => (
            <div className="card space-y-2" key={l.valor}>
              <p className="font-semibold">{l.rotulo}</p>
              <p className="text-sm">Corte: {fmtMetros(l.periodo.corteM)} m · Carregamento: {fmtMetros(l.periodo.carregamentoM)} m</p>
              <p className="text-sm">Barras: {l.periodo.quantidade} · Deixadas na via: {fmtMetros(l.periodo.deixadaViaM)} m</p>
              <p className="text-xs text-ink-muted">
                Mês: {fmtMetros(l.mes.totalM)} m (carregado + deixado) · {l.mes.metaAlcancada ? 'meta de 5.000 m alcançada' : 'abaixo da meta de 5.000 m'}
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
                  <input type="hidden" name="data" value={data} />
                  <input type="hidden" name="lider" value={l.valor} />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="field"><label>Local</label><input name="local" defaultValue={dia?.local ?? ''} className="h-11" /></div>
                    <div className="field"><label>Perfil</label><input name="perfil" defaultValue={dia?.perfil ?? ''} className="h-11" placeholder="TR60" /></div>
                    <div className="field"><label>Quantidade (barras)</label><input name="quantidade" inputMode="numeric" defaultValue={dia?.quantidade ?? ''} className="h-11" /></div>
                    <div className="field"><label>Corte (m)</label><input name="corteM" inputMode="decimal" defaultValue={dia?.corteM != null ? String(dia.corteM) : ''} className="h-11" /></div>
                    <div className="field"><label>Carregamento (m)</label><input name="carregamentoM" inputMode="decimal" defaultValue={dia?.carregamentoM != null ? String(dia.carregamentoM) : ''} className="h-11" /></div>
                    <div className="field"><label>Deixada na via (m)</label><input name="deixadaViaM" inputMode="decimal" defaultValue={dia?.deixadaViaM != null ? String(dia.deixadaViaM) : ''} className="h-11" /></div>
                  </div>
                </FormularioUsina>
              </div>
            </details>
          );
        })}
      </section>

      {/* ── Composições ativas ─────────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="composicoes">
        <h2 id="composicoes" className="section-title">Composições ativas</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {comp.map((c) => (
            <div className="card space-y-3" key={c.ativo}>
              <p className="font-semibold">{c.ativo}</p>
              <p className="text-sm">No período: {c.barras} barras · {c.jacares} jacarés</p>
              <FormularioUsina acao={salvarComposicaoAction}>
                <input type="hidden" name="data" value={data} />
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
        <h2 id="caminhao" className="section-title">Caminhão de solda</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {cam.map((c) => (
            <div className="card space-y-3" key={c.caminhao}>
              <p className="font-semibold">{c.caminhao}</p>
              <p className="text-sm">No período: produção {c.periodo.producao} · perda {c.periodo.perda}</p>
              <p className="text-xs text-ink-muted">Acumulado do mês: produção {c.mes.producao} · perda {c.mes.perda} — Acumulado do ano: produção {c.ano.producao} · perda {c.ano.perda}</p>
              <FormularioUsina acao={salvarCaminhaoAction}>
                <input type="hidden" name="data" value={data} />
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
        <h2 id="trilheiros" className="section-title">Trilheiros</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Cartao rotulo="Média de dias úteis na usina" valor={tril.mediaDiasUteisNaUsina ?? '—'} />
          <Cartao rotulo="Giros com tempo medido" valor={tril.girosComTempo} />
          <Cartao rotulo="Manutenções no período" valor={tril.manutencoes.length} />
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-muted">
                <th>Trilheiro</th><th>B.O.</th><th>Chegada</th><th>Partida</th><th>Retorno</th><th>Perfil</th><th>Carregados</th><th>Descarregados</th><th>Local</th>
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
                  <td>{g.perfil ? ROTULO_TLS[g.perfil] : '—'}</td>
                  <td>{g.carregados}</td>
                  <td>{g.descarregados}</td>
                  <td>{g.local ?? '—'}</td>
                </tr>
              ))}
              {tril.giros.length === 0 && (
                <tr><td colSpan={9} className="py-3 text-ink-muted">Nenhum giro neste período.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <details className="card">
          <summary className="cursor-pointer font-semibold">Lançar giro de trilheiro</summary>
          <div className="mt-3">
            <FormularioUsina acao={salvarGiroAction} rotuloBotao="Salvar giro">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="field"><label>Trilheiro</label>
                  <select name="trilheiro" className="h-11">{TRILHEIROS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                </div>
                <div className="field"><label>Dia do B.O.</label><input name="boEm" type="date" className="h-11" /></div>
                <div className="field"><label>Chegada na usina</label><input name="chegadaUsinaEm" type="date" className="h-11" /></div>
                <div className="field"><label>Dia da partida</label><input name="partidaEm" type="date" className="h-11" /></div>
                <div className="field"><label>Retorno</label><input name="retornoEm" type="date" className="h-11" /></div>
                <div className="field"><label>Perfil</label>
                  <select name="perfil" className="h-11" defaultValue="">
                    <option value="">—</option>
                    {TIPOS_TLS.map((t) => <option key={t} value={t}>{ROTULO_TLS[t]}</option>)}
                  </select>
                </div>
                <div className="field"><label>TLS carregados</label><input name="carregados" inputMode="numeric" className="h-11" /></div>
                <div className="field"><label>TLS descarregados</label><input name="descarregados" inputMode="numeric" className="h-11" /></div>
                <div className="field"><label>Local</label><input name="local" className="h-11" /></div>
              </div>
              <div className="field"><label>Observação</label><input name="observacao" className="h-11" /></div>
            </FormularioUsina>
          </div>
        </details>

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
              <li key={m.id}><span className="font-mono">{br(m.data.toISOString().slice(0, 10))}</span> · {m.trilheiro} · {m.tipo ?? 'Manutenção'}{m.local ? ` · ${m.local}` : ''}{m.detalhamento ? ` — ${m.detalhamento}` : ''}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
