import { notFound, redirect } from 'next/navigation';
import { buscarRemetidoDetalhe } from '@/lib/services/remetido';
import { normalizarLocal } from '@/lib/domain/local';
import { dadosPortariaDoRemetido } from '@/lib/services/portaria';
import { AtualizarAuto } from '@/components/AtualizarAuto';
import { RemetidoWizard } from '../../RemetidoWizard';
import { PainelPortaria } from '../../PainelPortaria';

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
  const portaria = await dadosPortariaDoRemetido(id);

  return (
    <main className="mx-auto max-w-md lg:max-w-none p-4">
      <h1 className="font-condensed text-lg font-bold uppercase tracking-wide text-ink">Confirmar carga — {normalizarLocal(remetido.destino) || remetido.reservaPedido}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {TIPO_REMETIDO_LABEL[remetido.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'} · Destino: {normalizarLocal(remetido.destino)}
      </p>

      <AtualizarAuto segundos={15} />
      {portaria && (
        <PainelPortaria
          id={remetido.id}
          estado={portaria.estado}
          nota={remetido.notaEmitidaEm ? 'EMITIDA' : remetido.status === 'CONFERIDO' ? 'PENDENTE' : null}
        />
      )}

      {portaria?.observacaoPortaria && (
        <aside role="note" className="card mt-4 border-2 border-warn bg-warn/10 p-4">
          <p className="text-sm font-semibold text-warn">Observação da Portaria</p>
          <p className="whitespace-pre-wrap text-sm text-ink">{portaria.observacaoPortaria}</p>
        </aside>
      )}

      <RemetidoWizard
        modo="confirmar"
        movimentacaoId={remetido.id}
        numeroDocumentoPreCadastrado={remetido.numeroDocumento}
        dadosPortaria={{
          placaCavalo: portaria?.placaCavalo ?? '',
          placaCarreta: portaria?.placaCarreta ?? '',
          transportadora: portaria?.transportadora ?? '',
        }}
      />
    </main>
  );
}
