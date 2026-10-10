import Link from 'next/link';
import { listarAguardandoChegada } from '@/lib/services/remetido';

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

export default async function RemetidosAguardandoPage() {
  const remetidos = await listarAguardandoChegada();

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-condensed text-xl font-bold uppercase tracking-wide text-ink">Remetidos</h1>

      <Link href="/patio/remetidos/novo" className="btn btn-primary mt-4 h-12">
        + Novo remetido
      </Link>

      <h2 className="mt-6 font-condensed text-base font-bold uppercase tracking-wide text-ink">Aguardando chegada</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Toque num deles quando o caminhão chegar para confirmar o carregamento.
      </p>

      <div className="mt-3 space-y-2">
        {remetidos.map((r) => (
          <Link key={r.id} href={`/patio/remetidos/${r.id}/confirmar`} className="card block transition hover:brightness-110">
            <p className="font-medium text-ink">{r.reservaPedido}</p>
            <p className="text-sm text-ink-muted">
              {TIPO_REMETIDO_LABEL[r.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'} · Destino: {r.destino}
            </p>
            {r.numeroDocumento && <p className="text-sm text-ink-dim">NF {r.numeroDocumento}</p>}
          </Link>
        ))}
        {remetidos.length === 0 && (
          <p className="empty-state">Nenhum remetido aguardando chegada.</p>
        )}
      </div>
    </main>
  );
}
