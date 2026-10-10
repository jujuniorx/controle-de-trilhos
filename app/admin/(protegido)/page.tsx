import Link from 'next/link';
import { listarPendentesConferencia } from '@/lib/services/movimentacao';
import { listarAguardandoChegada } from '@/lib/services/remetido';
import { requireAdmin } from '@/lib/services/requireAdmin';

function fmtData(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
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

export default async function AdminHomePage() {
  await requireAdmin();
  const [movimentacoes, aguardandoChegada] = await Promise.all([listarPendentesConferencia(), listarAguardandoChegada()]);

  return (
    <main className="mx-auto max-w-4xl xl:max-w-6xl space-y-6 p-6">
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title">Movimentações pendentes de conferência</h1>
        <div className="flex gap-2">
          <Link href="/admin/relatorios" className="btn btn-ghost btn-sm">
            Relatórios
          </Link>
        </div>
      </div>
      <p className="-mt-4 text-sm text-ink-muted">{movimentacoes.length} movimentação(ões) aguardando conferência.</p>

      <div className="card">
        <div className="tbl-wrap tbl-cards">
          <table>
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
            <tbody>
              {movimentacoes.map((m) => (
                <tr key={m.id}>
                  <td data-label="Tipo">
                    <span className="badge badge-info">{m.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'}</span>
                  </td>
                  <td data-label="Data" className="font-mono">{fmtData(m.dataMovimentacao)}</td>
                  <td data-label="NF" className="font-mono">{m.numeroDocumento ?? 'Em aberto'}</td>
                  <td data-label="Origem/Destino">{m.tipo === 'RECEBIMENTO' ? m.origem : m.destino}</td>
                  <td data-label="Caminhão" className="font-mono">
                    {[m.placaCarreta, m.placaCarreta2, m.placaCavalo].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td data-label="Responsável">{m.responsavelPatio}</td>
                  <td data-label="Status">
                    <span className={`badge ${STATUS_BADGE[m.status] ?? 'badge-muted'}`}>
                      {STATUS_TEXTO[m.status] ?? m.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <Link
                      href={m.tipo === 'RECEBIMENTO' ? `/admin/recebimentos/${m.id}` : `/admin/remetidos/${m.id}`}
                      className="tbl-action"
                    >
                      Ver detalhes →
                    </Link>
                  </td>
                </tr>
              ))}
              {movimentacoes.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-ink-dim">
                    Nenhuma movimentação pendente de conferência.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="page-header">
          <h2 className="page-title text-base">Remetidos aguardando chegada</h2>
        </div>
        <p className="-mt-4 mb-2 text-sm text-ink-muted">{aguardandoChegada.length} pré-cadastro(s) aguardando o Pátio confirmar.</p>
        <div className="card">
          <div className="tbl-wrap tbl-cards">
            <table>
              <thead>
                <tr>
                  <th>Reserva/Pedido</th>
                  <th>Destino</th>
                  <th>NF</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {aguardandoChegada.map((r) => (
                  <tr key={r.id}>
                    <td>{r.reservaPedido ?? '—'}</td>
                    <td>{r.destino}</td>
                    <td className="font-mono">{r.numeroDocumento ?? 'Em aberto'}</td>
                    <td className="text-right">
                      <Link href={`/admin/remetidos/${r.id}`} className="tbl-action">
                        Ver detalhes →
                      </Link>
                    </td>
                  </tr>
                ))}
                {aguardandoChegada.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-ink-dim">
                      Nenhum remetido aguardando chegada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
