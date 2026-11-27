import Link from 'next/link';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { FormRemetidoVagao } from './FormRemetidoVagao';

export default async function LancarRemetidoVagaoPage() {
  await requireAdmin();
  return (
    <main className="mx-auto w-full max-w-3xl xl:max-w-5xl space-y-4">
      <div>
        <Link href="/admin/vagoes" className="back-link">
          ← Voltar a Vagões
        </Link>
        <div className="page-header mt-1 !mb-0">
          <h1 className="page-title">Lançar remetido de vagão</h1>
        </div>
        <p className="text-sm text-ink-muted">Copie os dados do B.O. do trilheiro. Metros e toneladas são calculados pelo número de TLS (312 m cada).</p>
      </div>
      <FormRemetidoVagao />
    </main>
  );
}
