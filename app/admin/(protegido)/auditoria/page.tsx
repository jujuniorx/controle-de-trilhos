import { requireDono } from '@/lib/services/requireAdmin';
import { listarAuditoria } from '@/lib/services/auditoria';

export const dynamic = 'force-dynamic';

export default async function AuditoriaPage() {
  await requireDono();
  const registros = await listarAuditoria(200);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">Auditoria</h1>
        <p className="text-sm text-ink-muted">Exclusões e mudanças de contas: quem fez, o quê e quando (últimos 200).</p>
      </div>
      <div className="card tbl-cards overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left">Quando</th>
              <th className="p-3 text-left">Quem</th>
              <th className="p-3 text-left">Ação</th>
              <th className="p-3 text-left">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-ink-muted">Nada registrado ainda.</td>
              </tr>
            )}
            {registros.map((r) => (
              <tr key={r.id}>
                <td data-label="Quando" className="p-3 font-mono">
                  {r.criadoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td data-label="Quem" className="p-3">{r.usuarioNome}</td>
                <td data-label="Ação" className="p-3 font-semibold">{r.acao}</td>
                <td data-label="Detalhe" className="p-3">{r.descricao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
