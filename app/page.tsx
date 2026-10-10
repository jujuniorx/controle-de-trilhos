import Link from 'next/link';
import { BotaoInstalar } from '@/components/InstalarApp';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-6 text-center">
      <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">Controle de Trilhos</h1>
      <p className="mt-2 text-sm text-ink-muted">Escolha como deseja entrar.</p>

      <div className="mt-6 w-full space-y-3">
        <Link href="/patio/acesso" className="btn btn-primary btn-lg h-12">
          Acesso do Pátio
        </Link>
        <Link href="/admin/login" className="btn btn-ghost btn-lg h-12">
          Login do Administrativo
        </Link>
        <BotaoInstalar />
      </div>
    </main>
  );
}
