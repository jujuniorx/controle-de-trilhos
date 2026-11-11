import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_PRODUCAO, cookieProducaoValido } from '@/lib/services/producaoAcesso';
import { SOLDAS_POR_TLS, buscarDia, horasDoDia } from '@/lib/services/producao';
import { BotaoImprimirPagina } from '@/components/producao/BotaoImprimirPagina';

export const dynamic = 'force-dynamic';

function hojeSP(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
    <div className="card space-y-1 p-4">
      <p className="kv-label">{rotulo}</p>
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
      {detalhe && <p className="text-xs text-ink-muted">{detalhe}</p>}
    </div>
  );
}

/** Relatorio do dia da Producao, pronto para imprimir: resumo, ritmo por hora e a tabela completa. */
export default async function ImprimirProducaoPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  if (!cookieProducaoValido((await cookies()).get(COOKIE_PRODUCAO)?.value)) redirect('/producao/login');
  const params = await searchParams;
  const dataTexto = /^\d{4}-\d{2}-\d{2}$/.test(params.data ?? '') ? (params.data as string) : hojeSP();
  const data = new Date(`${dataTexto}T00:00:00Z`);
  const dia = await buscarDia(data);
  const porHora = new Map((dia?.linhas ?? []).map((l) => [l.hora, l]));
  const horas = horasDoDia(data);

  const totalSoldas = dia?.totalSoldas ?? 0;
  const totalCortes = horas.reduce((t, h) => t + (porHora.get(h)?.cortes ?? 0), 0);
  const totalParadaMin = horas.reduce((t, h) => t + (porHora.get(h)?.paradaMinutos ?? 0), 0);
  const maiorHora = Math.max(1, ...horas.map((h) => porHora.get(h)?.soldas ?? 0));

  let acumulado = 0;
  const linhas = horas.map((hora) => {
    const l = porHora.get(hora);
    acumulado += l?.soldas ?? 0;
    return { hora, l, acumulado };
  });

  return (
    <main className="planilha-producao mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <a href={`/producao?data=${dataTexto}`} className="btn btn-ghost btn-sm">Voltar</a>
        <BotaoImprimirPagina />
      </div>

      <header className="space-y-2">
        <p className="kv-label">Produção · Usina Triagem Paulista</p>
        <h1 className="font-condensed text-3xl font-bold uppercase tracking-wide">{dataExtensa(dataTexto)}</h1>
        <p className="text-sm text-ink-muted">
          Líder <strong className="text-ink">{dia?.lider ?? '—'}</strong> · Soldadores <strong className="text-ink">{dia?.soldadores ?? '—'}</strong>
        </p>
        <p className="text-sm text-ink-muted">
          Trilho do dia <strong className="text-ink">{dia?.perfil ?? '—'}</strong> · Fabricante <strong className="text-ink">{dia?.fabricante ?? '—'}</strong>
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Soldas no dia" valor={totalSoldas} />
        <Indicador rotulo="TLS formados" valor={dia?.tlsFormados ?? 0} detalhe={`a cada ${SOLDAS_POR_TLS} soldas`} />
        <Indicador rotulo="Sobra para amanhã" valor={dia?.sobraSaida ?? 0} />
        <Indicador rotulo="Cortes" valor={totalCortes} detalhe={totalParadaMin ? `${totalParadaMin} min de parada` : 'sem paradas'} />
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="section-title">Ritmo por hora</h2>
        <ul className="space-y-2">
          {linhas.map(({ hora, l }) => {
            const pct = Math.round(((l?.soldas ?? 0) / maiorHora) * 100);
            return (
              <li key={hora} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="whitespace-nowrap text-ink-muted">{hora} às {fimDaHora(hora)}</span>
                <span className="h-3 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums">{l?.soldas || '—'}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card overflow-x-auto p-4">
        <h2 className="section-title mb-3">Detalhe por hora</h2>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase text-ink-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-2">Hora</th>
              <th className="py-2 pr-2 text-right">Soldas</th>
              <th className="py-2 pr-2 text-right">Acumulado</th>
              <th className="py-2 pr-2">Trilho</th>
              <th className="py-2 pr-2">Fabricante</th>
              <th className="py-2 pr-2 text-right">Cortes</th>
              <th className="py-2 pr-2">Parada</th>
              <th className="py-2">Observação</th>
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
                <td className="py-2 pr-2 whitespace-nowrap">{l?.paradaMinutos ? `${l.paradaInicio ?? ''} · ${l.paradaMinutos} min` : '—'}</td>
                <td className="py-2">
                  {[l?.paradaDescricao, l?.justificativaCorte && `Corte: ${l.justificativaCorte}`].filter(Boolean).join(' · ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
