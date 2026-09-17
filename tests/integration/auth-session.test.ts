import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { criarSessao, validarSessao, revogarSessao } from '@/lib/services/auth';

describe('sessão administrativa', () => {
  it('cria, valida e revoga uma sessão', async () => {
    const user = await prisma.user.create({
      data: { nome: 'Admin Teste', email: 'admin-teste@example.com', senhaHash: 'x' },
    });

    const { token } = await criarSessao(user.id);
    const valida = await validarSessao(token);
    expect(valida?.userId).toBe(user.id);

    await revogarSessao(token);
    expect(await validarSessao(token)).toBeNull();
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({ where: { email: 'admin-teste@example.com' } });
    await prisma.$disconnect();
  });
});
