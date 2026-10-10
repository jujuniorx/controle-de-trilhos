import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { doisFatoresDisponivel } from '@/lib/services/segredo2fa';
import { Painel2fa } from './Painel2fa';

export default async function SegurancaPage() {
  const { userId } = await requireAdmin();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totpAtivo: true } });

  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <Link href="/admin" className="back-link">
        ← Voltar
      </Link>
      <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">Segurança da conta</h1>
      <Painel2fa ativo={user.totpAtivo} disponivel={doisFatoresDisponivel()} />
      <p className="text-sm text-ink-muted">
        <Link href="/admin/trocar-senha" className="underline">Trocar minha senha</Link>
      </p>
    </main>
  );
}
