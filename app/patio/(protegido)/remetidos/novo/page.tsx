import Link from 'next/link';
import { NovoRemetido } from './NovoRemetido';

export default function NovoRemetidoPage() {
  return (
    <main className="mx-auto max-w-md lg:max-w-none p-4">
      <Link href="/patio/remetidos" className="back-link">
        ← Voltar
      </Link>
      <h1 className="mt-1 font-condensed text-lg font-bold uppercase tracking-wide text-ink">Nova carga</h1>

      <NovoRemetido />
    </main>
  );
}
