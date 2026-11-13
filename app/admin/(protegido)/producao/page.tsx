import { TrilhoTls } from '@/components/producao/TrilhoTls';
import { FABRICANTE_REEMPREGO, SOLDAS_POR_TLS, buscarDia, horasDoDia, paradasDaLinha, paradasEmAndamento, respostaTlsDaLinha, totaisDoAno } from '@/lib/services/producao';
import { AoVivo } from '@/components/producao/AoVivo';
import { BotaoImprimirPagina } from '@/components/producao/BotaoImprimirPagina';
import { BotaoBaixarImagem, type DadosImagemProducao } from '@/components/producao/BotaoBaixarImagem';

export const dynamic = 'force-dynamic';

function hojeSP(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Hora em que a parada terminou: início mais o tempo de parada. */
function fimDaParada(inicio: string, minutos: number): string {
  const [h, m] = inicio.split(':').map(Number);
  const t = (h * 60 + m + minutos) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

const fimDaHora = (hora: string) => `${String(Number(hora.slice(0, 2)) + 1).padStart(2, '0')}:00`;

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function dataExtensa(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${dia}, ${d} de ${MESES[m - 1]} de ${a}`;
}

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string | number; detalhe?: string }) {
  return (
    <div className="doc-indicador card space-y-1 p-4">
      <p className="doc-rotulo kv-label">{rotulo}</p>
      <p className="doc-valor text-2xl font-semibold tabular-nums">{valor}</p>
      {detalhe && <p className="doc-detalhe text-xs text-ink-muted">{detalhe}</p>}
    </div>
  );
}

/** Producao do dia no Administrativo: resumo, ritmo por hora, a tabela completa e impressao. */
export default async function ProducaoAdminPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const params = await searchParams;
  const dataTexto = /^\d{4}-\d{2}-\d{2}$/.test(params.data ?? '') ? (params.data as string) : hojeSP();
  const data = new Date(`${dataTexto}T00:00:00Z`);
  const dia = await buscarDia(data);
  const porHora = new Map((dia?.linhas ?? []).map((l) => [l.hora, l]));
  const horas = horasDoDia(data);
  const anual = await totaisDoAno(data.getUTCFullYear());

  const totalSoldas = dia?.totalSoldas ?? 0;
  const totalCortes = horas.reduce((t, h) => t + (porHora.get(h)?.cortes ?? 0), 0);
  const totalParadaMin = horas.reduce((t, h) => t + paradasDaLinha(porHora.get(h)?.paradas).reduce((s, p) => s + p.minutos, 0), 0);
  const maiorHora = Math.max(1, ...horas.map((h) => porHora.get(h)?.soldas ?? 0));

  const emitidoEm = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16).split('T');
  const emitido = `${emitidoEm[0].split('-').reverse().join('/')} às ${emitidoEm[1]}`;
  const tempoParada = totalParadaMin ? `${Math.floor(totalParadaMin / 60)}h${String(totalParadaMin % 60).padStart(2, '0')}` : '—';

  const temReemprego = (dia?.linhas ?? []).some((l) => l.fabricante === FABRICANTE_REEMPREGO);
  const terminouEmReemprego = dia?.linhas.at(-1)?.fabricante === FABRICANTE_REEMPREGO;

  let acumulado = 0;
  const linhas = horas.map((hora) => {
    const l = porHora.get(hora);
    acumulado += l?.soldas ?? 0;
    // Reemprego: o TLS fecha na hora em que o soldador respondeu que encerrou.
    const fechou = l?.fabricante === FABRICANTE_REEMPREGO ? /^sim:(\d+)$/.exec(respostaTlsDaLinha(l.paradas)) : null;
    return { hora, l, acumulado, tlsCom: fechou ? Number(fechou[1]) : 0 };
  });

  // Ao vivo (só no dia de hoje): o que o soldador preenche chega aqui sozinho, sem esperar o "Salvar o dia".
  const aoVivo = dataTexto === hojeSP();
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(11, 16);
  const horaAgora = `${agora.slice(0, 2)}:00`;
  const ultima = dia?.linhas.at(-1);
  const horasComSolda = (dia?.linhas ?? []).filter((l) => l.soldas > 0).length;
  const media = horasComSolda ? (totalSoldas / horasComSolda).toFixed(1).replace('.', ',') : null;
  const paradaAberta = (dia?.linhas ?? []).flatMap((l) => paradasEmAndamento(l.paradas)).at(-1);
  const atualizado = dia ? new Date(dia.atualizadoEm.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(11, 16) : null;
  const sobra = dia?.sobraSaida ?? 0;

  // Os mesmos números da folha impressa, prontos para virar imagem no navegador.
  const dataBr = dataTexto.split('-').reverse().join('/');
  const dadosImagem: DadosImagemProducao = {
    arquivo: `producao-${dataTexto}.png`,
    dataExtensa: dataExtensa(dataTexto),
    soldador: dia?.soldadores || '—',
    perfil: dia?.perfil ?? '—',
    fabricante: dia?.fabricante ?? '—',
    indicadores: [
      { rotulo: 'Soldas no dia', valor: String(totalSoldas) },
      { rotulo: 'TLS formados', valor: String(dia?.tlsFormados ?? 0), detalhe: temReemprego ? 'reemprego: quando o soldador encerra' : `a cada ${SOLDAS_POR_TLS} soldas` },
      { rotulo: terminouEmReemprego ? 'TLS em aberto' : 'Sobra para amanhã', valor: String(dia?.sobraSaida ?? 0), detalhe: terminouEmReemprego ? 'soldas no TLS de reemprego' : undefined },
      { rotulo: 'Cortes', valor: String(totalCortes), detalhe: totalParadaMin ? `${totalParadaMin} min de parada` : 'sem paradas' },
    ],
    linhas: linhas.map(({ hora, l, acumulado: acc, tlsCom }) => ({
      hora,
      faixa: `${hora} às ${fimDaHora(hora)}`,
      lancada: Boolean(l),
      soldas: l?.soldas ?? 0,
      acumulado: acc,
      perfil: l?.perfil ?? '—',
      fabricante: l?.fabricante ?? '—',
      cortes: l?.cortes ?? 0,
      paradas: [
        ...(tlsCom > 0 ? [{ forte: 'TLS encerrado', resto: ` com ${tlsCom} soldas` }] : []),
        ...paradasDaLinha(l?.paradas).map((p) => ({
          forte: p.inicio ? `${p.inicio}–${fimDaParada(p.inicio, p.minutos)}` : 'Sem horário',
          resto: ` · ${p.minutos} min${p.descricao ? ` · ${p.descricao}` : ''}`,
        })),
        ...(l?.justificativaCorte ? [{ forte: '', resto: `Corte: ${l.justificativaCorte}` }] : []),
      ],
    })),
    totalSoldas,
    totalCortes,
    totalParada: totalParadaMin ? `${tempoParada} parado no dia` : 'Sem paradas',
    rodape: `Controle de Trilhos · Produção do dia ${dataBr}`,
    emitido,
  };

  return (
    <main className="planilha-producao mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <form action="/admin/producao" className="flex flex-wrap items-end gap-2">
          <div className="field"><label htmlFor="data-producao">Dia</label><input id="data-producao" name="data" type="date" defaultValue={dataTexto} className="h-11" /></div>
          <button type="submit" className="btn btn-ghost h-11">Ver dia</button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <BotaoBaixarImagem dados={dadosImagem} />
          <BotaoImprimirPagina />
        </div>
      </div>

      {/* Cabeçalho do documento impresso (na tela vale o cabeçalho de baixo). */}
      <div className="so-impressao doc-topo">
        <div>
          <p className="doc-topo-sistema doc-topo-marca">
            <span>Controle de Trilhos</span>
            <span aria-hidden>-</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-rumo-relatorio.png" alt="Rumo" />
          </p>
          <p className="doc-topo-titulo">Relatório de produção</p>
          <p className="doc-topo-sub">Estaleiro de soldas - Bauru · {dataExtensa(dataTexto)}</p>
        </div>
        <dl className="doc-ficha">
          <div><dt>Soldador</dt><dd>{dia?.soldadores ?? '—'}</dd></div>
          <div><dt>Trilho do dia</dt><dd>{dia?.perfil ?? '—'}</dd></div>
          <div><dt>Fabricante</dt><dd>{dia?.fabricante ?? '—'}</dd></div>
        </dl>
      </div>

      {aoVivo && (
        <section className="so-tela turno" aria-label="Produção de hoje, atualizada sozinha">
          <AoVivo atualizado={atualizado} />
          <dl className="turno-linhas">
            <div className="turno-linha turno-soldas">
              <dt>Soldas</dt>
              <dd>
                <b>{totalSoldas}</b>
                <span>
                  {dia
                    ? `${porHora.get(horaAgora)?.soldas ?? 0} na hora das ${horaAgora}${media ? ` · média de ${media} por hora` : ''}`
                    : 'A Produção ainda não lançou nada hoje.'}
                </span>
              </dd>
            </div>
            <div className="turno-linha">
              <dt>TLS</dt>
              <dd>
                <b>{dia?.tlsFormados ?? 0}</b>
                <span>{(dia?.tlsFormados ?? 0) === 1 ? 'formado' : 'formados'}</span>
                {terminouEmReemprego ? (
                  <span className="turno-quebra">TLS de reemprego em aberto com {sobra} soldas</span>
                ) : (
                  <>
                    {/* O trilho do TLS em montagem: cada solda emenda mais uma barra (12 fecham um TLS). */}
                    <TrilhoTls feitas={sobra} total={SOLDAS_POR_TLS} />
                    <span className="turno-quebra">{sobra} de {SOLDAS_POR_TLS} soldas no próximo TLS</span>
                  </>
                )}
              </dd>
            </div>
            {paradaAberta ? (
              <div className="turno-linha" data-parada="true">
                <dt>Parado</dt>
                <dd><span>desde as {paradaAberta.inicio}{paradaAberta.descricao ? ` · ${paradaAberta.descricao}` : ''}</span></dd>
              </div>
            ) : (
              <div className="turno-linha">
                <dt>Trilho</dt>
                <dd><span className="turno-forte">{ultima ? `${ultima.perfil} · ${ultima.fabricante}` : 'Sem lançamento'}</span>{dia?.soldadores ? <span>soldador {dia.soldadores}</span> : null}</dd>
              </div>
            )}
            <div className="turno-linha">
              <dt>Paradas</dt>
              <dd><span>{totalParadaMin ? `${tempoParada} parado` : 'sem paradas encerradas'} · {totalCortes} {totalCortes === 1 ? 'corte' : 'cortes'}</span></dd>
            </div>
          </dl>
        </section>
      )}

      <section className="doc-indicadores grid grid-cols-3 gap-3" aria-label={`Total de ${data.getUTCFullYear()}`}>
        <Indicador rotulo={`Soldas em ${data.getUTCFullYear()}`} valor={anual.soldas} detalhe={`${anual.dias} ${anual.dias === 1 ? 'dia lançado' : 'dias lançados'}`} />
        <Indicador rotulo={`Cortes em ${data.getUTCFullYear()}`} valor={anual.cortes} />
        <Indicador rotulo="Média por dia" valor={anual.dias ? (anual.soldas / anual.dias).toFixed(1).replace('.', ',') : '—'} />
      </section>

      <header className="so-tela space-y-2">
        <p className="kv-label">Produção · Estaleiro de soldas - Bauru</p>
        <h1 className="font-condensed text-3xl font-bold uppercase tracking-wide">{dataExtensa(dataTexto)}</h1>
        <p className="text-sm text-ink-muted">
          Soldador <strong className="text-ink">{dia?.soldadores ?? '—'}</strong>
        </p>
        <p className="text-sm text-ink-muted">
          Trilho do dia <strong className="text-ink">{dia?.perfil ?? '—'}</strong> · Fabricante <strong className="text-ink">{dia?.fabricante ?? '—'}</strong>
        </p>
      </header>

      <section className="doc-indicadores grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Soldas no dia" valor={totalSoldas} />
        <Indicador rotulo="TLS formados" valor={dia?.tlsFormados ?? 0} detalhe={temReemprego ? 'reemprego: quando o soldador encerra' : `a cada ${SOLDAS_POR_TLS} soldas`} />
        <Indicador rotulo={terminouEmReemprego ? 'TLS em aberto' : 'Sobra para amanhã'} valor={dia?.sobraSaida ?? 0} detalhe={terminouEmReemprego ? 'soldas no TLS de reemprego' : undefined} />
        <Indicador rotulo="Cortes" valor={totalCortes} detalhe={totalParadaMin ? `${totalParadaMin} min de parada` : 'sem paradas'} />
      </section>

      <section className="doc-bloco doc-ritmo card space-y-3 p-4">
        <h2 className="section-title">Ritmo por hora</h2>
        <ul className="space-y-2">
          {linhas.map(({ hora, l }) => {
            const pct = Math.round(((l?.soldas ?? 0) / maiorHora) * 100);
            return (
              <li key={hora} className="doc-ritmo-linha grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="whitespace-nowrap text-ink-muted">{hora} às {fimDaHora(hora)}</span>
                <span className="barra-trilho h-3 overflow-hidden rounded-full bg-surface-2">
                  <span className="barra-fill block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums">{l?.soldas || '—'}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Na tela: uma linha por hora, sem rolagem para o lado. A tabela completa fica só para a impressão. */}
      <section className="so-tela card space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="section-title">Detalhe por hora</h2>
          <p className="text-sm text-ink-muted">
            {totalSoldas} soldas · {totalCortes} {totalCortes === 1 ? 'corte' : 'cortes'} · {totalParadaMin ? `${tempoParada} parado` : 'sem paradas'}
          </p>
        </div>
        <ol className="hora-lista">
          {linhas.map(({ hora, l, acumulado: acc, tlsCom }, i) => {
            const paradas = paradasDaLinha(l?.paradas);
            const abertas = paradasEmAndamento(l?.paradas);
            const anterior = linhas.slice(0, i).reverse().find((x) => x.l)?.l;
            const trocou = Boolean(l && anterior && (l.perfil !== anterior.perfil || l.fabricante !== anterior.fabricante));
            const almoco = hora === '12:00' && !l;
            return (
              <li key={hora} className="hora-item" data-vazia={l ? undefined : 'true'}>
                <div className="hora-cabeca">
                  <div className="hora-quando">
                    <p className="hora-faixa">{hora} às {fimDaHora(hora)}</p>
                    {l && (
                      <p className="hora-trilho" data-trocou={trocou ? 'true' : undefined}>
                        {trocou ? 'Trocou para ' : ''}{l.perfil} · {l.fabricante}
                      </p>
                    )}
                    {tlsCom > 0 && <p className="hora-trilho" data-trocou="true">TLS encerrado com {tlsCom} soldas</p>}
                    {!l && <p className="hora-trilho">{almoco ? 'Almoço' : 'Sem lançamento'}</p>}
                  </div>
                  {l && (
                    <div className="hora-numeros">
                      {l.cortes > 0 && <span className="hora-cortes">{l.cortes} {l.cortes === 1 ? 'corte' : 'cortes'}</span>}
                      <p className="hora-soldas"><b>{l.soldas}</b> {l.soldas === 1 ? 'solda' : 'soldas'}</p>
                      <p className="hora-acum">acumulado {acc}</p>
                    </div>
                  )}
                </div>
                {(paradas.length > 0 || abertas.length > 0 || l?.justificativaCorte) && (
                  <ul className="hora-paradas">
                    {abertas.map((p, j) => (
                      <li key={`a${j}`} className="hora-parada">
                        <span className="hora-parada-quando">
                          <b>{p.inicio} – em andamento</b>
                        </span>
                        <span className="hora-motivos">
                          {(p.descricao ?? '').split(';').map((m) => m.trim()).filter(Boolean).map((m) => <span key={m} className="hora-motivo">{m}</span>)}
                          {!p.descricao && <span className="hora-sem-motivo">Sem motivo informado</span>}
                        </span>
                      </li>
                    ))}
                    {paradas.map((p, j) => (
                      <li key={j} className="hora-parada">
                        <span className="hora-parada-quando">
                          <b>{p.inicio ? `${p.inicio} – ${fimDaParada(p.inicio, p.minutos)}` : 'Sem horário'}</b>
                          <span className="hora-parada-min">{p.minutos} min</span>
                        </span>
                        <span className="hora-motivos">
                          {(p.descricao ?? '').split(';').map((m) => m.trim()).filter(Boolean).map((m) => <span key={m} className="hora-motivo">{m}</span>)}
                          {!p.descricao && <span className="hora-sem-motivo">Sem motivo informado</span>}
                        </span>
                      </li>
                    ))}
                    {l?.justificativaCorte && <li className="hora-parada"><span className="hora-motivos"><span className="hora-motivo">Corte: {l.justificativaCorte}</span></span></li>}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="so-impressao-bloco doc-bloco card tabela-impressao overflow-x-auto p-4">
        <h2 className="section-title mb-3">Detalhe por hora</h2>
        <table className="doc-tabela w-full min-w-[640px] text-left text-sm">
          <colgroup><col className="c-hora" /><col className="c-num" /><col className="c-num" /><col className="c-txt" /><col className="c-fab" /><col className="c-num" /><col /></colgroup>
          <thead className="text-xs uppercase text-ink-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-2">Hora</th>
              <th className="py-2 pr-2 text-right">Soldas</th>
              <th className="py-2 pr-2 text-right" title="Acumulado">Acum.</th>
              <th className="py-2 pr-2">Trilho</th>
              <th className="py-2 pr-2">Fabricante</th>
              <th className="py-2 pr-2 text-right">Cortes</th>
              <th className="py-2">Paradas (horário, tempo e motivo)</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ hora, l, acumulado: acc, tlsCom }) => (
              <tr key={hora} className="border-b border-line align-top">
                <td className="py-2 pr-2 whitespace-nowrap">{hora}</td>
                <td className="py-2 pr-2 text-right tabular-nums font-semibold">{l?.soldas || '—'}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{l ? acc : '—'}</td>
                <td className="py-2 pr-2">{l?.perfil ?? '—'}</td>
                <td className="py-2 pr-2">{l?.fabricante ?? '—'}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{l?.cortes || '—'}</td>
                <td className="py-2 doc-paradas">
                  {paradasDaLinha(l?.paradas).length === 0 && !l?.justificativaCorte && !tlsCom ? '—' : (
                    <>
                      {tlsCom > 0 && <span className="doc-parada"><b>TLS encerrado</b>{` com ${tlsCom} soldas`}</span>}
                      {paradasDaLinha(l?.paradas).map((p, i) => (
                        <span key={i} className="doc-parada">
                          <b>{p.inicio ? `${p.inicio}–${fimDaParada(p.inicio, p.minutos)}` : 'Sem horário'}</b>
                          {` · ${p.minutos} min`}
                          {p.descricao ? ` · ${p.descricao}` : ''}
                        </span>
                      ))}
                      {l?.justificativaCorte && <span className="doc-parada">Corte: {l.justificativaCorte}</span>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 pr-2">Total</td>
              <td className="py-2 pr-2 text-right tabular-nums">{totalSoldas}</td>
              <td className="py-2 pr-2" />
              <td className="py-2 pr-2" />
              <td className="py-2 pr-2" />
              <td className="py-2 pr-2 text-right tabular-nums">{totalCortes || '—'}</td>
              <td className="py-2">{totalParadaMin ? `${tempoParada} parado no dia` : 'Sem paradas'}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <p className="so-impressao doc-rodape">
        <span>Controle de Trilhos · Produção do dia {dataTexto.split('-').reverse().join('/')}</span>
        <span>Emitido em {emitido}</span>
      </p>
    </main>
  );
}
