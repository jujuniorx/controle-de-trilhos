import Link from 'next/link';
import type { ResumoPeriodo } from '@/lib/services/producao';

function dataBr(iso: string): string {
  return iso.split('-').reverse().join('/');
}

function tempoDeParada(min: number | null): string {
  if (min === null) return '—';
  return min ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : '0h00';
}

const naoRegistrado = '—';

/** Soldas, TLS, cortes e paradas somados entre duas datas, com uma linha por dia com lançamento. */
export function PeriodoProducao({ de, ate, resumo }: { de: string; ate: string; resumo: ResumoPeriodo }) {
  const comLancamento = resumo.dias.filter((d) => d.soldas > 0 || (d.tlsFormados ?? 0) > 0 || d.cortes > 0 || (d.paradaMin ?? 0) > 0);
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kv-label">Produção · Estaleiro de soldas - Bauru</p>
          <h1 className="font-condensed text-3xl font-bold uppercase tracking-wide">Período</h1>
          <p className="text-sm text-ink-muted">De {dataBr(de)} até {dataBr(ate)} · {resumo.diasComLancamento} {resumo.diasComLancamento === 1 ? 'dia com solda' : 'dias com solda'}</p>
        </div>
        <Link href="/admin/producao" className="btn btn-ghost h-11">Voltar para o dia</Link>
      </div>

      <form action="/admin/producao" className="card flex flex-wrap items-end gap-2">
        <div className="field"><label htmlFor="periodo-de">Desde</label><input id="periodo-de" name="de" type="date" defaultValue={de} className="h-11" required /></div>
        <div className="field"><label htmlFor="periodo-ate">Até</label><input id="periodo-ate" name="ate" type="date" defaultValue={ate} className="h-11" required /></div>
        <button type="submit" className="btn btn-primary h-11">Ver período</button>
      </form>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card space-y-1 p-4">
          <p className="kv-label">Soldas</p>
          <p className="text-xs text-ink-muted">Todo o período</p>
          <p className="text-2xl font-semibold tabular-nums">{resumo.soldas}</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="kv-label">TLS formados</p>
          <p className="text-xs text-ink-muted">{resumo.inicioRegistro ? `Desde ${dataBr(resumo.inicioRegistro)}` : 'Sem registro no período'}</p>
          <p className="text-2xl font-semibold tabular-nums">{resumo.tlsFormados}</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="kv-label">Cortes</p>
          <p className="text-xs text-ink-muted">Todo o período</p>
          <p className="text-2xl font-semibold tabular-nums">{resumo.cortes}</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="kv-label">Parado</p>
          <p className="text-xs text-ink-muted">{resumo.inicioRegistro ? `Desde ${dataBr(resumo.inicioRegistro)}` : 'Sem registro no período'}</p>
          <p className="text-2xl font-semibold tabular-nums">{tempoDeParada(resumo.paradaMin)}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Dia a dia</h2>
        {comLancamento.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum lançamento de produção nesse período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela-paradas w-full text-sm tabular-nums">
              <thead className="text-xs uppercase text-ink-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-2 text-left">Dia</th>
                  <th className="py-2 pr-2 text-left">Soldador</th>
                  <th className="py-2 pr-2 text-right">Soldas</th>
                  <th className="py-2 pr-2 text-right">TLS</th>
                  <th className="py-2 pr-2 text-right">Cortes</th>
                  <th className="py-2 text-right">Parado</th>
                </tr>
              </thead>
              <tbody>
                {comLancamento.map((d) => (
                  <tr key={d.data} className="border-b border-line">
                    <td className="py-2 pr-2">
                      <Link href={`/admin/producao?data=${d.data}`} className="font-semibold text-accent">{dataBr(d.data)}</Link>
                    </td>
                    <td className="py-2 pr-2">{d.soldadores || naoRegistrado}</td>
                    <td className="py-2 pr-2 text-right">{d.soldas}</td>
                    <td className="py-2 pr-2 text-right">{d.tlsFormados ?? naoRegistrado}</td>
                    <td className="py-2 pr-2 text-right">{d.cortes}</td>
                    <td className="py-2 text-right">{d.paradaMin === null ? naoRegistrado : tempoDeParada(d.paradaMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
