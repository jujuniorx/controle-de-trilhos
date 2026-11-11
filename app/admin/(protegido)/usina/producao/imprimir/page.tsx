import { SOLDAS_POR_TLS, buscarDia, horasDoDia, paradasDaLinha } from '@/lib/services/producao';
import { BotaoImprimirPagina } from '@/components/producao/BotaoImprimirPagina';

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

/** Relatorio do dia da Producao (so Administrativo), pronto para imprimir: resumo, ritmo por hora e a tabela completa. */
export default async function ImprimirProducaoPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const params = await searchParams;
  const dataTexto = /^\d{4}-\d{2}-\d{2}$/.test(params.data ?? '') ? (params.data as string) : hojeSP();
  const data = new Date(`${dataTexto}T00:00:00Z`);
  const dia = await buscarDia(data);
  const porHora = new Map((dia?.linhas ?? []).map((l) => [l.hora, l]));
  const horas = horasDoDia(data);

  const totalSoldas = dia?.totalSoldas ?? 0;
  const totalCortes = horas.reduce((t, h) => t + (porHora.get(h)?.cortes ?? 0), 0);
  const totalParadaMin = horas.reduce((t, h) => t + paradasDaLinha(porHora.get(h)?.paradas).reduce((s, p) => s + p.minutos, 0), 0);
  const maiorHora = Math.max(1, ...horas.map((h) => porHora.get(h)?.soldas ?? 0));

  const emitidoEm = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16).split('T');
  const emitido = `${emitidoEm[0].split('-').reverse().join('/')} às ${emitidoEm[1]}`;
  const tempoParada = totalParadaMin ? `${Math.floor(totalParadaMin / 60)}h${String(totalParadaMin % 60).padStart(2, '0')}` : '—';

  let acumulado = 0;
  const linhas = horas.map((hora) => {
    const l = porHora.get(hora);
    acumulado += l?.soldas ?? 0;
    return { hora, l, acumulado };
  });

  return (
    <main className="planilha-producao mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <a href={`/admin/usina?data=${dataTexto}`} className="btn btn-ghost btn-sm">Voltar</a>
        <BotaoImprimirPagina />
      </div>

      {/* Cabeçalho do documento impresso (na tela vale o cabeçalho de baixo). */}
      <div className="so-impressao doc-topo">
        <div>
          <p className="doc-topo-sistema">Controle de Trilhos</p>
          <p className="doc-topo-titulo">Relatório de produção</p>
          <p className="doc-topo-sub">Usina Triagem Paulista · {dataExtensa(dataTexto)}</p>
        </div>
        <dl className="doc-ficha">
          <div><dt>Líder</dt><dd>{dia?.lider ?? '—'}</dd></div>
          <div><dt>Soldadores</dt><dd>{dia?.soldadores ?? '—'}</dd></div>
          <div><dt>Trilho do dia</dt><dd>{dia?.perfil ?? '—'}</dd></div>
          <div><dt>Fabricante</dt><dd>{dia?.fabricante ?? '—'}</dd></div>
        </dl>
      </div>

      <header className="so-tela space-y-2">
        <p className="kv-label">Produção · Usina Triagem Paulista</p>
        <h1 className="font-condensed text-3xl font-bold uppercase tracking-wide">{dataExtensa(dataTexto)}</h1>
        <p className="text-sm text-ink-muted">
          Líder <strong className="text-ink">{dia?.lider ?? '—'}</strong> · Soldadores <strong className="text-ink">{dia?.soldadores ?? '—'}</strong>
        </p>
        <p className="text-sm text-ink-muted">
          Trilho do dia <strong className="text-ink">{dia?.perfil ?? '—'}</strong> · Fabricante <strong className="text-ink">{dia?.fabricante ?? '—'}</strong>
        </p>
      </header>

      <section className="doc-indicadores grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Soldas no dia" valor={totalSoldas} />
        <Indicador rotulo="TLS formados" valor={dia?.tlsFormados ?? 0} detalhe={`a cada ${SOLDAS_POR_TLS} soldas`} />
        <Indicador rotulo="Sobra para amanhã" valor={dia?.sobraSaida ?? 0} />
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

      <section className="doc-bloco card tabela-impressao overflow-x-auto p-4">
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
            {linhas.map(({ hora, l, acumulado: acc }) => (
              <tr key={hora} className="border-b border-line align-top">
                <td className="py-2 pr-2 whitespace-nowrap">{hora}</td>
                <td className="py-2 pr-2 text-right tabular-nums font-semibold">{l?.soldas || '—'}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{l ? acc : '—'}</td>
                <td className="py-2 pr-2">{l?.perfil ?? '—'}</td>
                <td className="py-2 pr-2">{l?.fabricante ?? '—'}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{l?.cortes || '—'}</td>
                <td className="py-2 doc-paradas">
                  {paradasDaLinha(l?.paradas).length === 0 && !l?.justificativaCorte ? '—' : (
                    <>
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
