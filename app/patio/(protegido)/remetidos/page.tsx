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
      <h1 className="text-xl font-semibold">Remetidos aguardando chegada</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Pré-cadastrados pelo Administrativo. Toque num deles quando o caminhão chegar para confirmar o carregamento.
      </p>

      <div className="mt-4 space-y-2">
        {remetidos.map((r) => (
          <Link
            key={r.id}
            href={`/patio/remetidos/${r.id}/confirmar`}
            className="block rounded-lg border bg-white p-3 hover:bg-neutral-50"
          >
            <p className="font-medium">{r.reservaPedido}</p>
            <p className="text-sm text-neutral-600">
              {TIPO_REMETIDO_LABEL[r.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'} · Destino: {r.destino}
            </p>
            {r.numeroDocumento && <p className="text-sm text-neutral-500">NF {r.numeroDocumento}</p>}
          </Link>
        ))}
        {remetidos.length === 0 && (
          <p className="rounded-lg border bg-white p-4 text-center text-sm text-neutral-500">
            Nenhum remetido aguardando chegada.
          </p>
        )}
      </div>
    </main>
  );
}
