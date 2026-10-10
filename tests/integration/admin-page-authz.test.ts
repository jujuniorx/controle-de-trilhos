import { describe, it, expect, vi, afterAll } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}));

import { prisma } from '@/lib/db';
import AdminHomePage from '@/app/admin/(protegido)/page';
import RecebimentoDetalhePage from '@/app/admin/(protegido)/recebimentos/[id]/page';

describe('Páginas do Admin — reverificação de autorização no servidor (bypass do layout)', () => {
  it('AdminHomePage redireciona para /admin/login quando chamada sem sessão válida', async () => {
    let erroCapturado: unknown;
    try {
      await AdminHomePage();
    } catch (erro) {
      erroCapturado = erro;
    }

    expect(erroCapturado).toBeDefined();
    expect((erroCapturado as { digest?: string })?.digest).toMatch(/^NEXT_REDIRECT/);
  });

  it('RecebimentoDetalhePage redireciona para /admin/login quando chamada sem sessão válida', async () => {
    let erroCapturado: unknown;
    try {
      await RecebimentoDetalhePage({ params: Promise.resolve({ id: 'id-qualquer' }) });
    } catch (erro) {
      erroCapturado = erro;
    }

    expect(erroCapturado).toBeDefined();
    expect((erroCapturado as { digest?: string })?.digest).toMatch(/^NEXT_REDIRECT/);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
