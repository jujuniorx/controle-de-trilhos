import Link from 'next/link';
import { fmtMetros, fmtPeso } from '@/lib/format';
import { normalizarLocal } from '@/lib/domain/local';
import { notFound } from 'next/navigation';
import { buscarMovimentacaoDetalhe, resumoPeso } from '@/lib/services/movimentacao';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { buscarChegadaDoRecebimento } from '@/lib/services/chegada';
import { pecasDoGrupo } from '@/lib/domain/regras';
import { ConferenciaPainel } from './ConferenciaPainel';
import { NfsPainel } from '@/app/admin/(protegido)/NfsPainel';
import { rotuloNfs, nfsEmTexto } from '@/lib/nf';
import { EditarMedicoesPainel } from './EditarMedicoesPainel';
import { HistoricoMovimentacao } from '@/components/admin/HistoricoMovimentacao';
import { informarNumeroDocumentoRecebimentoAction } from './actions';
import { EditarDadosRecebimentoPainel } from './EditarDadosRecebimentoPainel';
import { IconeImprimir } from '@/components/icones/Icones';

function fmtData(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}

function fmtDataHora(d: Date): string {
  // Instante real (não só data): sempre no fuso de Brasília, não no do servidor (UTC).
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export default async function RecebimentoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const mov = await buscarMovimentacaoDetalhe(id);
  if (!mov) notFound();

  const resumo = resumoPeso(mov);
  // Dados da Portaria (se o caminhão passou por ela); nunca derruba a tela.
  const portaria = await buscarChegadaDoRecebimento(mov.id).catch(() => null);

  return (
    <main className="mx-auto max-w-3xl xl:max-w-5xl space-y-4 p-6">
      <div>
        <Link href="/admin" className="back-link">
          ← Voltar à lista
        </Link>
        <div className="page-header mt-1 !mb-0">
          <h1 className="page-title">Recebimento{mov.numeroDocumento ? ` — ${rotuloNfs(mov)}` : ''}</h1>
          <div className="flex items-center gap-2">
            {mov.status === 'CONFERIDO' ? (
              <span className="badge badge-ok">CONFERIDO</span>
            ) : (
              <span className="badge badge-warn">PENDENTE DE CONFERÊNCIA</span>
            )}
            {/* <a> e não <Link>: o romaneio é um documento HTML puro (route handler), sem prefetch/RSC. */}
            <a href={`/admin/recebimentos/${mov.id}/romaneio`} className="btn btn-ghost btn-sm">
              <IconeImprimir size={15} /> Imprimir romaneio
            </a>
          </div>
        </div>
      </div>

      {/* 1. Dados do recebimento */}
      <section className="card">
        <h2 className="card-title">Dados do recebimento</h2>
        <dl className="kv-grid">
          <div className="kv-item"><div className="kv-label">Data</div><div className="kv-val">{fmtData(mov.dataMovimentacao)}</div></div>
          <div className="kv-item"><div className="kv-label">Criado pelo Pátio em</div><div className="kv-val font-mono">{fmtDataHora(mov.createdAt)}</div></div>
          <div className="kv-item"><div className="kv-label">Nota fiscal</div><div className="kv-val font-mono">{nfsEmTexto(mov) || 'Em aberto'}</div></div>
          <div className="kv-item"><div className="kv-label">Origem</div><div className="kv-val">{normalizarLocal(mov.origem)}</div></div>
          <div className="kv-item"><div className="kv-label">Transporte</div><div className="kv-val">{mov.tipoTransporte}</div></div>
          <div className="kv-item"><div className="kv-label">Carreta(s)</div><div className="kv-val font-mono">{[mov.placaCarreta, mov.placaCarreta2].filter(Boolean).join(' / ') || '—'}</div></div>
          <div className="kv-item"><div className="kv-label">Cavalo</div><div className="kv-val font-mono">{mov.placaCavalo ?? '—'}</div></div>
          <div className="kv-item"><div className="kv-label">Responsável (Pátio)</div><div className="kv-val">{mov.responsavelPatio}</div></div>
          {portaria && (portaria.motoristaNome || portaria.motoristaTelefone || portaria.motoristaCpf) && (
            <div className="kv-item"><div className="kv-label">Motorista (Portaria)</div><div className="kv-val">{[portaria.motoristaNome, portaria.motoristaTelefone, portaria.motoristaCpf && `CPF ${portaria.motoristaCpf}`].filter(Boolean).join(' · ')}</div></div>
          )}
          {portaria?.capacidadeCarga != null && (
            <div className="kv-item"><div className="kv-label">Capacidade de carga</div><div className="kv-val">{portaria.capacidadeCarga.toLocaleString('pt-BR')} t</div></div>
          )}
          {portaria?.liberadaEm && (
            <div className="kv-item"><div className="kv-label">Chegou (Portaria)</div><div className="kv-val">{fmtDataHora(portaria.liberadaEm)}{portaria.liberadaPor ? ` · ${portaria.liberadaPor}` : ''}</div></div>
          )}
          {portaria?.saidaEm && (
            <div className="kv-item"><div className="kv-label">Saída (Portaria)</div><div className="kv-val">{fmtDataHora(portaria.saidaEm)}{portaria.saidaPor ? ` · ${portaria.saidaPor}` : ''}</div></div>
          )}
          {portaria?.observacao && (
            <div className="kv-item"><div className="kv-label">Observação da Portaria</div><div className="kv-val whitespace-pre-wrap">{portaria.observacao}</div></div>
          )}
          {mov.observacao && (
            <div className="kv-item"><div className="kv-label">Observação do Pátio</div><div className="kv-val whitespace-pre-wrap">{mov.observacao}</div></div>
          )}
        </dl>
        <NfsPainel movimentacaoId={mov.id} principal={mov.numeroDocumento} extras={mov.numerosDocumentoExtras} acaoCorrigirPrincipal={informarNumeroDocumentoRecebimentoAction} />
        <EditarDadosRecebimentoPainel
          movimentacaoId={mov.id}
          inicial={{
            dataMovimentacao: mov.dataMovimentacao ? mov.dataMovimentacao.toISOString().slice(0, 10) : '',
            origem: mov.origem ?? '',
            tipoTransporte: mov.tipoTransporte,
            placaCavalo: mov.placaCavalo ?? '',
            placaCarreta: mov.placaCarreta ?? '',
            placaCarreta2: mov.placaCarreta2 ?? '',
            responsavelPatio: mov.responsavelPatio ?? '',
            observacao: mov.observacao ?? '',
          }}
        />
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title !mb-0">Medições</h2>
          {mov.status === 'CONFERIDO' && (
            <EditarMedicoesPainel grupos={mov.grupos} movimentacaoId={mov.id} statusRecebimento={mov.status} />
          )}
        </div>
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
        <HistoricoMovimentacao historico={mov.historico} />
      </section>
    </main>
  );
}
