import { requireDono } from '@/lib/services/requireAdmin';
import { listarPilhasPatio } from '@/lib/services/pilhasPatio';

export const dynamic = 'force-dynamic';

function formatarData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}

export default async function PilhasDonoPage() {
  await requireDono();
  const pilhas = await listarPilhasPatio();
  const preenchidas = pilhas.filter((p) => p.nome.trim() && p.material).length;
  const ultima = pilhas.reduce<string | null>((acc, p) => (!acc || p.atualizadoEm > acc ? p.atualizadoEm : acc), null);

  return (
    <main className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-condensed text-3xl font-bold uppercase tracking-wide text-ink">Pilhas do pátio</h1>
        <p className="text-sm text-ink-muted">Acompanhamento do levantamento feito pelo pátio. Somente leitura.</p>
      </header>

      <section className="card grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">Pilhas cadastradas</p>
          <p className="font-condensed text-3xl font-bold text-ink">{pilhas.length}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">Com nome e material</p>
          <p className="font-condensed text-3xl font-bold text-ink">
            {preenchidas} de {pilhas.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">Última alteração</p>
          <p className="text-sm font-medium text-ink">{ultima ? formatarData(ultima) : 'Nenhuma ainda'}</p>
        </div>
      </section>

      {pilhas.length === 0 ? (
        <p className="text-sm text-ink-muted">O pátio ainda não cadastrou nenhuma pilha.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Nome da pilha</th>
                <th className="px-4 py-3 font-medium">O que tem nela</th>
                <th className="px-4 py-3 font-medium">Observação</th>
                <th className="px-4 py-3 font-medium">Atualizada em</th>
              </tr>
            </thead>
            <tbody>
              {pilhas.map((p, i) => (
                <tr key={p.id} className="border-t border-line align-top">
                  <td className="px-4 py-3 text-ink-muted">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-ink">{p.nome || <span className="text-ink-muted">sem nome</span>}</td>
                  <td className="px-4 py-3 text-ink">{p.material || <span className="text-ink-muted">não definido</span>}</td>
                  <td className="px-4 py-3 text-ink-muted">{p.observacao || '-'}</td>
                  <td className="px-4 py-3 text-ink-muted whitespace-nowrap">{formatarData(p.atualizadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
