import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_PRODUCAO, cookieProducaoValido } from '@/lib/services/producaoAcesso';
import { SOLDAS_POR_TLS, buscarDia, horasDoDia } from '@/lib/services/producao';
import { BotaoImprimirPagina } from '@/components/producao/BotaoImprimirPagina';

export const dynamic = 'force-dynamic';

function hojeSP(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function fimDaHora(hora: string): string {
  return `${String(Number(hora.slice(0, 2)) + 1).padStart(2, '0')}:00`;
}

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

/** Planilha de Producao do dia (formato da planilha de Triagem Paulista), pronta para imprimir. */
export default async function ImprimirProducaoPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  if (!cookieProducaoValido((await cookies()).get(COOKIE_PRODUCAO)?.value)) redirect('/producao/login');
  const params = await searchParams;
  const dataTexto = /^\d{4}-\d{2}-\d{2}$/.test(params.data ?? '') ? (params.data as string) : hojeSP();
  const data = new Date(`${dataTexto}T00:00:00Z`);
  const dia = await buscarDia(data);
  const porHora = new Map((dia?.linhas ?? []).map((l) => [l.hora, l]));
  const horas = horasDoDia(data);

  let acumulado = 0;
  const linhas = horas.map((hora) => {
    const l = porHora.get(hora);
    acumulado += l?.soldas ?? 0;
    return { hora, l, acumulado };
  });

  return (
    <main className="planilha-producao mx-auto w-full max-w-4xl space-y-4 p-4 text-sm">
      <div className="no-print flex items-center justify-between gap-3">
        <a href={`/producao?data=${dataTexto}`} className="btn btn-ghost btn-sm">Voltar</a>
        <BotaoImprimirPagina />
      </div>

      <header className="space-y-1 border-b border-line pb-3 text-center">
        <h1 className="text-lg font-bold uppercase">Planilha de Produção — Usina Triagem Paulista</h1>
        <p>Data: <strong>{dataBr(dataTexto)}</strong></p>
        <p>Líder: <strong>{dia?.lider ?? '—'}</strong></p>
        <p>Soldadores: <strong>{dia?.soldadores ?? '—'}</strong></p>
        <p>Trilho do dia (topo): <strong>{dia?.perfil ?? '—'}</strong> · Fabricante: <strong>{dia?.fabricante ?? '—'}</strong></p>
      </header>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="p-1">Hora</th>
            <th className="p-1 text-right">Qtd. de soldas</th>
            <th className="p-1 text-right">Acumulado</th>
            <th className="p-1">Perfil</th>
            <th className="p-1">Fabricante</th>
            <th className="p-1 text-right">Corte</th>
            <th className="p-1">Início da parada</th>
            <th className="p-1 text-right">Tempo de parada (min)</th>
            <th className="p-1">Descrição da parada</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ hora, l, acumulado: acc }) => (
            <tr key={hora} className="border-b border-line align-top">
              <td className="p-1 whitespace-nowrap">{hora} às {fimDaHora(hora)}</td>
              <td className="p-1 text-right tabular-nums">{l?.soldas || ''}</td>
              <td className="p-1 text-right tabular-nums">{l ? acc : ''}</td>
              <td className="p-1">{l?.perfil ?? ''}</td>
              <td className="p-1">{l?.fabricante ?? ''}</td>
              <td className="p-1 text-right tabular-nums">{l?.cortes || ''}</td>
              <td className="p-1">{l?.paradaInicio ?? ''}</td>
              <td className="p-1 text-right tabular-nums">{l?.paradaMinutos || ''}</td>
              <td className="p-1">{l?.paradaDescricao ?? ''}{l?.justificativaCorte ? ` Corte: ${l.justificativaCorte}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="grid grid-cols-2 gap-2 border-t border-line pt-3">
        <p>Total de soldas: <strong>{dia?.totalSoldas ?? 0}</strong></p>
        <p>TLS formados: <strong>{dia?.tlsFormados ?? 0}</strong> (a cada {SOLDAS_POR_TLS} soldas)</p>
        <p>Sobra para amanhã: <strong>{dia?.sobraSaida ?? 0}</strong></p>
      </footer>
    </main>
  );
}
