import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buscarRemetidoDetalhe, resumoPesoRemetido } from '@/lib/services/remetido';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { pecasDoGrupo } from '@/lib/domain/regras';
import { ConferenciaPainel } from '@/app/admin/(protegido)/recebimentos/[id]/ConferenciaPainel';
import { NfPainel } from './NfPainel';
import { PesoGrupoPainel } from './PesoGrupoPainel';
import { TipoRemetidoPainel } from './TipoRemetidoPainel';

function fmtData(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}

function fmtDataHora(d: Date): string {
  return d.toLocaleString('pt-BR');
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

// Mesmo princípio do detalhe de Recebimento (Task 18): nunca mostrar o CUID
// como identificação principal. NF é a referência mais usada na operação;
// na falta dela, cai para reserva/pedido e por último destino+data — sempre
// algo que a operação reconhece, nunca o id técnico.
function tituloRemetido(mov: { numeroDocumento: string | null; reservaPedido: string | null; destino: string | null; dataMovimentacao: Date | null }): string {
  if (mov.numeroDocumento) return `NF ${mov.numeroDocumento}`;
  if (mov.reservaPedido) return `Reserva ${mov.reservaPedido}`;
  if (mov.destino) return `${mov.destino} — ${fmtData(mov.dataMovimentacao)}`;
  return 'em aberto';
}

const ACAO_LABEL: Record<string, string> = {
  PRE_CADASTRO: 'Pré-cadastro criado pelo Administrativo',
  CONFIRMACAO_CHEGADA: 'Chegada confirmada pelo Pátio',
  LANCAMENTO_DIRETO: 'Remetido lançado direto pelo Pátio',
  NF_INFORMADA: 'Nota fiscal informada/corrigida',
  PESO_NF_INFORMADO: 'Peso da NF informado/corrigido',
  TIPO_REMETIDO_INFORMADO: 'Tipo de remetido informado',
  EDICAO: 'Remetido editado pelo Administrativo',
  REABERTURA: 'Conferência reaberta',
  CONFERENCIA: 'Remetido conferido',
};

export default async function RemetidoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const mov = await buscarRemetidoDetalhe(id);
  if (!mov) notFound();

  const pesoTotal = resumoPesoRemetido(mov);
  const totalBarras = mov.grupos.reduce((acc, g) => acc + pecasDoGrupo(g.medicoes), 0);
  const totalMetros = mov.grupos.reduce((acc, g) => acc + Number(g.metrosTotal), 0);
  const statusInfo = STATUS_LABEL[mov.status];
  const podeEditar = mov.status !== 'AGUARDANDO_CHEGADA';

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
          ← Voltar à lista
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-neutral-900">Remetido — {tituloRemetido(mov)}</h1>
          <div className="flex items-center gap-2">
            <span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${statusInfo.className}`}>{statusInfo.texto}</span>
            {podeEditar && (
              <Link
                href={`/admin/remetidos/${mov.id}/editar`}
                className="whitespace-nowrap rounded border border-steel px-3 py-1 text-sm font-medium text-steel hover:bg-steel/5"
              >
                Editar remetido
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 1. Dados do remetido */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold text-neutral-800">Dados do remetido</h2>
        <dl className="mt-2 grid grid-cols-1 gap-y-1 sm:grid-cols-2 text-sm">
          <dt className="text-neutral-500">Tipo</dt>
          <dd>{TIPO_REMETIDO_LABEL[mov.remetidoDetalhe?.tipoRemetido ?? ''] ?? 'Em aberto'}</dd>
          <dt className="text-neutral-500">Reserva/Pedido</dt>
          <dd>{mov.reservaPedido ?? '—'}</dd>
          <dt className="text-neutral-500">Destino</dt>
          <dd>{mov.destino}</dd>
          <dt className="text-neutral-500">Nota fiscal</dt>
          <dd>{mov.numeroDocumento ?? 'Em aberto'}</dd>
          <dt className="text-neutral-500">Data</dt>
          <dd>{fmtData(mov.dataMovimentacao)}</dd>
          <dt className="text-neutral-500">Carreta(s)</dt>
          <dd>{[mov.placaCarreta, mov.placaCarreta2].filter(Boolean).join(' / ') || '—'}</dd>
          <dt className="text-neutral-500">Cavalo</dt>
          <dd>{mov.placaCavalo ?? '—'}</dd>
          <dt className="text-neutral-500">Transportadora</dt>
          <dd>{mov.transportadora ?? '—'}</dd>
          <dt className="text-neutral-500">Responsável (Pátio)</dt>
          <dd>{mov.responsavelPatio ?? '—'}</dd>
        </dl>

        {mov.status !== 'AGUARDANDO_CHEGADA' && mov.numeroDocumento == null && <NfPainel movimentacaoId={mov.id} />}
        {mov.status !== 'AGUARDANDO_CHEGADA' && mov.remetidoDetalhe?.tipoRemetido == null && (
          <TipoRemetidoPainel movimentacaoId={mov.id} />
        )}
      </section>

      {mov.status === 'AGUARDANDO_CHEGADA' ? (
        <section className="rounded-lg border bg-white p-4">
          <p className="text-sm text-neutral-600">
            Aguardando o Pátio confirmar a chegada. Nenhum grupo, medição ou peso ainda — nada disso existe até a confirmação.
          </p>
        </section>
      ) : (
        <>
          {/* 2. Materiais remetidos */}
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
                    <span className="ml-2 text-neutral-500">
                      {pecasDoGrupo(g.medicoes)} {pecasDoGrupo(g.medicoes) === 1 ? 'barra' : 'barras'} · {fmtMetros(g.metrosTotal)} m
                    </span>
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
          </section>

          {/* 3. Medições */}
          <section className="rounded-lg border bg-white p-4">
            <h2 className="font-semibold text-neutral-800">Medições</h2>
            <div className="mt-2 space-y-3">
              {mov.grupos.map((g, i) => (
                <div key={g.id}>
                  <p className="text-sm font-medium text-neutral-600">
                    Grupo {i + 1} — {g.perfil}
                  </p>
                  <ol className="mt-1 divide-y rounded border text-sm">
                    {g.medicoes.map((m, k) => (
                      <li key={m.id} className="flex items-center justify-between px-2 py-1">
                        <span>
                          {k + 1}. {m.quantidade > 1 ? `${m.quantidade} × ${fmtMetros(m.comprimento)} m` : `${fmtMetros(m.comprimento)} m`}
                        </span>
                        <span className="text-neutral-600">
                          {fmtMetros(m.metros)} m{m.classificacaoSC ? ` — ${m.classificacaoSC}` : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Totais do remetido */}
          <section className="rounded-lg border bg-white p-4">
            <h2 className="font-semibold text-neutral-800">Totais do remetido</h2>
            <dl className="mt-2 grid grid-cols-3 gap-y-1 text-sm">
              <dt className="text-neutral-500">Barras</dt>
              <dd className="col-span-2 text-lg font-semibold">{totalBarras}</dd>
              <dt className="text-neutral-500">Metros</dt>
              <dd className="col-span-2 text-lg font-semibold">{fmtMetros(totalMetros)} m</dd>
              <dt className="text-neutral-500">Peso{mov.grupos.some((g) => g.pesoInformado == null) ? ' (até agora)' : ' total'}</dt>
              <dd className="col-span-2 text-lg font-semibold">
                {fmtPeso(pesoTotal)} t
                {mov.grupos.some((g) => g.pesoInformado == null) && (
                  <span className="ml-1 text-xs font-normal text-amber-700">(inclui estimativa, a confirmar)</span>
                )}
              </dd>
            </dl>
          </section>

          {/* 5. Conferência */}
          <ConferenciaPainel movimentacaoId={mov.id} status={mov.status} temSucata={false} pesoSucataReal={null} />
        </>
      )}

      {/* 6. Histórico */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold text-neutral-800">Histórico</h2>
        {mov.historico.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Nenhuma movimentação registrada ainda.</p>
        ) : (
          <ol className="mt-2 space-y-2 text-sm">
            {mov.historico.map((h) => (
              <li key={h.id} className="rounded border p-2">
                <div className="flex items-center justify-between">
                  <b>{ACAO_LABEL[h.acao] ?? h.acao}</b>
                  <span className="text-neutral-500">{fmtDataHora(h.timestamp)}</span>
                </div>
                <p className="text-neutral-600">{h.usuarioNome}</p>
                {(h.valorAntigo != null || h.valorNovo != null) && (
                  <p className="text-neutral-500">
                    {h.valorAntigo ?? '—'} → {h.valorNovo ?? '—'}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
