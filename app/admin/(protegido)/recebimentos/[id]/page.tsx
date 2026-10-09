import Link from 'next/link';
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

function fmtMetros(v: unknown): string {
  return Number(v).toFixed(2);
}

function fmtPeso(v: number): string {
  return v.toFixed(3);
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
        <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
          ← Voltar à lista
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-neutral-900">Recebimento — NF {mov.numeroDocumento}</h1>
          {mov.status === 'CONFERIDO' ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">CONFERIDO</span>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
              PENDENTE DE CONFERÊNCIA
            </span>
          )}
        </div>
      </div>

      {/* 1. Dados do recebimento */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold text-neutral-800">Dados do recebimento</h2>
        <dl className="mt-2 grid grid-cols-1 gap-y-1 sm:grid-cols-2 text-sm">
          <dt className="text-neutral-500">Data</dt>
          <dd>{fmtData(mov.dataMovimentacao)}</dd>
          <dt className="text-neutral-500">Nota fiscal</dt>
          <dd>{mov.numeroDocumento}</dd>
          <dt className="text-neutral-500">Origem</dt>
          <dd>{mov.origem}</dd>
          <dt className="text-neutral-500">Transporte</dt>
          <dd>{mov.tipoTransporte}</dd>
          <dt className="text-neutral-500">Carreta(s)</dt>
          <dd>{[mov.placaCarreta, mov.placaCarreta2].filter(Boolean).join(' / ') || '—'}</dd>
          <dt className="text-neutral-500">Cavalo</dt>
          <dd>{mov.placaCavalo ?? '—'}</dd>
          <dt className="text-neutral-500">Responsável (Pátio)</dt>
          <dd>{mov.responsavelPatio}</dd>
        </dl>
      </section>

      {/* 2. Materiais recebidos */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold text-neutral-800">Materiais recebidos</h2>
        <div className="mt-2 space-y-2">
          {mov.grupos.map((g, i) => (
            <div key={g.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <div>
                <b>
                  Grupo {i + 1} — {g.perfil} — {g.tipoMaterial}
                </b>
                {g.tipoMaterial === 'NOVO' && g.fabricante && (
                  <span className="ml-2 text-neutral-500">Fabricante: {g.fabricante}</span>
                )}
                {g.tipoMaterial === 'REEMPREGO' && <span className="ml-2 text-neutral-500">Classificação: {g.classificacao}</span>}
                <span className="ml-2 text-neutral-500">
                  {pecasDoGrupo(g.medicoes)} {pecasDoGrupo(g.medicoes) === 1 ? 'barra' : 'barras'} · {fmtMetros(g.metrosTotal)} m
                </span>
              </div>
              {g.tipoMaterial === 'SUCATA' ? (
                <span className="text-right">
                  <span className="font-medium">{fmtPeso(Number(g.pesoCalculado ?? 0))} t</span>{' '}
                  <span className="text-xs text-amber-700">(estimado, a confirmar)</span>
                </span>
              ) : (
                <span className="font-medium">{fmtPeso(Number(g.pesoCalculado ?? 0))} t</span>
              )}
            </div>
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

      {/* 4. Resumo de peso */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold text-neutral-800">Resumo de peso</h2>
        {resumo.pendente ? (
          <div className="mt-2">
            <p className="text-sm text-neutral-500">PESO ATÉ AGORA</p>
            <p className="text-2xl font-semibold">{fmtPeso(resumo.pesoNovoReemprego)} t</p>
            <p className="text-xs text-neutral-500">NOVO + REEMPREGO</p>
            <div className="mt-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
              SUCATA — peso estimado <b>{fmtPeso(resumo.pesoSucataEstimado)} t</b> (a confirmar)
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-neutral-500">PESO TOTAL</p>
            <dl className="mt-1 grid grid-cols-1 gap-y-1 sm:grid-cols-2 text-sm">
              <dt className="text-neutral-500">NOVO</dt>
              <dd>{fmtPeso(resumo.pesoNovo)} t</dd>
              <dt className="text-neutral-500">REEMPREGO</dt>
              <dd>{fmtPeso(resumo.pesoReemprego)} t</dd>
              {resumo.temSucata && (
                <>
                  <dt className="text-neutral-500">SUCATA</dt>
                  <dd>{fmtPeso(resumo.pesoSucataReal ?? 0)} t</dd>
                </>
              )}
            </dl>
            <p className="mt-2 text-xl font-semibold">TOTAL: {fmtPeso(resumo.pesoTotal ?? 0)} t</p>
          </div>
        )}
      </section>

      {/* Totais do recebimento (barras / metros / peso) */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold text-neutral-800">Totais do recebimento</h2>
        <dl className="mt-2 grid grid-cols-3 gap-y-1 text-sm">
          <dt className="text-neutral-500">Barras</dt>
          <dd className="col-span-2 text-lg font-semibold">{mov.grupos.reduce((acc, g) => acc + pecasDoGrupo(g.medicoes), 0)}</dd>
          <dt className="text-neutral-500">Metros</dt>
          <dd className="col-span-2 text-lg font-semibold">
            {fmtMetros(mov.grupos.reduce((acc, g) => acc + Number(g.metrosTotal), 0))} m
          </dd>
          <dt className="text-neutral-500">Peso{resumo.pendente ? ' (até agora)' : ' total'}</dt>
          <dd className="col-span-2 text-lg font-semibold">
            {fmtPeso(resumo.pendente ? resumo.pesoNovoReemprego + resumo.pesoSucataEstimado : resumo.pesoTotal ?? 0)} t
            {resumo.pendente && <span className="ml-1 text-xs font-normal text-amber-700">(inclui estimativa de sucata, a confirmar)</span>}
          </dd>
        </dl>
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
