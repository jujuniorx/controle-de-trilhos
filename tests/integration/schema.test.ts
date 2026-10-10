import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';

describe('schema smoke test', () => {
  it('cria e lê um usuário', async () => {
    const user = await prisma.user.create({
      data: { nome: 'Teste', email: 'teste@example.com', senhaHash: 'x' },
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.email).toBe('teste@example.com');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: 'teste@example.com' } });
    await prisma.$disconnect();
  });
});
