import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { criarSessao, validarSessao, revogarSessao } from '@/lib/services/auth';

describe('sessão administrativa', () => {
  let userIdCriado: string | undefined;

  it('cria, valida e revoga uma sessão', async () => {
    const user = await prisma.user.create({
      data: { nome: 'Admin Teste', email: 'admin-teste@example.com', senhaHash: 'x' },
    });
    userIdCriado = user.id;

    const { token } = await criarSessao(user.id);
    const valida = await validarSessao(token);
    expect(valida?.userId).toBe(user.id);

    await revogarSessao(token);
    expect(await validarSessao(token)).toBeNull();
  });

  afterAll(async () => {
    // Escopado ao usuário criado por este teste — nunca apagar sessões de terceiros.
    if (userIdCriado) await prisma.session.deleteMany({ where: { userId: userIdCriado } });
    await prisma.user.deleteMany({ where: { email: 'admin-teste@example.com' } });
    await prisma.$disconnect();
  });
});
