import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { hashSegredo } from '@/lib/services/auth';
import { autenticar } from '@/lib/services/loginService';
import { loginAction } from '@/app/admin/login/actions';

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

  it('loginAction devolve a mensagem de erro em vez de descartá-la', async () => {
    // Regressão: a action usada pelo <form> chegou a envolver login() numa função que
    // devolvia void e descartava o resultado — o administrativo não via "E-mail ou senha
    // inválidos" nem o aviso de bloqueio, e o botão "Entrar" parecia simplesmente não fazer nada.
    const formData = new FormData();
    formData.set('email', 'login-teste-3@example.com');
    formData.set('senha', 'senha-errada');

    const estado = await loginAction({}, formData);
    expect(estado.erro).toBe('E-mail ou senha inválidos.');
  });

  afterAll(async () => {
    // Escopado aos registros criados por este teste — nunca apagar sessões ou
    // tentativas de login (lockouts) de terceiros.
    const emails = ['login-teste@example.com', 'login-teste-2@example.com', 'login-teste-3@example.com'];
    const usuarios = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    await prisma.session.deleteMany({ where: { userId: { in: usuarios.map((u) => u.id) } } });
    await prisma.loginAttempt.deleteMany({ where: { identificador: { in: emails } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });
});
