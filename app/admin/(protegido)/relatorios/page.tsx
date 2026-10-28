import { rotuloStatusRemetido } from '@/lib/domain/statusRemetido';
import { nfsEmTexto, rotuloNfs } from '@/lib/nf';
import Link from 'next/link';
import { fmtMetros, fmtToneladas } from '@/lib/format';
import { normalizarLocal } from '@/lib/domain/local';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { filtrosRelatorioSchema, MATERIAIS_RELATORIO, CLASSIFICACOES_RELATORIO, STATUS_RELATORIO } from '@/lib/validation/relatorio';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { GraficosRelatorio } from '@/components/admin/GraficosRelatorio';
import { montarDadosGraficos } from '@/lib/services/graficosRelatorio';
import { PERFIS } from '@/lib/validation/recebimento';
import {
  buscarMovimentacoesRelatorio,
  ordenarPorSituacao,
  resumoRelatorio,
  listarPendencias,
  type MovimentacaoRelatorio,
} from '@/lib/services/relatorio';

function fmtData(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}

function fmtHora(d: Date | null): string {
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—';
}

function detalheHref(mov: { id: string; tipo: string }): string {
  return mov.tipo === 'RECEBIMENTO' ? `/admin/recebimentos/${mov.id}` : `/admin/remetidos/${mov.id}`;
}

const STATUS_TEXTO: Record<string, string> = {
  AGUARDANDO_CHEGADA: 'Aguardando chegada',
  PENDENTE_CONFERENCIA: 'Pendente de conferência',
  CONFERIDO: 'Conferido',
};

/** Cabeçalho único das tabelas de movimentação (lista principal e pendências). */
function CabecalhoMovimentacoes() {
  return (
    <thead>
      <tr>
        <th>Tipo</th>
        <th>Data</th>
        <th>NF</th>
        <th>Origem/Destino</th>
        <th>Caminhão</th>
        <th>Responsável</th>
        <th>Status</th>
        <th></th>
      </tr>
    </thead>
  );
}

function LinhaTabela({ mov }: { mov: MovimentacaoRelatorio }) {
  const placas = [mov.placaCarreta, mov.placaCarreta2, mov.placaCavalo].filter(Boolean) as string[];
  const status = rotuloStatusRemetido(mov.status, mov.chegadaPortariaEm);
  // Na tabela o texto fica curto para caber; o completo aparece ao passar o mouse.
  const statusCurto = status.texto === 'Pendente de conferência' ? 'Pendente' : status.texto;
  return (
    <tr data-mov-id={mov.id} data-mov-rotulo={mov.numeroDocumento ? rotuloNfs(mov) : (mov.destino ?? mov.origem ?? 'Movimentação em aberto')}>
      <td data-label="Tipo">{mov.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'}</td>
      <td data-label="Data">
        <span className="data-hora">
          {fmtData(mov.dataMovimentacao)}
          <small>{fmtHora(mov.createdAt)}</small>
        </span>
      </td>
      <td data-label="NF">{nfsEmTexto(mov) || <span className="badge badge-muted">Em aberto</span>}</td>
      <td data-label="Origem/Destino" className="celula-nome">{normalizarLocal(mov.tipo === 'RECEBIMENTO' ? mov.origem : mov.destino)}</td>
      <td data-label="Caminhão">
        {placas.length > 0 ? <span className="placas">{placas.map((p) => <span key={p}>{p}</span>)}</span> : '—'}
      </td>
      <td data-label="Responsável" className="celula-nome">{mov.responsavelPatio}</td>
      <td data-label="Status">
        <span className={`badge whitespace-nowrap ${status.badge}`} title={status.texto}>{statusCurto}</span>
      </td>
      <td className="text-right">
        <div className="acoes-linha">
          <Link href={detalheHref(mov)} className="btn btn-ghost btn-sm">
            Ver detalhes
          </Link>
        </div>
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
        <div className="tbl-wrap tbl-cards tbl-acoes-fixas mt-1">
          <table>
            <CabecalhoMovimentacoes />
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

function fmtDataIso(iso: string | undefined): string | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
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
    classificacao: first(raw.classificacao),
    origemDestino: first(raw.origemDestino),
    numeroDocumento: first(raw.numeroDocumento),
    placa: first(raw.placa),
    status: first(raw.status),
  });

  const [movimentacoes, pendencias] = await Promise.all([buscarMovimentacoesRelatorio(filtros), listarPendencias()]);
  const resumo = resumoRelatorio(movimentacoes);
  const graficos = montarDadosGraficos(movimentacoes);
  const temFiltro = Object.values(filtros).some((v) => v !== undefined);
  const queryString = new URLSearchParams(
    Object.entries(filtros).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ).toString();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatório de movimentação</h1>
          <p className="page-sub">Recebimentos e remetidos com filtros, gráficos e exportação para PDF e Excel.</p>
        </div>
      </div>

      <form method="get" className="card">
        <div className="filtros-form grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="filtros-base">
          <div className="field">
            <label htmlFor="f-inicio">Período (início)</label>
            <input id="f-inicio" type="date" name="dataInicio" defaultValue={filtros.dataInicio} className="h-10" />
          </div>
          <div className="field">
            <label htmlFor="f-fim">Período (fim)</label>
            <input id="f-fim" type="date" name="dataFim" defaultValue={filtros.dataFim} className="h-10" />
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
          </div>
          <input type="checkbox" id="f-mais" className="filtros-toggle" defaultChecked={Boolean(filtros.tipo || filtros.status || filtros.perfil || filtros.material || filtros.classificacao || filtros.origemDestino || filtros.numeroDocumento || filtros.placa)} />
          <label htmlFor="f-mais" className="filtros-mais-btn">
            Mais filtros
          </label>
          <div className="filtros-extra">
          <div className="field">
            <label htmlFor="f-tipo">Tipo</label>
            <select id="f-tipo" name="tipo" defaultValue={filtros.tipo ?? ''} className="h-10">
              <option value="">Todos</option>
              <option value="RECEBIMENTO">Recebimento</option>
              <option value="REMETIDO">Remetido</option>
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
            <label htmlFor="f-class">Classificação (reemprego)</label>
            <select id="f-class" name="classificacao" defaultValue={filtros.classificacao ?? ''} className="h-10">
              <option value="">Todas</option>
              {CLASSIFICACOES_RELATORIO.map((c) => (
                <option key={c} value={c}>
                  {c}
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
          <div className="field">
            <label htmlFor="f-placa">Placa</label>
            <input id="f-placa" type="text" name="placa" placeholder="ABC1D23" defaultValue={filtros.placa} className="h-10 uppercase" />
          </div>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {temFiltro && (
            <Link href="/admin/relatorios" className="btn btn-secondary w-full sm:w-auto">
              Limpar filtros
            </Link>
          )}
          <button type="submit" className="btn btn-primary w-full sm:w-auto sm:min-w-32">
            Filtrar
          </button>
        </div>
      </form>

      <div className="filtros-ativos" aria-label="Filtros aplicados">
        <span className="filtros-ativos-rotulo">Mostrando:</span>
        <span className="chip-filtro">
          {filtros.dataInicio || filtros.dataFim
            ? `${fmtDataIso(filtros.dataInicio) ?? 'desde o início'} até ${fmtDataIso(filtros.dataFim) ?? 'hoje'}`
            : 'Todo o histórico'}
        </span>
        {filtros.tipo && <span className="chip-filtro">{filtros.tipo === 'RECEBIMENTO' ? 'Recebimentos' : 'Remetidos'}</span>}
        {filtros.status && <span className="chip-filtro">{STATUS_TEXTO[filtros.status] ?? filtros.status}</span>}
        {filtros.perfil && <span className="chip-filtro">Perfil {filtros.perfil}</span>}
        {filtros.material && <span className="chip-filtro">{filtros.material}</span>}
        {filtros.classificacao && <span className="chip-filtro">{filtros.classificacao}</span>}
        {filtros.origemDestino && <span className="chip-filtro">{filtros.origemDestino}</span>}
        {filtros.numeroDocumento && <span className="chip-filtro">NF {filtros.numeroDocumento}</span>}
        {filtros.placa && <span className="chip-filtro">Placa {filtros.placa}</span>}
        {temFiltro && (
          <Link href="/admin/relatorios" className="filtros-ativos-limpar">
            Limpar filtros
          </Link>
        )}
      </div>

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
          <p className="stat-value">{fmtToneladas(resumo.toneladas)}</p>
          <p className="stat-unit">t</p>
        </div>
      </div>

      {movimentacoes.length > 0 && <GraficosRelatorio dados={graficos} />}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-condensed text-base font-semibold uppercase tracking-wide text-ink">
            Movimentações <span className="font-sans font-normal normal-case tracking-normal text-ink-dim">({movimentacoes.length})</span>
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a href={`/api/relatorios/pdf${queryString ? `?${queryString}` : ''}`} className="btn btn-ghost btn-sm">
              Baixar PDF
            </a>
            <a href={`/api/relatorios/exportar${queryString ? `?${queryString}` : ''}`} className="btn btn-ghost btn-sm">
              Exportar Excel
            </a>
          </div>
        </div>
        <div className="card">
          <div className="tbl-wrap tbl-cards tbl-acoes-fixas">
            <table>
              <CabecalhoMovimentacoes />
              <tbody>
                {ordenarPorSituacao(movimentacoes).map((m) => (
                  <LinhaTabela key={m.id} mov={m} />
                ))}
                {movimentacoes.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EstadoVazio titulo="Nada encontrado" texto="Nenhuma movimentação com esses filtros." />
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
