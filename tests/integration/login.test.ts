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
    await prisma.session.deleteMany({});
    await prisma.loginAttempt.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: ['login-teste@example.com', 'login-teste-2@example.com'] } } });
    await prisma.$disconnect();
  });
});
