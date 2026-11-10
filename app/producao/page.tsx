import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_PRODUCAO, cookieProducaoValido } from '@/lib/services/producaoAcesso';
import { FABRICANTES_PRODUCAO, PERFIS_PRODUCAO, SOLDAS_POR_TLS, buscarDia, horasDoDia } from '@/lib/services/producao';
import { salvarProducaoAction } from './actions';

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
      <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide">Produção do dia</h1>
      {params.ok === '1' && <p role="status" className="rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm">Dia salvo. Soldas: {dia?.totalSoldas ?? 0}, TLS formados: {dia?.tlsFormados ?? 0}, sobra para amanhã: {dia?.sobraSaida ?? 0} de {SOLDAS_POR_TLS}.</p>}

      <form action={salvarProducaoAction} className="space-y-6">
        <section className="card space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="field"><label htmlFor="data">Data</label><input id="data" name="data" type="date" defaultValue={dataTexto} required className="h-11" /></div>
            <div className="field"><label htmlFor="lider">Líder</label><input id="lider" name="lider" defaultValue={dia?.lider ?? ''} required className="h-11" /></div>
            <div className="field sm:col-span-2"><label htmlFor="soldadores">Soldadores</label><input id="soldadores" name="soldadores" defaultValue={dia?.soldadores ?? ''} placeholder="Nomes dos soldadores do turno" required className="h-11" /></div>
            <div className="field"><label htmlFor="perfil">Trilho (perfil)</label>
              <select id="perfil" name="perfil" defaultValue={dia?.perfil ?? PERFIS_PRODUCAO[0]} className="h-11">{PERFIS_PRODUCAO.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="fabricante">Fabricante</label>
              <select id="fabricante" name="fabricante" defaultValue={dia?.fabricante ?? FABRICANTES_PRODUCAO[0]} className="h-11">{FABRICANTES_PRODUCAO.map((f) => <option key={f} value={f}>{f}</option>)}</select>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="section-title">Hora a hora</h2>
          <p className="text-sm text-ink-muted">Se o trilho ou o fabricante mudar, escolha na hora da troca. Vale daquela hora em diante.</p>
          {horas.map((hora) => {
            const l = porHora.get(hora);
            return (
              <details key={hora} className="card" open={Boolean(l)}>
                <summary className="cursor-pointer font-semibold">{hora} {l ? `· ${l.soldas} soldas` : ''}</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="field"><label htmlFor={`soldas_${hora}`}>Soldas</label><input id={`soldas_${hora}`} name={`soldas_${hora}`} inputMode="numeric" defaultValue={l?.soldas || ''} className="h-11" /></div>
                  <div className="field"><label htmlFor={`cortes_${hora}`}>Cortes</label><input id={`cortes_${hora}`} name={`cortes_${hora}`} inputMode="numeric" defaultValue={l?.cortes || ''} className="h-11" /></div>
                  <div className="field sm:col-span-2"><label htmlFor={`justificativa_${hora}`}>Justificativa do corte</label><input id={`justificativa_${hora}`} name={`justificativa_${hora}`} defaultValue={l?.justificativaCorte ?? ''} placeholder="Obrigatória se houver corte" className="h-11" /></div>
                  <div className="field"><label htmlFor={`perfil_${hora}`}>Trocar trilho a partir daqui</label>
                    <select id={`perfil_${hora}`} name={`perfil_${hora}`} defaultValue={l?.perfil ?? ''} className="h-11"><option value="">Continua</option>{PERFIS_PRODUCAO.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                  </div>
                  <div className="field"><label htmlFor={`fabricante_${hora}`}>Trocar fabricante a partir daqui</label>
                    <select id={`fabricante_${hora}`} name={`fabricante_${hora}`} defaultValue={l?.fabricante ?? ''} className="h-11"><option value="">Continua</option>{FABRICANTES_PRODUCAO.map((f) => <option key={f} value={f}>{f}</option>)}</select>
                  </div>
                  <div className="field"><label htmlFor={`parada_inicio_${hora}`}>Parada: início</label><input id={`parada_inicio_${hora}`} name={`parada_inicio_${hora}`} type="time" defaultValue={l?.paradaInicio ?? ''} className="h-11" /></div>
                  <div className="field"><label htmlFor={`parada_${hora}`}>Parada: minutos</label><input id={`parada_${hora}`} name={`parada_${hora}`} inputMode="numeric" defaultValue={l?.paradaMinutos || ''} className="h-11" /></div>
                  <div className="field sm:col-span-2"><label htmlFor={`parada_descricao_${hora}`}>Descrição da parada</label><input id={`parada_descricao_${hora}`} name={`parada_descricao_${hora}`} defaultValue={l?.paradaDescricao ?? ''} className="h-11" /></div>
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
