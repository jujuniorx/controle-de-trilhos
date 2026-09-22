import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { hashSegredo } from '@/lib/services/auth';
import { verificarPin, criarAcessoPatio, validarAcessoPatio } from '@/lib/services/patioAcesso';

// Mesmo algoritmo de hashToken() em lib/services/patioAcesso.ts (não exportado) — usado aqui
// só para localizar/escopar nosso próprio registro, sem tocar em tokens de outros arquivos
// de teste que rodam em paralelo contra o mesmo banco.
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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

    // Escopado ao próprio token (por tokenHash) — outros arquivos de teste (ex.: sync-route.test.ts)
    // podem estar criando/validando tokens em paralelo contra o mesmo banco.
    await prisma.patioAcessoToken.updateMany({
      where: { tokenHash: hashToken(token) },
      data: { revokedAt: new Date() },
    });
    expect(await validarAcessoPatio(token)).toBe(false);

    await prisma.patioAcessoToken.deleteMany({ where: { tokenHash: hashToken(token) } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
