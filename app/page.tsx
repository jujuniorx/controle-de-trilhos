import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900">Controle de Trilhos</h1>
      <p className="mt-2 text-sm text-neutral-600">Escolha como deseja entrar.</p>

      <div className="mt-6 w-full space-y-3">
        <Link
          href="/patio/acesso"
          className="flex h-12 w-full items-center justify-center rounded-lg bg-neutral-900 px-4 font-medium text-white"
        >
          Acesso do Pátio
        </Link>
        <Link
          href="/admin/login"
          className="flex h-12 w-full items-center justify-center rounded-lg border border-neutral-900 px-4 font-medium text-neutral-900"
        >
          Login do Administrativo
        </Link>
      </div>
    </main>
  );
}
