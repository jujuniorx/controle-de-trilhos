import Link from 'next/link';
import { fmtMetros, fmtPeso } from '@/lib/format';
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

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

// Mapeia o status (valor armazenado no banco, intocado) para texto/variante de badge.
const STATUS_LABEL: Record<string, { texto: string; badge: string }> = {
  AGUARDANDO_CHEGADA: { texto: 'AGUARDANDO CHEGADA', badge: 'badge-muted' },
  PENDENTE_CONFERENCIA: { texto: 'PENDENTE DE CONFERÊNCIA', badge: 'badge-warn' },
  CONFERIDO: { texto: 'CONFERIDO', badge: 'badge-ok' },
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
        <Link href="/admin" className="back-link">
          ← Voltar à lista
        </Link>
        <div className="page-header mt-1 !mb-0">
          <h1 className="page-title">Remetido — {tituloRemetido(mov)}</h1>
          <div className="flex items-center gap-2">
            <span className={`badge ${statusInfo.badge}`}>{statusInfo.texto}</span>
            {podeEditar && (
              <Link href={`/admin/remetidos/${mov.id}/editar`} className="btn btn-ghost btn-sm">
                Editar remetido
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 1. Dados do remetido */}
      <section className="card">
        <h2 className="card-title">Dados do remetido</h2>
        <dl className="kv-grid">
          <div className="kv-item"><div className="kv-label">Tipo</div><div className="kv-val">{TIPO_REMETIDO_LABEL[mov.remetidoDetalhe?.tipoRemetido ?? ''] ?? 'Em aberto'}</div></div>
          <div className="kv-item"><div className="kv-label">Reserva/Pedido</div><div className="kv-val">{mov.reservaPedido ?? '—'}</div></div>
          <div className="kv-item"><div className="kv-label">Destino</div><div className="kv-val">{mov.destino}</div></div>
          <div className="kv-item"><div className="kv-label">Nota fiscal</div><div className="kv-val font-mono">{mov.numeroDocumento ?? 'Em aberto'}</div></div>
          <div className="kv-item"><div className="kv-label">Data</div><div className="kv-val">{fmtData(mov.dataMovimentacao)}</div></div>
          <div className="kv-item"><div className="kv-label">Carreta(s)</div><div className="kv-val font-mono">{[mov.placaCarreta, mov.placaCarreta2].filter(Boolean).join(' / ') || '—'}</div></div>
          <div className="kv-item"><div className="kv-label">Cavalo</div><div className="kv-val font-mono">{mov.placaCavalo ?? '—'}</div></div>
          <div className="kv-item"><div className="kv-label">Transportadora</div><div className="kv-val">{mov.transportadora ?? '—'}</div></div>
          <div className="kv-item"><div className="kv-label">Responsável (Pátio)</div><div className="kv-val">{mov.responsavelPatio ?? '—'}</div></div>
        </dl>

        {mov.status !== 'AGUARDANDO_CHEGADA' && mov.numeroDocumento == null && <NfPainel movimentacaoId={mov.id} />}
        {mov.status !== 'AGUARDANDO_CHEGADA' && mov.remetidoDetalhe?.tipoRemetido == null && (
          <TipoRemetidoPainel movimentacaoId={mov.id} />
        )}
      </section>

      {mov.status === 'AGUARDANDO_CHEGADA' ? (
        <section className="card">
          <p className="text-sm text-ink-muted">
            Aguardando o Pátio confirmar a chegada. Nenhum grupo, medição ou peso ainda — nada disso existe até a confirmação.
          </p>
        </section>
      ) : (
        <>
          {/* 2. Materiais remetidos */}
          <section className="card">
            <h2 className="card-title">Materiais remetidos</h2>
            <div className="space-y-2">
              {mov.grupos.map((g, i) => (
                <div key={g.id} className="grupo-card">
                  <div className="grupo-header">
                    <div className="grupo-header-left">
                      <span className="grupo-title">
                        Grupo {i + 1} — {g.perfil} — {g.tipoMaterial}
                        {g.tampao ? ' (Tampão)' : ''}
                      </span>
                      <span className="grupo-meta">
                        {g.tipoMaterial === 'NOVO' && g.fabricante && <>Fabricante: {g.fabricante} · </>}
                        {g.tipoMaterial === 'REEMPREGO' && <>Classificação: {g.classificacao} · </>}
                        {g.tipoMaterial === 'SUCATA' && (
                          <>Classificações: {[...new Set(g.medicoes.map((m) => m.classificacaoSC).filter(Boolean))].join(', ')} · </>
                        )}
                        {pecasDoGrupo(g.medicoes)} {pecasDoGrupo(g.medicoes) === 1 ? 'barra' : 'barras'} · {fmtMetros(g.metrosTotal)} m
                      </span>
                    </div>
                    {g.pesoInformado != null ? (
                      <span className="whitespace-nowrap font-mono font-semibold text-ink">{fmtPeso(Number(g.pesoInformado))} t</span>
                    ) : (
                      <span className="whitespace-nowrap text-right font-mono font-semibold text-warn">
                        {fmtPeso(Number(g.pesoCalculado ?? 0))} t <span className="text-xs font-normal">(estimado, a confirmar)</span>
                      </span>
                    )}
                  </div>
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
          <section className="card">
            <h2 className="card-title">Medições</h2>
            <div className="space-y-3">
              {mov.grupos.map((g, i) => (
                <div key={g.id}>
                  <p className="mb-1 text-sm font-medium text-ink-muted">
                    Grupo {i + 1} — {g.perfil}
                  </p>
                  <div className="grupo-card">
                    <div className="grupo-body !border-t-0 !pt-2">
                      {g.medicoes.map((m, k) => (
                        <div key={m.id} className="medicao-row">
                          <span>
                            <span className="medicao-num">{k + 1}.</span>{' '}
                            {m.quantidade > 1 ? `${m.quantidade} × ${fmtMetros(m.comprimento)} m` : `${fmtMetros(m.comprimento)} m`}
                          </span>
                          {(m.quantidade > 1 || m.classificacaoSC) && (
                            <span className="medicao-val">
                              {m.quantidade > 1 ? `${fmtMetros(m.metros)} m` : ''}{m.classificacaoSC ? ` ${m.classificacaoSC}` : ''}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Totais do remetido */}
          <section className="card">
            <h2 className="card-title">Totais do remetido</h2>
            <div className="totais-grid">
              <div className="stat-tile">
                <p className="stat-label">Barras</p>
                <p className="stat-value">{totalBarras}</p>
              </div>
              <div className="stat-tile">
                <p className="stat-label">Metros</p>
                <p className="stat-value">{fmtMetros(totalMetros)} m</p>
              </div>
              <div className="stat-tile">
                <p className="stat-label">Peso{mov.grupos.some((g) => g.pesoInformado == null) ? ' (até agora)' : ' total'}</p>
                <p className="stat-value accent">{fmtPeso(pesoTotal)} t</p>
                {mov.grupos.some((g) => g.pesoInformado == null) && (
                  <p className="stat-unit text-warn">(inclui estimativa, a confirmar)</p>
                )}
              </div>
            </div>
          </section>

          {/* 5. Conferência */}
          <ConferenciaPainel movimentacaoId={mov.id} status={mov.status as 'PENDENTE_CONFERENCIA' | 'CONFERIDO'} temSucata={false} pesoSucataReal={null} />
        </>
      )}

      {/* 6. Histórico */}
      <section className="card">
        <h2 className="card-title">Histórico</h2>
        {mov.historico.length === 0 ? (
          <p className="text-sm text-ink-dim">Nenhuma movimentação registrada ainda.</p>
        ) : (
          <div>
            {mov.historico.map((h) => (
              <div key={h.id} className="hist-row">
                <div className="hist-dot" />
                <div>
                  <div className="hist-text">
                    <strong>{ACAO_LABEL[h.acao] ?? h.acao}</strong>
                  </div>
                  <div className="hist-text">{h.usuarioNome}</div>
                  {(h.valorAntigo != null || h.valorNovo != null) && (
                    <div className="hist-text">
                      {h.valorAntigo ?? '—'} → {h.valorNovo ?? '—'}
                    </div>
                  )}
                  <div className="hist-time">{fmtDataHora(h.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
