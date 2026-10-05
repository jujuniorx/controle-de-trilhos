import Link from 'next/link';
import { listarPendentesConferencia } from '@/lib/services/movimentacao';
import { listarAguardandoChegada } from '@/lib/services/remetido';
import { requireAdmin } from '@/lib/services/requireAdmin';

function fmtData(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}

export default async function AdminHomePage() {
  await requireAdmin();
  const [movimentacoes, aguardandoChegada] = await Promise.all([listarPendentesConferencia(), listarAguardandoChegada()]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Movimentações pendentes de conferência</h1>
        <div className="flex gap-2">
          <Link href="/admin/relatorios" className="rounded border border-steel px-3 py-2 text-sm font-medium text-steel-dark">
            Relatórios
          </Link>
          <Link href="/admin/remetidos/novo" className="rounded bg-steel px-3 py-2 text-sm font-medium text-white">
            + Novo remetido
          </Link>
        </div>
      </div>
      <p className="text-sm text-neutral-600">{movimentacoes.length} movimentação(ões) aguardando conferência.</p>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left">
            <tr>
              <th className="p-2">Tipo</th>
              <th className="p-2">Data</th>
              <th className="p-2">NF</th>
              <th className="p-2">Origem/Destino</th>
              <th className="p-2">Caminhão</th>
              <th className="p-2">Responsável</th>
              <th className="p-2">Status</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {movimentacoes.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{m.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'}</td>
                <td className="p-2">{fmtData(m.dataMovimentacao)}</td>
                <td className="p-2">{m.numeroDocumento ?? 'Em aberto'}</td>
                <td className="p-2">{m.tipo === 'RECEBIMENTO' ? m.origem : m.destino}</td>
                <td className="p-2">
                  {m.placaCavalo}
                  {m.placaCarreta ? ` / ${m.placaCarreta}` : ''}
                </td>
                <td className="p-2">{m.responsavelPatio}</td>
                <td className="p-2">{m.status}</td>
                <td className="p-2 text-right">
                  <Link
                    href={m.tipo === 'RECEBIMENTO' ? `/admin/recebimentos/${m.id}` : `/admin/remetidos/${m.id}`}
                    className="text-blue-700 underline"
                  >
                    Ver detalhes
                  </Link>
                </td>
              </tr>
            ))}
            {movimentacoes.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-neutral-500">
                  Nenhuma movimentação pendente de conferência.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Remetidos aguardando chegada</h2>
        <p className="text-sm text-neutral-600">{aguardandoChegada.length} pré-cadastro(s) aguardando o Pátio confirmar.</p>
        <div className="mt-2 overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left">
              <tr>
                <th className="p-2">Reserva/Pedido</th>
                <th className="p-2">Destino</th>
                <th className="p-2">NF</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {aguardandoChegada.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.reservaPedido}</td>
                  <td className="p-2">{r.destino}</td>
                  <td className="p-2">{r.numeroDocumento ?? 'Em aberto'}</td>
                  <td className="p-2 text-right">
                    <Link href={`/admin/remetidos/${r.id}`} className="text-blue-700 underline">
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
              {aguardandoChegada.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-neutral-500">
                    Nenhum remetido aguardando chegada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
