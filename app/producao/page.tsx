import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_PRODUCAO, cookieProducaoValido } from '@/lib/services/producaoAcesso';
import { FABRICANTES_PRODUCAO, MAX_PARADAS_HORA, PERFIS_PRODUCAO, SOLDAS_POR_TLS, buscarDia, horasDoDia, paradaEmHoraMin, paradasDaLinha } from '@/lib/services/producao';
import { TrocaTopo } from '@/components/producao/TrocaTopo';
import { salvarProducaoAction } from './actions';
import { AlternarTema } from '@/components/ui/AlternarTema';

export const dynamic = 'force-dynamic';

function hojeSP(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function ProducaoPage({ searchParams }: { searchParams: Promise<{ data?: string; ok?: string }> }) {
  if (!cookieProducaoValido((await cookies()).get(COOKIE_PRODUCAO)?.value)) redirect('/producao/login');
  const params = await searchParams;
  const dataTexto = /^\d{4}-\d{2}-\d{2}$/.test(params.data ?? '') ? (params.data as string) : hojeSP();
  const data = new Date(`${dataTexto}T00:00:00Z`);
  const dia = await buscarDia(data);
  const horas = horasDoDia(data);
  const porHora = new Map((dia?.linhas ?? []).map((l) => [l.hora, l]));

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <div className="flex justify-end">
        <AlternarTema />
      </div>
      <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide">Produção do dia</h1>
      {params.ok === '1' && <p role="status" className="rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm">Dia salvo. Soldas: {dia?.totalSoldas ?? 0}, TLS formados: {dia?.tlsFormados ?? 0}, sobra para amanhã: {dia?.sobraSaida ?? 0} de {SOLDAS_POR_TLS}.</p>}

      <form action={salvarProducaoAction} className="space-y-6">
        <section className="card space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="field"><label htmlFor="data">Data</label><input id="data" name="data" type="date" defaultValue={dataTexto} required className="h-11" /></div>
            <div className="field"><label htmlFor="lider">Líder</label><input id="lider" name="lider" defaultValue={dia?.lider ?? ''} required className="h-11" /></div>
            <div className="field sm:col-span-2"><label htmlFor="soldadores">Soldadores</label><input id="soldadores" name="soldadores" defaultValue={dia?.soldadores ?? ''} placeholder="Nomes dos soldadores do turno" required className="h-11" /></div>
            <TrocaTopo
              perfis={PERFIS_PRODUCAO}
              fabricantes={FABRICANTES_PRODUCAO}
              perfilSalvo={dia?.perfil ?? PERFIS_PRODUCAO[0]}
              fabricanteSalvo={dia?.fabricante ?? FABRICANTES_PRODUCAO[0]}
              horas={horas}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="section-title">Hora a hora</h2>
          <p className="text-sm text-ink-muted">Soldas, cortes e paradas de cada hora.</p>
          {horas.map((hora) => {
            const l = porHora.get(hora);
            return (
              <details key={hora} className="card" open={Boolean(l)}>
                <summary className="cursor-pointer font-semibold">{`${hora} às ${String(Number(hora.slice(0, 2)) + 1).padStart(2, '0')}:00`} {l ? `· ${l.soldas} soldas` : ''}</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="field"><label htmlFor={`soldas_${hora}`}>Soldas</label><input id={`soldas_${hora}`} name={`soldas_${hora}`} inputMode="numeric" defaultValue={l?.soldas || ''} className="h-11" /></div>
                  <div className="field"><label htmlFor={`cortes_${hora}`}>Cortes</label><input id={`cortes_${hora}`} name={`cortes_${hora}`} inputMode="numeric" defaultValue={l?.cortes || ''} className="h-11" /></div>
                  <div className="field sm:col-span-2"><label htmlFor={`justificativa_${hora}`}>Justificativa do corte</label><input id={`justificativa_${hora}`} name={`justificativa_${hora}`} defaultValue={l?.justificativaCorte ?? ''} placeholder="Obrigatória se houver corte" className="h-11" /></div>
                  <p className="text-sm font-semibold sm:col-span-2">Paradas desta hora (até {MAX_PARADAS_HORA})</p>
                  {Array.from({ length: MAX_PARADAS_HORA }, (_, i) => i + 1).map((n) => {
                    const p = paradasDaLinha(l?.paradas)[n - 1];
                    return (
                      <div key={n} className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
                        <div className="field"><label htmlFor={`parada_inicio_${hora}_${n}`}>Parada {n}: início</label><input id={`parada_inicio_${hora}_${n}`} name={`parada_inicio_${hora}_${n}`} type="time" defaultValue={p?.inicio ?? ''} className="h-11" /></div>
                        <div className="field"><label htmlFor={`parada_${hora}_${n}`}>Tempo (h:min)</label><input id={`parada_${hora}_${n}`} name={`parada_${hora}_${n}`} inputMode="numeric" placeholder="0:23" defaultValue={paradaEmHoraMin(p?.minutos)} className="h-11" /></div>
                        <div className="field"><label htmlFor={`parada_descricao_${hora}_${n}`}>Descrição</label><input id={`parada_descricao_${hora}_${n}`} name={`parada_descricao_${hora}_${n}`} defaultValue={p?.descricao ?? ''} className="h-11" /></div>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </section>

        <button type="submit" className="btn btn-primary h-12 w-full">Salvar o dia</button>
      </form>
    </main>
  );
}
