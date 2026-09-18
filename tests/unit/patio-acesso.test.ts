import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { hashSegredo } from '@/lib/services/auth';
import { verificarPin, criarAcessoPatio, validarAcessoPatio } from '@/lib/services/patioAcesso';

describe('acesso do Pátio por PIN', () => {
  beforeAll(async () => {
    process.env.PATIO_PIN_HASH = await hashSegredo('1234');
  });

  it('aceita o PIN correto e rejeita o errado', async () => {
    expect(await verificarPin('1234')).toBe(true);
    expect(await verificarPin('0000')).toBe(false);
  });

  it('emite e valida um token de acesso, e rejeita após revogação', async () => {
    const { token } = await criarAcessoPatio();
    expect(await validarAcessoPatio(token)).toBe(true);

    await prisma.patioAcessoToken.updateMany({ data: { revokedAt: new Date() } });
    expect(await validarAcessoPatio(token)).toBe(false);
  });

  afterAll(async () => {
    await prisma.patioAcessoToken.deleteMany({});
    await prisma.$disconnect();
  });
});
