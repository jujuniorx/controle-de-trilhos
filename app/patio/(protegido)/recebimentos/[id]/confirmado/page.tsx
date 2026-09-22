import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';

export default async function RecebimentoConfirmadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mov = await prisma.movimentacao.findUnique({
    where: { id },
    include: { grupos: { include: { medicoes: true } } },
  });
  if (!mov) notFound();

  const temSucata = mov.grupos.some((g) => g.tipoMaterial === 'SUCATA');

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-lg font-semibold">Recebimento salvo</h1>
      <p className="mt-2 text-sm text-neutral-600">
        NF {mov.numeroDocumento} — status {mov.status}
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {mov.grupos.map((g, i) => (
          <li key={g.id} className="rounded border p-2">
            Grupo {i + 1}: {g.perfil} — {g.tipoMaterial} — {g.medicoes.length} medição(ões) —{' '}
            {Number(g.metrosTotal).toFixed(2)} m —{' '}
            {g.tipoMaterial === 'SUCATA' ? 'peso pendente' : `${Number(g.pesoCalculado ?? 0).toFixed(3)} t`}
          </li>
        ))}
      </ul>
      {temSucata && (
        <p className="mt-3 text-sm text-amber-700">
          Este recebimento tem sucata com peso pendente. O peso será informado pelo Administrativo com base no
          documento de pesagem.
        </p>
      )}
      <Link href="/patio" className="mt-6 inline-block h-11 rounded border px-4 py-2">
        Voltar ao início
      </Link>
    </main>
  );
}
