import Link from 'next/link';
import { fmtMetros, fmtPeso } from '@/lib/format';
import { notFound } from 'next/navigation';
import { buscarMovimentacaoDetalhe, resumoPeso } from '@/lib/services/movimentacao';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { pecasDoGrupo } from '@/lib/domain/regras';
import { ConferenciaPainel } from './ConferenciaPainel';

function fmtData(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}

function fmtDataHora(d: Date): string {
  return d.toLocaleString('pt-BR');
}

const ACAO_LABEL: Record<string, string> = {
  CRIACAO: 'Recebimento criado pelo Pátio',
  PESO_INFORMADO: 'Peso da sucata informado/corrigido',
  REABERTURA: 'Conferência reaberta',
  CONFERENCIA: 'Recebimento conferido',
  ANEXO: 'Documento de pesagem anexado',
  ANEXO_SUBSTITUIDO: 'Documento de pesagem substituído',
};

export default async function RecebimentoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const mov = await buscarMovimentacaoDetalhe(id);
  if (!mov) notFound();

  const resumo = resumoPeso(mov);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <Link href="/admin" className="back-link">
          ← Voltar à lista
        </Link>
        <div className="page-header mt-1 !mb-0">
          <h1 className="page-title">Recebimento — NF {mov.numeroDocumento}</h1>
          {mov.status === 'CONFERIDO' ? (
            <span className="badge badge-ok">CONFERIDO</span>
          ) : (
            <span className="badge badge-warn">PENDENTE DE CONFERÊNCIA</span>
          )}
        </div>
      </div>

      {/* 1. Dados do recebimento */}
      <section className="card">
        <h2 className="card-title">Dados do recebimento</h2>
        <dl className="kv-grid">
          <div className="kv-item"><div className="kv-label">Data</div><div className="kv-val">{fmtData(mov.dataMovimentacao)}</div></div>
          <div className="kv-item"><div className="kv-label">Nota fiscal</div><div className="kv-val font-mono">{mov.numeroDocumento}</div></div>
          <div className="kv-item"><div className="kv-label">Origem</div><div className="kv-val">{mov.origem}</div></div>
          <div className="kv-item"><div className="kv-label">Transporte</div><div className="kv-val">{mov.tipoTransporte}</div></div>
          <div className="kv-item"><div className="kv-label">Carreta(s)</div><div className="kv-val font-mono">{[mov.placaCarreta, mov.placaCarreta2].filter(Boolean).join(' / ') || '—'}</div></div>
          <div className="kv-item"><div className="kv-label">Cavalo</div><div className="kv-val font-mono">{mov.placaCavalo ?? '—'}</div></div>
          <div className="kv-item"><div className="kv-label">Responsável (Pátio)</div><div className="kv-val">{mov.responsavelPatio}</div></div>
        </dl>
      </section>

      {/* 2. Materiais recebidos */}
      <section className="card">
        <h2 className="card-title">Materiais recebidos</h2>
        <div className="space-y-2">
          {mov.grupos.map((g, i) => (
            <div key={g.id} className="grupo-card">
              <div className="grupo-header">
                <div className="grupo-header-left">
                  <span className="grupo-title">
                    Grupo {i + 1} — {g.perfil} — {g.tipoMaterial}
                  </span>
                  <span className="grupo-meta">
                    {g.tipoMaterial === 'NOVO' && g.fabricante && <>Fabricante: {g.fabricante} · </>}
                    {g.tipoMaterial === 'REEMPREGO' && <>Classificação: {g.classificacao} · </>}
                    {pecasDoGrupo(g.medicoes)} {pecasDoGrupo(g.medicoes) === 1 ? 'barra' : 'barras'} · {fmtMetros(g.metrosTotal)} m
                  </span>
                </div>
                {g.tipoMaterial === 'SUCATA' ? (
                  <span className="whitespace-nowrap text-right font-mono">
                    <span className="font-semibold text-ink">{fmtPeso(Number(g.pesoCalculado ?? 0))} t</span>{' '}
                    <span className="text-xs text-warn">(estimado, a confirmar)</span>
                  </span>
                ) : (
                  <span className="whitespace-nowrap font-mono font-semibold text-ink">{fmtPeso(Number(g.pesoCalculado ?? 0))} t</span>
                )}
              </div>
            </div>
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

      {/* 4. Resumo de peso */}
      <section className="card">
        <h2 className="card-title">Resumo de peso</h2>
        {resumo.pendente ? (
          <div>
            <p className="stat-label">PESO ATÉ AGORA</p>
            <p className="stat-value">{fmtPeso(resumo.pesoNovoReemprego)} <span className="text-base">t</span></p>
            <p className="stat-unit">NOVO + REEMPREGO</p>
            <div className="mt-2 rounded px-3 py-2 text-sm" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
              SUCATA — peso estimado <b>{fmtPeso(resumo.pesoSucataEstimado)} t</b> (a confirmar)
            </div>
          </div>
        ) : (
          <div>
            <p className="stat-label">PESO TOTAL</p>
            <dl className="kv-grid mt-1">
              <div className="kv-item"><div className="kv-label">NOVO</div><div className="kv-val">{fmtPeso(resumo.pesoNovo)} t</div></div>
              <div className="kv-item"><div className="kv-label">REEMPREGO</div><div className="kv-val">{fmtPeso(resumo.pesoReemprego)} t</div></div>
              {resumo.temSucata && (
                <div className="kv-item"><div className="kv-label">SUCATA</div><div className="kv-val">{fmtPeso(resumo.pesoSucataReal ?? 0)} t</div></div>
              )}
            </dl>
            <p className="stat-value mt-2">TOTAL: {fmtPeso(resumo.pesoTotal ?? 0)} t</p>
          </div>
        )}
      </section>

      {/* Totais do recebimento (barras / metros / peso) */}
      <section className="card">
        <h2 className="card-title">Totais do recebimento</h2>
        <div className="totais-grid">
          <div className="stat-tile">
            <p className="stat-label">Barras</p>
            <p className="stat-value">{mov.grupos.reduce((acc, g) => acc + pecasDoGrupo(g.medicoes), 0)}</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Metros</p>
            <p className="stat-value">{fmtMetros(mov.grupos.reduce((acc, g) => acc + Number(g.metrosTotal), 0))} m</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Peso{resumo.pendente ? ' (até agora)' : ' total'}</p>
            <p className="stat-value accent">
              {fmtPeso(resumo.pendente ? resumo.pesoNovoReemprego + resumo.pesoSucataEstimado : resumo.pesoTotal ?? 0)} t
            </p>
            {resumo.pendente && <p className="stat-unit text-warn">(inclui estimativa de sucata, a confirmar)</p>}
          </div>
        </div>
      </section>

      {/* 6. Conferência */}
      <ConferenciaPainel
        movimentacaoId={mov.id}
        status={mov.status as 'PENDENTE_CONFERENCIA' | 'CONFERIDO'}
        temSucata={resumo.temSucata}
        pesoSucataReal={resumo.pesoSucataReal}
        pesoSucataEstimado={resumo.pesoSucataEstimado}
      />

      {/* 7. Histórico */}
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
