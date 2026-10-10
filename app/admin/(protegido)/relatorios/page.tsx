import Link from 'next/link';
import { fmtMetros, fmtPeso } from '@/lib/format';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { filtrosRelatorioSchema, MATERIAIS_RELATORIO, STATUS_RELATORIO } from '@/lib/validation/relatorio';
import { PERFIS } from '@/lib/validation/recebimento';
import {
  buscarMovimentacoesRelatorio,
  resumoRelatorio,
  listarPendencias,
  type MovimentacaoRelatorio,
} from '@/lib/services/relatorio';

function fmtData(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}

function detalheHref(mov: { id: string; tipo: string }): string {
  return mov.tipo === 'RECEBIMENTO' ? `/admin/recebimentos/${mov.id}` : `/admin/remetidos/${mov.id}`;
}

// Mapeia o status (valor armazenado no banco, intocado) para a variante visual
// do badge — só a aparência muda, nunca o valor persistido.
const STATUS_BADGE: Record<string, string> = {
  AGUARDANDO_CHEGADA: 'badge-muted',
  PENDENTE_CONFERENCIA: 'badge-warn',
  CONFERIDO: 'badge-ok',
};

const STATUS_TEXTO: Record<string, string> = {
  AGUARDANDO_CHEGADA: 'Aguardando chegada',
  PENDENTE_CONFERENCIA: 'Pendente de conferência',
  CONFERIDO: 'Conferido',
};

function LinhaTabela({ mov }: { mov: MovimentacaoRelatorio }) {
  return (
    <tr data-mov-id={mov.id} data-mov-rotulo={mov.numeroDocumento ? `NF ${mov.numeroDocumento}` : (mov.destino ?? mov.origem ?? 'Movimentação em aberto')}>
      <td data-label="Tipo">{mov.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'}</td>
      <td data-label="Data" className="font-mono">{fmtData(mov.dataMovimentacao)}</td>
      <td data-label="NF" className="font-mono">{mov.numeroDocumento ?? 'Em aberto'}</td>
      <td data-label="Origem/Destino">{mov.tipo === 'RECEBIMENTO' ? mov.origem : mov.destino}</td>
      <td data-label="Status">
        <span className={`badge ${STATUS_BADGE[mov.status] ?? 'badge-muted'}`}>{STATUS_TEXTO[mov.status] ?? mov.status}</span>
      </td>
      <td className="text-right">
        <Link href={detalheHref(mov)} className="tbl-action">
          Ver detalhes →
        </Link>
      </td>
    </tr>
  );
}

function TabelaPendencia({ titulo, itens, vazio }: { titulo: string; itens: MovimentacaoRelatorio[]; vazio: string }) {
  return (
    <div>
      <h3 className="font-condensed text-sm font-semibold uppercase tracking-wide text-ink-muted">
        {titulo} <span className="font-sans font-normal normal-case tracking-normal text-ink-dim">({itens.length})</span>
      </h3>
      {itens.length === 0 ? (
        <p className="mt-1 text-sm text-ink-dim">{vazio}</p>
      ) : (
        <div className="tbl-wrap tbl-cards mt-1">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Data</th>
                <th>NF</th>
                <th>Origem/Destino</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((m) => (
                <LinhaTabela key={m.id} mov={m} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filtros = filtrosRelatorioSchema.parse({
    dataInicio: first(raw.dataInicio),
    dataFim: first(raw.dataFim),
    tipo: first(raw.tipo),
    perfil: first(raw.perfil),
    material: first(raw.material),
    origemDestino: first(raw.origemDestino),
    numeroDocumento: first(raw.numeroDocumento),
    status: first(raw.status),
  });

  const [movimentacoes, pendencias] = await Promise.all([buscarMovimentacoesRelatorio(filtros), listarPendencias()]);
  const resumo = resumoRelatorio(movimentacoes);
  const temFiltro = Object.values(filtros).some((v) => v !== undefined);
  const queryString = new URLSearchParams(
    Object.entries(filtros).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ).toString();

  return (
    <main className="mx-auto max-w-5xl xl:max-w-7xl space-y-6 p-6">
      <div className="page-header">
        <h1 className="page-title">Relatório de movimentação</h1>
        <Link href="/admin" className="back-link">
          ← Voltar
        </Link>
      </div>

      <form method="get" className="card">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="field">
            <label htmlFor="f-inicio">Período (início)</label>
            <input id="f-inicio" type="date" name="dataInicio" defaultValue={filtros.dataInicio} className="h-10" />
          </div>
          <div className="field">
            <label htmlFor="f-fim">Período (fim)</label>
            <input id="f-fim" type="date" name="dataFim" defaultValue={filtros.dataFim} className="h-10" />
          </div>
          <div className="field">
            <label htmlFor="f-tipo">Tipo</label>
            <select id="f-tipo" name="tipo" defaultValue={filtros.tipo ?? ''} className="h-10">
              <option value="">Todos</option>
              <option value="RECEBIMENTO">Recebimento</option>
              <option value="REMETIDO">Remetido</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-status">Status</label>
            <select id="f-status" name="status" defaultValue={filtros.status ?? ''} className="h-10">
              <option value="">Todos</option>
              {STATUS_RELATORIO.map((s) => (
                <option key={s} value={s}>
                  {STATUS_TEXTO[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-perfil">Perfil</label>
            <select id="f-perfil" name="perfil" defaultValue={filtros.perfil ?? ''} className="h-10">
              <option value="">Todos</option>
              {PERFIS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-material">Material</label>
            <select id="f-material" name="material" defaultValue={filtros.material ?? ''} className="h-10">
              <option value="">Todos</option>
              {MATERIAIS_RELATORIO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-od">Origem/Destino</label>
            <input id="f-od" type="text" name="origemDestino" defaultValue={filtros.origemDestino} className="h-10" />
          </div>
          <div className="field">
            <label htmlFor="f-nf">Nota fiscal</label>
            <input id="f-nf" type="text" inputMode="numeric" name="numeroDocumento" defaultValue={filtros.numeroDocumento} className="h-10" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="submit" className="btn btn-primary">
            Filtrar
          </button>
          {temFiltro && (
            <Link href="/admin/relatorios" className="btn btn-secondary">
              Limpar filtros
            </Link>
          )}
        </div>
      </form>

      <div className="rel-indicators">
        <div className="stat-tile">
          <p className="stat-label">Movimentações</p>
          <p className="stat-value">{resumo.carregamentos}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Peças</p>
          <p className="stat-value">{resumo.pecas}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Metros</p>
          <p className="stat-value">{fmtMetros(resumo.metros)}</p>
          <p className="stat-unit">m</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Toneladas</p>
          <p className="stat-value accent">{fmtPeso(resumo.toneladas)}</p>
          <p className="stat-unit">t</p>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-condensed text-base font-semibold uppercase tracking-wide text-ink">
            Movimentações <span className="font-sans font-normal normal-case tracking-normal text-ink-dim">({movimentacoes.length})</span>
          </h2>
          <a href={`/api/relatorios/exportar${queryString ? `?${queryString}` : ''}`} className="btn btn-ghost btn-sm">
            Exportar Excel
          </a>
        </div>
        <div className="card">
          <div className="tbl-wrap tbl-cards">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>NF</th>
                  <th>Origem/Destino</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.map((m) => (
                  <LinhaTabela key={m.id} mov={m} />
                ))}
                {movimentacoes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-ink-dim">
                      Nenhuma movimentação encontrada com esses filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="card-title">Pendências</h2>
        <TabelaPendencia
          titulo="Aguardando conferência"
          itens={pendencias.aguardandoConferencia}
          vazio="Nenhuma movimentação aguardando conferência."
        />
        <TabelaPendencia
          titulo="Remetidos aguardando chegada/placa"
          itens={pendencias.remetidosAguardandoChegada}
          vazio="Nenhum remetido aguardando o Pátio confirmar a chegada."
        />
        <TabelaPendencia
          titulo="Recebidos aguardando peso de sucata"
          itens={pendencias.recebidosAguardandoPesoSucata}
          vazio="Nenhum recebimento aguardando o peso real da sucata."
        />
      </section>
    </main>
  );
}
