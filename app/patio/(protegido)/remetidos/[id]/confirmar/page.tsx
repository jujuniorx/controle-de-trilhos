import { notFound, redirect } from 'next/navigation';
import { buscarRemetidoDetalhe } from '@/lib/services/remetido';
import { RemetidoWizard } from '../../RemetidoWizard';

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

export default async function ConfirmarRemetidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const remetido = await buscarRemetidoDetalhe(id);
  if (!remetido) notFound();
  if (remetido.status !== 'AGUARDANDO_CHEGADA') redirect('/patio/remetidos');

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-lg font-semibold">Confirmar remetido — {remetido.reservaPedido}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {TIPO_REMETIDO_LABEL[remetido.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'} · Destino: {remetido.destino}
      </p>

      <RemetidoWizard modo="confirmar" movimentacaoId={remetido.id} numeroDocumentoPreCadastrado={remetido.numeroDocumento} />
    </main>
  );
}
