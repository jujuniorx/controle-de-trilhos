import Link from 'next/link';

export default function PatioHomePage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="font-condensed text-xl font-bold uppercase tracking-wide text-ink">Pátio — Controle de Trilhos</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Área do Pátio: recebimento por caminhão e remetidos (aguardando chegada ou lançamento direto).
      </p>
      <Link href="/patio/recebimentos/novo" className="btn btn-primary btn-lg mt-6 h-12">
        Novo recebimento
      </Link>
      <Link href="/patio/remetidos" className="btn btn-ghost btn-lg mt-3 h-12">
        Remetidos
      </Link>
    </main>
  );
}
