import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { hashSegredo } from '@/lib/services/auth';
import { verificarPinComBloqueio } from '@/lib/services/patioAcesso';

// Mesmo identificador fixo usado internamente por verificarPinComBloqueio()
// em lib/services/patioAcesso.ts (o PIN do Pátio é um segredo único
// compartilhado, não por usuário).
const PIN_IDENTIFICADOR = 'PATIO_PIN';

describe('verificarPinComBloqueio — proteção contra força bruta do PIN do Pátio', () => {
  beforeAll(async () => {
    process.env.PATIO_PIN_HASH = await hashSegredo('1234');
    await prisma.loginAttempt.deleteMany({ where: { identificador: PIN_IDENTIFICADOR } });
  });

  afterEach(async () => {
    await prisma.loginAttempt.deleteMany({ where: { identificador: PIN_IDENTIFICADOR } });
  });

  it('bloqueia após 5 tentativas falhas, mesmo informando o PIN correto em seguida', async () => {
    for (let i = 0; i < 5; i++) {
      const tentativa = await verificarPinComBloqueio('0000');
      expect(tentativa.ok).toBe(false);
    }

    const resultado = await verificarPinComBloqueio('1234');
    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toMatch(/bloquead/);
  });

  it('aceita o PIN correto antes do bloqueio e limpa as tentativas anteriores', async () => {
    await verificarPinComBloqueio('0000');
    await verificarPinComBloqueio('0000');

    const resultado = await verificarPinComBloqueio('1234');
    expect(resultado.ok).toBe(true);

    const tentativa = await prisma.loginAttempt.findUnique({ where: { identificador: PIN_IDENTIFICADOR } });
    expect(tentativa).toBeNull();
  });

  afterAll(async () => {
    await prisma.loginAttempt.deleteMany({ where: { identificador: PIN_IDENTIFICADOR } });
    await prisma.$disconnect();
  });
});
