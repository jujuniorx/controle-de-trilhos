import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// Mocka o módulo de acesso ao banco inteiro (não um banco real) para simular
// indisponibilidade do Neon de forma determinística — sem isso, o cenário só
// seria reproduzível derrubando a conexão de verdade. O mock intercepta as
// mesmas três chamadas que verificarPinComBloqueio() faz em
// lib/services/patioAcesso.ts: findUnique, upsert e deleteMany.
vi.mock('@/lib/db', () => ({
  prisma: { loginAttempt: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() } },
}));

import { prisma } from '@/lib/db';
import { hashSegredo } from '@/lib/services/auth';
import { verificarPinComBloqueio } from '@/lib/services/patioAcesso';

const loginAttempt = prisma.loginAttempt as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
};

function erroDeConexao(): Prisma.PrismaClientInitializationError {
  return new Prisma.PrismaClientInitializationError('Can not reach database server', '6.19.3');
}

describe('verificarPinComBloqueio — banco indisponível', () => {
  beforeAll(async () => {
    process.env.PATIO_PIN_HASH = await hashSegredo('1234');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('nega o acesso com mensagem de indisponibilidade quando a consulta inicial falha, sem contar como PIN incorreto', async () => {
    loginAttempt.findUnique.mockRejectedValue(erroDeConexao());

    const resultado = await verificarPinComBloqueio('1234');

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toMatch(/indispon/i);
    expect(resultado.erro).not.toBe('Código inválido.');
    // Nunca chegou a decidir se o PIN bate — não deve ter tentado registrar
    // nenhuma tentativa (certa ou errada) no rate limiting.
    expect(loginAttempt.upsert).not.toHaveBeenCalled();
  });

  it('nega o acesso com indisponibilidade quando falha ao registrar um PIN errado, sem mascarar de "Código inválido."', async () => {
    loginAttempt.findUnique.mockResolvedValue(null);
    loginAttempt.upsert.mockRejectedValue(erroDeConexao());

    const resultado = await verificarPinComBloqueio('0000');

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toMatch(/indispon/i);
    expect(resultado.erro).not.toBe('Código inválido.');
  });

  it('nega o acesso (fail-safe) quando o PIN está correto mas falha ao limpar as tentativas anteriores', async () => {
    loginAttempt.findUnique.mockResolvedValue(null);
    loginAttempt.deleteMany.mockRejectedValue(erroDeConexao());

    const resultado = await verificarPinComBloqueio('1234');

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toMatch(/indispon/i);
  });

  it('não esconde um erro do Prisma que não é de conexão (bug de query/schema continua explodindo)', async () => {
    const erroDeQuery = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.3',
    });
    loginAttempt.findUnique.mockRejectedValue(erroDeQuery);

    await expect(verificarPinComBloqueio('1234')).rejects.toBe(erroDeQuery);
  });

  it('com o banco no ar, a autenticação normal continua funcionando (PIN certo e errado)', async () => {
    loginAttempt.findUnique.mockResolvedValue(null);
    loginAttempt.upsert.mockResolvedValue({});
    loginAttempt.deleteMany.mockResolvedValue({ count: 1 });

    const errado = await verificarPinComBloqueio('0000');
    expect(errado).toEqual({ ok: false, erro: 'Código inválido.' });

    const certo = await verificarPinComBloqueio('1234');
    expect(certo).toEqual({ ok: true });
  });
});
