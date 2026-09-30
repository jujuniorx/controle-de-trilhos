import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { hashSegredo } from '@/lib/services/auth';
import { autenticar } from '@/lib/services/loginService';

describe('autenticar', () => {
  it('bloqueia após 5 tentativas falhas', async () => {
    await prisma.user.create({
      data: { nome: 'Admin', email: 'login-teste@example.com', senhaHash: await hashSegredo('senha-correta') },
    });

    for (let i = 0; i < 5; i++) {
      await autenticar('login-teste@example.com', 'errada');
    }

    const resultado = await autenticar('login-teste@example.com', 'senha-correta');
    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toMatch(/bloqueada/);
  });

  it('autentica com credenciais corretas antes do bloqueio', async () => {
    await prisma.user.create({
      data: { nome: 'Admin2', email: 'login-teste-2@example.com', senhaHash: await hashSegredo('senha-correta') },
    });

    const resultado = await autenticar('login-teste-2@example.com', 'senha-correta');
    expect(resultado.ok).toBe(true);
    expect(resultado.token).toBeDefined();
  });

  afterAll(async () => {
    // Escopado aos registros criados por este teste — nunca apagar sessões ou
    // tentativas de login (lockouts) de terceiros.
    const emails = ['login-teste@example.com', 'login-teste-2@example.com'];
    const usuarios = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    await prisma.session.deleteMany({ where: { userId: { in: usuarios.map((u) => u.id) } } });
    await prisma.loginAttempt.deleteMany({ where: { identificador: { in: emails } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });
});
