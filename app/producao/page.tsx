import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_PRODUCAO, cookieProducaoValido } from '@/lib/services/producaoAcesso';
import { RascunhoAutomatico } from '@/components/producao/RascunhoAutomatico';
import { FABRICANTES_PRODUCAO, MAX_PARADAS_HORA, PERFIS_PRODUCAO, SOLDAS_POR_TLS, buscarDia, horasDoDia, paradaEmHoraMin, paradasDaLinha } from '@/lib/services/producao';
import { TrocaTopo } from '@/components/producao/TrocaTopo';
import { salvarProducaoAction } from './actions';
import { AlternarTema } from '@/components/ui/AlternarTema';
import { BotaoEnviar } from '@/components/ui/BotaoEnviar';
import { CelulasParada } from '@/components/producao/CelulasParada';

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
  // Trocas salvas: a hora em que o trilho ou a marca mudou em relacao a hora anterior.
  const trocaPerfilHora = new Map<string, string>();
  const trocaFabricanteHora = new Map<string, string>();
  let perfilAnterior = dia?.perfil ?? PERFIS_PRODUCAO[0];
  let fabricanteAnterior = dia?.fabricante ?? FABRICANTES_PRODUCAO[0];
  for (const hora of horas) {
    const l = porHora.get(hora);
    if (!l) continue;
    if (l.perfil !== perfilAnterior) { trocaPerfilHora.set(hora, l.perfil); perfilAnterior = l.perfil; }
    if (l.fabricante !== fabricanteAnterior) { trocaFabricanteHora.set(hora, l.fabricante); fabricanteAnterior = l.fabricante; }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <div className="flex justify-end">
        <AlternarTema />
      </div>
      <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide">Produção do dia</h1>
      {params.ok === '1' && <p role="status" className="rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm">Dia salvo. Soldas: {dia?.totalSoldas ?? 0}, TLS formados: {dia?.tlsFormados ?? 0}, sobra para amanhã: {dia?.sobraSaida ?? 0} de {SOLDAS_POR_TLS}.</p>}

      <form id="form-producao" action={salvarProducaoAction} className="space-y-6">
        <RascunhoAutomatico data={dataTexto} />
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
                  <div className="field"><label htmlFor={`troca_perfil_${hora}`}>Trocou o trilho para</label>
                    <select id={`troca_perfil_${hora}`} name={`troca_perfil_${hora}`} defaultValue={trocaPerfilHora.get(hora) ?? ''} className="h-11"><option value="">Mantém</option>{PERFIS_PRODUCAO.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                  </div>
                  <div className="field"><label htmlFor={`troca_fabricante_${hora}`}>Trocou a marca para</label>
                    <select id={`troca_fabricante_${hora}`} name={`troca_fabricante_${hora}`} defaultValue={trocaFabricanteHora.get(hora) ?? ''} className="h-11"><option value="">Mantém</option>{FABRICANTES_PRODUCAO.map((f) => <option key={f} value={f}>{f}</option>)}</select>
                  </div>
                  {/* Sem campo próprio: o motivo do corte vai na descrição da parada. O texto já salvo continua guardado. */}
                  <input type="hidden" name={`justificativa_${hora}`} value={l?.justificativaCorte ?? ''} />
                  <div className="overflow-x-auto sm:col-span-2">
                    <p className="mb-2 text-sm font-semibold">Paradas desta hora (até {MAX_PARADAS_HORA}), como na planilha</p>
                    <p className="mb-2 text-xs text-ink-muted">Escolha a hora em que a parada começou e a hora em que terminou. O tempo de parada aparece sozinho. Se teve corte, escreva o motivo na descrição da parada.</p>
                    <table className="tabela-paradas w-full text-sm">
                      <thead className="text-xs uppercase text-ink-muted">
                        <tr className="border-b border-line">
                          <th className="py-2 pr-2 text-left">Início da Parada</th>
                          <th className="py-2 pr-2 text-left">Fim da Parada</th>
                          <th className="py-2 pr-2 text-left">Tempo de Parada</th>
                          <th className="py-2 text-left">Descrição da Parada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: MAX_PARADAS_HORA }, (_, i) => i + 1).map((n) => {
                          const p = paradasDaLinha(l?.paradas)[n - 1];
                          return (
                            <tr key={n} className="border-b border-line">
                              <CelulasParada hora={hora} n={n} inicioPadrao={p?.inicio ?? ''} minutosPadrao={p?.minutos ?? 0} />
                              <td className="py-1"><input aria-label={`Parada ${n}: descrição às ${hora}`} id={`parada_descricao_${hora}_${n}`} name={`parada_descricao_${hora}_${n}`} defaultValue={p?.descricao ?? ''} className="h-11 w-full" /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            );
          })}
        </section>

        <BotaoEnviar className="btn btn-primary h-12 w-full" enviando="Salvando…">Salvar o dia</BotaoEnviar>
      </form>
    </main>
  );
}
