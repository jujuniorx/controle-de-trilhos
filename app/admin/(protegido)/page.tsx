import Link from 'next/link';
import { listarPendentesConferencia } from '@/lib/services/movimentacao';

function fmtData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default async function AdminHomePage() {
  const movimentacoes = await listarPendentesConferencia();

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-lg font-semibold">Recebimentos pendentes de conferência</h1>
      <p className="mt-1 text-sm text-neutral-600">{movimentacoes.length} recebimento(s) aguardando conferência.</p>

      <div className="mt-4 overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left">
            <tr>
              <th className="p-2">Data</th>
              <th className="p-2">NF</th>
              <th className="p-2">Origem</th>
              <th className="p-2">Caminhão</th>
              <th className="p-2">Responsável</th>
              <th className="p-2">Status</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {movimentacoes.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{fmtData(m.dataMovimentacao)}</td>
                <td className="p-2">{m.numeroDocumento}</td>
                <td className="p-2">{m.origem}</td>
                <td className="p-2">
                  {m.placaCavalo} / {m.placaCarreta}
                </td>
                <td className="p-2">{m.responsavelPatio}</td>
                <td className="p-2">{m.status}</td>
                <td className="p-2 text-right">
                  <Link href={`/admin/recebimentos/${m.id}`} className="text-blue-700 underline">
                    Ver detalhes
                  </Link>
                </td>
              </tr>
            ))}
            {movimentacoes.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-neutral-500">
                  Nenhum recebimento pendente de conferência.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
