import Link from 'next/link';
import { RemetidoWizard } from '../RemetidoWizard';

export default function NovoRemetidoPage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/patio/remetidos" className="text-sm text-neutral-500 hover:underline">
        ← Voltar
      </Link>
      <h1 className="mt-1 text-lg font-semibold">Novo remetido</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Lançamento direto pelo Pátio, sem pré-cadastro do Administrativo.
      </p>

      <RemetidoWizard modo="novo" />
    </main>
  );
}
