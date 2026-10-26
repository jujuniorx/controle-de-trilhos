import Link from 'next/link';
import { listarSaidasCarretas } from '@/lib/services/saidasCarretas';
import { normalizarLocal } from '@/lib/domain/local';
import { EstadoVazio } from '@/components/ui/EstadoVazio';

function fmtDataHora(d: Date): string {
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

export default async function SaidasCarretasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const q = (await searchParams).q;
  const busca = typeof q === 'string' ? q.slice(0, 80) : '';
  const saidas = await listarSaidasCarretas(busca);

  return (
    <main className="mx-auto max-w-md lg:max-w-none p-6">
      <Link href="/patio" className="text-sm text-ink-muted">← Pátio</Link>
      <h1 className="mt-2 font-condensed text-xl font-bold uppercase tracking-wide text-ink">Carretas que já saíram</h1>
      <p className="mt-1 text-sm text-ink-muted">Dados registrados pela Portaria. Busque por placa, cidade ou motorista.</p>

      <form method="get" className="mt-4 flex gap-2">
        <input name="q" defaultValue={busca} placeholder="Placa, cidade ou motorista" className="h-12 flex-1" aria-label="Buscar carreta que saiu" />
        <button type="submit" className="btn btn-primary h-12">Buscar</button>
      </form>

      <div className="mt-4 space-y-2">
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
            {s.transportadora && <p className="text-sm text-ink-dim">{s.transportadora}</p>}
            {s.numeroDocumento && <p className="text-sm text-ink-dim">NF {s.numeroDocumento}</p>}
            <p className="mt-1 text-xs text-ink-muted">
              Saiu em {fmtDataHora(s.saidaEm)}
              {s.saidaPor ? ` · ${s.saidaPor}` : ''}
            </p>
          </div>
        ))}
        {saidas.length === 0 && (
          <EstadoVazio
            titulo={busca ? 'Nenhuma carreta encontrada' : 'Nenhuma saída registrada'}
            texto={busca ? 'Tente outra placa, cidade ou nome do motorista.' : 'Quando a Portaria registrar uma saída, ela aparece aqui.'}
          />
        )}
      </div>
    </main>
  );
}
