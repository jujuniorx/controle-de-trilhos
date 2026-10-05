import Link from 'next/link';

export default function PatioHomePage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Pátio — Controle de Trilhos</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Área do Pátio. Fluxo completo disponível hoje: recebimento por caminhão.
      </p>
      <Link
        href="/patio/recebimentos/novo"
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-steel px-4 font-medium text-white"
      >
        Novo recebimento
      </Link>
      <Link
        href="/patio/remetidos"
        className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-lg border border-steel px-4 font-medium text-steel-dark"
      >
        Remetidos aguardando chegada
      </Link>
    </main>
  );
}
