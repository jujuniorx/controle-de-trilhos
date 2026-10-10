import { requireDono } from '@/lib/services/requireAdmin';
import { listarUsuarios } from '@/lib/services/usuarios';
import { NovoUsuarioForm } from './NovoUsuarioForm';
import { AcoesUsuario } from './AcoesUsuario';

export const dynamic = 'force-dynamic';

function fmtDataHora(d: Date | null): string {
  return d ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : 'Nunca entrou';
}

export default async function UsuariosPage() {
  const dono = await requireDono();
  const usuarios = await listarUsuarios();

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">Usuários</h1>
        <p className="text-sm text-ink-muted">Quem pode entrar no Administrativo. Só você enxerga esta página.</p>
      </div>

      <NovoUsuarioForm />

      <div className="card tbl-cards overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left">Nome</th>
              <th className="p-3 text-left">Usuário</th>
              <th className="p-3 text-left">Situação</th>
              <th className="p-3 text-left">Último acesso</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td data-label="Nome" className="p-3 font-semibold">
                  {u.nome} {u.role === 'DONO' && <span className="badge badge-muted ml-1">Dono</span>}
                </td>
                <td data-label="Usuário" className="p-3 font-mono">{u.username ?? u.email}</td>
                <td data-label="Situação" className="p-3">
                  <span className={`badge ${u.ativo ? 'badge-ok' : 'badge-muted'}`}>{u.ativo ? 'Ativa' : 'Desativada'}</span>
                </td>
                <td data-label="Último acesso" className="p-3">{fmtDataHora(u.ultimoLoginEm)}</td>
                <td className="p-3 text-right">
                  <AcoesUsuario id={u.id} nome={u.nome} ativo={u.ativo} ehVoce={u.id === dono.userId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
