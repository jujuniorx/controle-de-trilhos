import Link from 'next/link';
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

const STATUS_LABEL: Record<string, { texto: string; className: string }> = {
  AGUARDANDO_CHEGADA: { texto: 'Aguardando chegada', className: 'bg-neutral-200 text-neutral-800' },
  PENDENTE_CONFERENCIA: { texto: 'Pendente de conferência', className: 'bg-amber-100 text-amber-800' },
  CONFERIDO: { texto: 'Conferido', className: 'bg-emerald-100 text-emerald-800' },
};

function LinhaTabela({ mov }: { mov: MovimentacaoRelatorio }) {
  const statusInfo = STATUS_LABEL[mov.status];
  return (
    <tr className="border-t">
      <td className="p-2">{mov.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'}</td>
      <td className="p-2">{fmtData(mov.dataMovimentacao)}</td>
      <td className="p-2">{mov.numeroDocumento ?? 'Em aberto'}</td>
      <td className="p-2">{mov.tipo === 'RECEBIMENTO' ? mov.origem : mov.destino}</td>
      <td className="p-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo?.className ?? 'bg-neutral-100'}`}>
          {statusInfo?.texto ?? mov.status}
        </span>
      </td>
      <td className="p-2 text-right">
        <Link href={detalheHref(mov)} className="text-blue-700 underline">
          Ver detalhes
        </Link>
      </td>
    </tr>
  );
}

function TabelaPendencia({ titulo, itens, vazio }: { titulo: string; itens: MovimentacaoRelatorio[]; vazio: string }) {
  return (
    <div>
      <h3 className="font-medium text-neutral-800">
        {titulo} <span className="font-normal text-neutral-500">({itens.length})</span>
      </h3>
      {itens.length === 0 ? (
        <p className="mt-1 text-sm text-neutral-500">{vazio}</p>
      ) : (
        <div className="mt-1 overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left">
              <tr>
                <th className="p-2">Tipo</th>
                <th className="p-2">Data</th>
                <th className="p-2">NF</th>
                <th className="p-2">Origem/Destino</th>
                <th className="p-2">Status</th>
                <th className="p-2" />
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

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Relatório de movimentação</h1>
        <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
          ← Voltar
        </Link>
      </div>

      <form method="get" className="rounded-lg border bg-white p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="f-inicio">Período (início)</label>
            <input id="f-inicio" type="date" name="dataInicio" defaultValue={filtros.dataInicio} className="mt-1 h-10 w-full rounded border px-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="f-fim">Período (fim)</label>
            <input id="f-fim" type="date" name="dataFim" defaultValue={filtros.dataFim} className="mt-1 h-10 w-full rounded border px-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="f-tipo">Tipo</label>
            <select id="f-tipo" name="tipo" defaultValue={filtros.tipo ?? ''} className="mt-1 h-10 w-full rounded border px-2 text-sm">
              <option value="">Todos</option>
              <option value="RECEBIMENTO">Recebimento</option>
              <option value="REMETIDO">Remetido</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="f-status">Status</label>
            <select id="f-status" name="status" defaultValue={filtros.status ?? ''} className="mt-1 h-10 w-full rounded border px-2 text-sm">
              <option value="">Todos</option>
              {STATUS_RELATORIO.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s].texto}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="f-perfil">Perfil</label>
            <select id="f-perfil" name="perfil" defaultValue={filtros.perfil ?? ''} className="mt-1 h-10 w-full rounded border px-2 text-sm">
              <option value="">Todos</option>
              {PERFIS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="f-material">Material</label>
            <select id="f-material" name="material" defaultValue={filtros.material ?? ''} className="mt-1 h-10 w-full rounded border px-2 text-sm">
              <option value="">Todos</option>
              {MATERIAIS_RELATORIO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="f-od">Origem/Destino</label>
            <input id="f-od" type="text" name="origemDestino" defaultValue={filtros.origemDestino} className="mt-1 h-10 w-full rounded border px-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600" htmlFor="f-nf">Nota fiscal</label>
            <input id="f-nf" type="text" inputMode="numeric" name="numeroDocumento" defaultValue={filtros.numeroDocumento} className="mt-1 h-10 w-full rounded border px-2 text-sm" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="submit" className="h-10 rounded bg-neutral-900 px-4 text-sm font-medium text-white">
            Filtrar
          </button>
          {temFiltro && (
            <Link href="/admin/relatorios" className="flex h-10 items-center rounded border px-4 text-sm font-medium text-neutral-700">
              Limpar filtros
            </Link>
          )}
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-neutral-500">Carregamentos</p>
          <p className="text-2xl font-semibold">{resumo.carregamentos}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-neutral-500">Peças</p>
          <p className="text-2xl font-semibold">{resumo.pecas}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-neutral-500">Metros</p>
          <p className="text-2xl font-semibold">{resumo.metros.toFixed(2)} m</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-neutral-500">Toneladas</p>
          <p className="text-2xl font-semibold">{resumo.toneladas.toFixed(3)} t</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-neutral-800">
          Movimentações <span className="font-normal text-neutral-500">({movimentacoes.length})</span>
        </h2>
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left">
              <tr>
                <th className="p-2">Tipo</th>
                <th className="p-2">Data</th>
                <th className="p-2">NF</th>
                <th className="p-2">Origem/Destino</th>
                <th className="p-2">Status</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {movimentacoes.map((m) => (
                <LinhaTabela key={m.id} mov={m} />
              ))}
              {movimentacoes.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-neutral-500">
                    Nenhuma movimentação encontrada com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-white p-4">
        <h2 className="font-semibold text-neutral-800">Pendências</h2>
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
