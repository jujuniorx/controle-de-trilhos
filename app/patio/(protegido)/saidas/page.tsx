import Link from 'next/link';
import { listarSaidasCarretas } from '@/lib/services/saidasCarretas';
import { normalizarLocal } from '@/lib/domain/local';
import { EstadoVazio } from '@/components/ui/EstadoVazio';

/** Data com ano quando o registro é antigo: na virada de ano "26/10" fica ambíguo. */
function fmtDataHora(d: Date): string {
  const trintaDias = 30 * 24 * 60 * 60 * 1000;
  const antigo = Date.now() - d.getTime() > trintaDias;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(antigo ? { year: '2-digit' as const } : {}),
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

const PERIODOS = [
  { valor: '', rotulo: 'Tudo' },
  { valor: '1', rotulo: 'Hoje' },
  { valor: '7', rotulo: '7 dias' },
  { valor: '30', rotulo: '30 dias' },
];

const TIPOS = [
  { valor: '', rotulo: 'Carga e descarga' },
  { valor: 'CARGA', rotulo: 'Só carga' },
  { valor: 'DESCARGA', rotulo: 'Só descarga' },
];

export default async function SaidasCarretasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; tipo?: string | string[]; dias?: string | string[] }>;
}) {
  const params = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');
  const busca = texto(params.q).slice(0, 80);
  const tipo = texto(params.tipo);
  const dias = Number(texto(params.dias)) || 0;
  const saidas = await listarSaidasCarretas(busca, 100, { tipo, dias });

  const link = (campo: 'tipo' | 'dias', valor: string) => {
    const atual = new URLSearchParams();
    if (busca) atual.set('q', busca);
    if (campo === 'tipo' ? valor : tipo) atual.set('tipo', campo === 'tipo' ? valor : tipo);
    if (campo === 'dias' ? valor : dias) atual.set('dias', campo === 'dias' ? valor : String(dias));
    const query = atual.toString();
    return `/patio/saidas${query ? `?${query}` : ''}`;
  };

  return (
    <main className="patio-tela mx-auto max-w-md lg:max-w-none p-6">
      <Link href="/patio" className="text-sm text-ink-muted">← Pátio</Link>
      <h1 className="mt-2 font-condensed text-xl font-bold uppercase tracking-wide text-ink">Já saíram</h1>
      <p className="mt-1 text-sm text-ink-muted">Cargas e descargas que a Portaria registrou como saída.</p>

      <form method="get" className="mt-4 flex gap-2">
        {tipo && <input type="hidden" name="tipo" value={tipo} />}
        {dias > 0 && <input type="hidden" name="dias" value={dias} />}
        <input name="q" defaultValue={busca} placeholder="Placa, cidade ou motorista" className="h-12 flex-1" aria-label="Buscar carreta que saiu" />
        <button type="submit" className="btn btn-primary h-12">Buscar</button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <Link key={t.rotulo} href={link('tipo', t.valor)} className={`btn btn-sm ${tipo === t.valor ? 'btn-primary' : 'btn-ghost'}`}>
            {t.rotulo}
          </Link>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <Link key={p.rotulo} href={link('dias', p.valor)} className={`btn btn-sm ${String(dias || '') === p.valor ? 'btn-primary' : 'btn-ghost'}`}>
            {p.rotulo}
          </Link>
        ))}
      </div>

      <p className="mt-3 text-sm text-ink-muted">
        {saidas.length === 0 ? 'Nenhum registro' : `${saidas.length} ${saidas.length === 1 ? 'registro' : 'registros'}`}
        {saidas.length === 100 ? ' (mostrando os 100 mais recentes)' : ''}
      </p>

      <div className="mt-2 space-y-2">
        {saidas.map((s) => (
          <div key={`${s.tipo}-${s.id}`} className="card">
            <div className="flex items-center gap-2">
              <span className={s.tipo === 'CARGA' ? 'badge badge-ok' : 'badge badge-warn'}>{s.tipo === 'CARGA' ? 'Carga' : 'Descarga'}</span>
              <p className="font-medium text-ink">{normalizarLocal(s.cidade) || 'Sem cidade'}</p>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {s.placas.length ? s.placas.join(' · ') : 'Sem placa'}
              {s.motoristaNome ? ` · ${s.motoristaNome}` : ''}
            </p>
            {s.transportadora && <p className="text-sm text-ink-dim">{normalizarLocal(s.transportadora)}</p>}
            {s.numeroDocumento && <p className="text-sm text-ink-dim">NF {s.numeroDocumento}</p>}
            <p className="mt-1 text-xs text-ink-muted">
              Saiu em {fmtDataHora(s.saidaEm)}
              {s.saidaPor ? ` · ${s.saidaPor}` : ''}
            </p>
          </div>
        ))}
        {saidas.length === 0 && (
          <EstadoVazio
            titulo={busca || tipo || dias ? 'Nenhuma carreta encontrada' : 'Nenhuma saída registrada'}
            texto={busca || tipo || dias ? 'Tente outra placa, outro período ou tire os filtros.' : 'Quando a Portaria registrar uma saída, ela aparece aqui.'}
          />
        )}
      </div>
    </main>
  );
}
