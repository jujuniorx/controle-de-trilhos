import { estaleiroDoPeriodo, ROTULO_TLS, TIPOS_TLS } from '@/lib/services/usina';
import { fmtMetros, fmtPeso } from '@/lib/format';
import { PERIODOS, ehIsoValido, type Periodo } from '@/lib/usina/periodo';
import { FormularioUsina } from '@/components/usina/FormularioUsina';
import { salvarEstaleiroAction, salvarEstoqueTlsAction, salvarManutencaoAction, salvarEscalaAction } from './actions';

export const dynamic = 'force-dynamic';

function hojeIso(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10); // horário de Brasília
}

function periodoValido(v: string | undefined): Periodo {
  return v === 'semana' || v === 'mes' ? v : 'dia';
}

function rotuloPeriodo(inicio: string, fim: string): string {
  const f = (s: string) => s.split('-').reverse().join('/');
  return inicio === fim ? f(inicio) : `${f(inicio)} a ${f(fim)}`;
}

export default async function UsinaPage({ searchParams }: { searchParams: Promise<{ periodo?: string; data?: string }> }) {
  const params = await searchParams;
  const periodo = periodoValido(params.periodo);
  const data = ehIsoValido(params.data) ? params.data : hojeIso();
  const est = await estaleiroDoPeriodo(periodo, data);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Relatório da usina</h1>
        <p className="text-sm text-ink-muted">Escolha o período para ver os números. Os lançamentos são feitos abaixo, por setor.</p>
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
        <p className="w-full text-sm text-ink-muted">Mostrando: {rotuloPeriodo(est.inicio, est.fim)}</p>
      </form>

      <section className="space-y-4" aria-labelledby="estaleiro">
        <h2 id="estaleiro" className="section-title">Estaleiro de solda</h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card"><p className="kv-label">Soldas no período</p><p className="text-2xl font-semibold">{est.totais.soldas}</p></div>
          <div className="card"><p className="kv-label">Cortes no período</p><p className="text-2xl font-semibold">{est.totais.cortes}</p></div>
          <div className="card"><p className="kv-label">Tampões carregados</p><p className="text-2xl font-semibold">{est.carreta.tampoes}</p></div>
          <div className="card"><p className="kv-label">Trilho novo (m)</p><p className="text-2xl font-semibold">{fmtMetros(est.carreta.trilhoNovoM)}</p></div>
          <div className="card"><p className="kv-label">Sucata saída (t)</p><p className="text-2xl font-semibold">{fmtPeso(est.carreta.sucataT)}</p></div>
        </div>

        <div className="card space-y-3">
          <p className="font-semibold">Produção do dia {data.split('-').reverse().join('/')}</p>
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
          <p className="font-semibold">Estoque de TLS em {data.split('-').reverse().join('/')}</p>
          <FormularioUsina acao={salvarEstoqueTlsAction}>
            <input type="hidden" name="data" value={data} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {TIPOS_TLS.map((t) => (
                <div className="field" key={t}>
                  <label htmlFor={`tls_${t}`}>{ROTULO_TLS[t]}</label>
                  <input
                    id={`tls_${t}`}
                    name={`tls_${t}`}
                    inputMode="numeric"
                    defaultValue={est.estoqueDoDia[t] ?? ''}
                    className="h-11"
                  />
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
    </div>
  );
}
