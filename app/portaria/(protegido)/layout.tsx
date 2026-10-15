import { requirePortaria } from '@/lib/services/requirePortaria';
import { sairPortariaAction } from './actions';

export default async function PortariaLayout({ children }: { children: React.ReactNode }) {
  const { nome } = await requirePortaria();
  return (
    <div className="area-admin min-h-screen bg-bg text-ink">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="font-condensed text-lg font-bold uppercase tracking-wide">Portaria</p>
          <p className="text-xs text-ink-muted">{nome}</p>
        </div>
        <form action={sairPortariaAction}>
          <button type="submit" className="btn btn-ghost btn-sm">
            Sair
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
