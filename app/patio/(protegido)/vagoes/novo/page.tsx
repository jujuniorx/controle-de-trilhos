import Link from 'next/link';
import { VagaoForm } from './VagaoForm';

export default function NovaChegadaVagaoPage() {
  return (
    <main className="mx-auto max-w-md lg:max-w-2xl p-4">
      <Link href="/patio" className="back-link">
        ← Voltar
      </Link>
      <h1 className="mt-1 font-condensed text-lg font-bold uppercase tracking-wide text-ink">Chegada de vagão</h1>
      <p className="text-sm text-ink-muted">Trilho novo. Toda barra tem 24 m. Vai para a conferência do Administrativo.</p>
      <VagaoForm />
    </main>
  );
}
