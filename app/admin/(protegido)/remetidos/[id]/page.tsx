import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buscarRemetidoDetalhe, resumoPesoRemetido } from '@/lib/services/remetido';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { ConferenciaPainel } from '@/app/admin/(protegido)/recebimentos/[id]/ConferenciaPainel';
import { NfPainel } from './NfPainel';
import { PesoGrupoPainel } from './PesoGrupoPainel';

function fmtData(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}

function fmtMetros(v: unknown): string {
  return Number(v).toFixed(2);
}

function fmtPeso(v: number): string {
  return v.toFixed(3);
}

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

const STATUS_LABEL: Record<string, { texto: string; className: string }> = {
  AGUARDANDO_CHEGADA: { texto: 'AGUARDANDO CHEGADA', className: 'bg-neutral-200 text-neutral-800' },
  PENDENTE_CONFERENCIA: { texto: 'PENDENTE DE CONFERÊNCIA', className: 'bg-amber-100 text-amber-800' },
  CONFERIDO: { texto: 'CONFERIDO', className: 'bg-emerald-100 text-emerald-800' },
};

export default async function RemetidoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const mov = await buscarRemetidoDetalhe(id);
  if (!mov) notFound();

  const pesoTotal = resumoPesoRemetido(mov);
  const statusInfo = STATUS_LABEL[mov.status];

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
          ← Voltar à lista
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-neutral-900">
            Remetido — {mov.reservaPedido ?? mov.id}
          </h1>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusInfo.className}`}>{statusInfo.texto}</span>
        </div>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold text-neutral-800">Dados do remetido</h2>
        <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-neutral-500">Tipo</dt>
          <dd>{TIPO_REMETIDO_LABEL[mov.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'}</dd>
          <dt className="text-neutral-500">Reserva/Pedido</dt>
          <dd>{mov.reservaPedido}</dd>
          <dt className="text-neutral-500">Destino</dt>
          <dd>{mov.destino}</dd>
          <dt className="text-neutral-500">Nota fiscal</dt>
          <dd>{mov.numeroDocumento ?? 'Em aberto'}</dd>
          <dt className="text-neutral-500">Data</dt>
          <dd>{fmtData(mov.dataMovimentacao)}</dd>
          <dt className="text-neutral-500">Caminhão (cavalo / carreta)</dt>
          <dd>
            {mov.placaCavalo ?? '—'}
            {mov.placaCarreta ? ` / ${mov.placaCarreta}` : ''}
          </dd>
          <dt className="text-neutral-500">Transportadora</dt>
          <dd>{mov.transportadora ?? '—'}</dd>
          <dt className="text-neutral-500">Responsável (Pátio)</dt>
          <dd>{mov.responsavelPatio ?? '—'}</dd>
        </dl>

        {mov.status !== 'AGUARDANDO_CHEGADA' && mov.numeroDocumento == null && <NfPainel movimentacaoId={mov.id} />}
      </section>

      {mov.status === 'AGUARDANDO_CHEGADA' ? (
        <section className="rounded-lg border bg-white p-4">
          <p className="text-sm text-neutral-600">
            Aguardando o Pátio confirmar a chegada. Nenhum grupo, medição ou peso ainda — nada disso existe até a confirmação.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-lg border bg-white p-4">
            <h2 className="font-semibold text-neutral-800">Materiais remetidos</h2>
            <div className="mt-2 space-y-2">
              {mov.grupos.map((g, i) => (
                <div key={g.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div>
                    <b>
                      Grupo {i + 1} — {g.perfil} — {g.tipoMaterial}
                      {g.tampao ? ' (Tampão)' : ''}
                    </b>
                    {g.tipoMaterial === 'NOVO' && g.fabricante && (
                      <span className="ml-2 text-neutral-500">Fabricante: {g.fabricante}</span>
                    )}
                    {g.tipoMaterial === 'REEMPREGO' && <span className="ml-2 text-neutral-500">Classificação: {g.classificacao}</span>}
                    {g.tipoMaterial === 'SUCATA' && (
                      <span className="ml-2 text-neutral-500">
                        Classificações: {[...new Set(g.medicoes.map((m) => m.classificacaoSC).filter(Boolean))].join(', ')}
                      </span>
                    )}
                    <span className="ml-2 text-neutral-500">{fmtMetros(g.metrosTotal)} m</span>
                  </div>
                  {g.pesoInformado != null ? (
                    <span className="font-medium">{fmtPeso(Number(g.pesoInformado))} t</span>
                  ) : (
                    <span className="font-medium text-amber-700">
                      {fmtPeso(Number(g.pesoCalculado ?? 0))} t <span className="text-xs">(estimado, a confirmar)</span>
                    </span>
                  )}
                </div>
              ))}
              {mov.grupos
                .map((g, i) => ({ g, i }))
                .filter(({ g }) => g.pesoInformado == null)
                .map(({ g, i }) => (
                  <PesoGrupoPainel
                    key={g.id}
                    grupoId={g.id}
                    pesoEstimado={Number(g.pesoCalculado ?? 0)}
                    label={`Grupo ${i + 1} — ${g.perfil} — ${g.tipoMaterial}`}
                  />
                ))}
            </div>
            <p className="mt-3 text-lg font-semibold">TOTAL (da NF): {fmtPeso(pesoTotal)} t</p>
            {mov.grupos.some((g) => g.pesoInformado == null) && (
              <p className="text-xs text-amber-700">Inclui peso estimado para grupos ainda não confirmados.</p>
            )}
          </section>

          <ConferenciaPainel movimentacaoId={mov.id} status={mov.status} temSucata={false} pesoSucataReal={null} />
        </>
      )}
    </main>
  );
}
