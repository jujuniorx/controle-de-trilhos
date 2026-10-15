import Link from 'next/link';
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
      <nav className="flex gap-2 border-b border-line px-4 py-2" aria-label="Seções da Portaria">
        <Link href="/portaria" className="btn btn-ghost btn-sm">
          Remetidos
        </Link>
        <Link href="/portaria/recebimentos" className="btn btn-ghost btn-sm">
          Recebimentos
        </Link>
      </nav>
      {children}
    </div>
  );
}
