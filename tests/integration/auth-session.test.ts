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

  it('validarSessao também devolve o nome do usuário', async () => {
    const user = await prisma.user.create({
      data: { nome: 'Admin Com Nome', email: 'admin-nome-teste@example.com', senhaHash: 'x' },
    });

    const { token } = await criarSessao(user.id);
    const valida = await validarSessao(token);
    expect(valida?.nome).toBe('Admin Com Nome');

    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { email: 'admin-nome-teste@example.com' } });
  });

  afterAll(async () => {
    // Escopado ao usuário criado por este teste — nunca apagar sessões de terceiros.
    if (userIdCriado) await prisma.session.deleteMany({ where: { userId: userIdCriado } });
    await prisma.user.deleteMany({ where: { email: 'admin-teste@example.com' } });
    await prisma.$disconnect();
  });
});
