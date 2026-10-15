import { requireDono } from '@/lib/services/requireAdmin';
import { listarLixeira } from '@/lib/services/lixeira';
import { BotaoRestaurar } from './BotaoRestaurar';

export const dynamic = 'force-dynamic';

export default async function LixeiraPage() {
  await requireDono();
  const itens = await listarLixeira();

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">Lixeira</h1>
        <p className="text-sm text-ink-muted">
          Recebimentos e remetidos excluídos. Restaurar traz de volta tudo: grupos, medições e histórico.
        </p>
      </div>
      <div className="card tbl-cards overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left">Item</th>
              <th className="p-3 text-left">Tipo</th>
              <th className="p-3 text-left">Excluído por</th>
              <th className="p-3 text-left">Quando</th>
              <th className="p-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-ink-muted">A lixeira está vazia.</td>
              </tr>
            )}
            {itens.map((i) => (
              <tr key={i.id}>
                <td data-label="Item" className="p-3 font-semibold">{i.rotulo}</td>
                <td data-label="Tipo" className="p-3">{i.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'}</td>
                <td data-label="Excluído por" className="p-3">{i.excluidoPorNome}</td>
                <td data-label="Quando" className="p-3 font-mono">
                  {i.excluidoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td data-label="Ação" className="p-3 text-right"><BotaoRestaurar lixeiraId={i.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
