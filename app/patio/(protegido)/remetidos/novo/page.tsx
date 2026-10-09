import Link from 'next/link';
import { RemetidoWizard } from '../RemetidoWizard';

export default function NovoRemetidoPage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/patio/remetidos" className="back-link">
        ← Voltar
      </Link>
      <h1 className="mt-1 font-condensed text-lg font-bold uppercase tracking-wide text-ink">Novo remetido</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Lançamento direto pelo Pátio, sem pré-cadastro do Administrativo.
      </p>

      <RemetidoWizard modo="novo" />
    </main>
  );
}
