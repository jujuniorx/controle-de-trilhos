import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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

  it('aceita o PIN com espaços nas pontas (autofill/teclado numérico podem inserir)', async () => {
    expect(await verificarPin(' 1234')).toBe(true);
    expect(await verificarPin('1234 ')).toBe(true);
    expect(await verificarPin('  1234  ')).toBe(true);
  });

  it('continua rejeitando espaço no meio do PIN (não é a mesma sequência de dígitos)', async () => {
    expect(await verificarPin('12 34')).toBe(false);
  });

  it('registra um aviso nos logs quando PATIO_PIN_HASH não tem formato de hash Argon2id válido, sem nunca logar o valor do hash ou do PIN', async () => {
    const hashOriginal = process.env.PATIO_PIN_HASH;
    const avisos: string[] = [];
    const espiao = vi.spyOn(console, 'error').mockImplementation((msg: unknown) => {
      avisos.push(String(msg));
    });

    // Representa o tipo de corrupção suspeitada nesta investigação: interpolação
    // de shell/template ao configurar a env var removendo o segmento "$v=19$" de
    // um hash que originalmente era bem formado (não precisa ser uma simulação
    // literal de parsing de shell — só precisa ser claramente malformado).
    process.env.PATIO_PIN_HASH = '$argon2id$m=65536,p=4,t=3$saltcorrompidoXYZ$hashcorrompidoABC';

    expect(await verificarPin('1234')).toBe(false);

    expect(avisos.length).toBeGreaterThan(0);
    expect(avisos.some((a) => a.includes('formato esperado'))).toBe(true);
    const textoCompleto = avisos.join('\n');
    expect(textoCompleto).not.toContain('saltcorrompidoXYZ');
    expect(textoCompleto).not.toContain('hashcorrompidoABC');
    expect(textoCompleto).not.toContain('1234');

    espiao.mockRestore();
    process.env.PATIO_PIN_HASH = hashOriginal;
  });

  it('não registra nenhum aviso quando PATIO_PIN_HASH tem formato Argon2id válido', async () => {
    const avisos: string[] = [];
    const espiao = vi.spyOn(console, 'error').mockImplementation((msg: unknown) => {
      avisos.push(String(msg));
    });

    await verificarPin('1234');

    expect(avisos.length).toBe(0);
    espiao.mockRestore();
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
