import Link from 'next/link';

export default function PatioHomePage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-condensed text-xl font-bold uppercase tracking-wide text-ink">Pátio — Controle de Trilhos</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Área do Pátio. Fluxo completo disponível hoje: recebimento por caminhão.
      </p>
      <Link href="/patio/recebimentos/novo" className="btn btn-primary btn-lg mt-6 h-12">
        Novo recebimento
      </Link>
      <Link href="/patio/remetidos" className="btn btn-ghost btn-lg mt-3 h-12">
        Remetidos aguardando chegada
      </Link>
      <Link href="/patio/remetidos/novo" className="btn btn-ghost btn-lg mt-3 h-12">
        Novo remetido
      </Link>
    </main>
  );
}
