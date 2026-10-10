import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cifrar, decifrar, criarPasse2fa, lerPasse2fa, doisFatoresDisponivel } from '@/lib/services/segredo2fa';

const ANTES = process.env.TOTP_ENC_KEY;
beforeAll(() => {
  process.env.TOTP_ENC_KEY = 'chave-de-teste-com-mais-de-16-caracteres';
});
afterAll(() => {
  if (ANTES === undefined) delete process.env.TOTP_ENC_KEY;
  else process.env.TOTP_ENC_KEY = ANTES;
});

describe('segredo2fa', () => {
  it('cifra e decifra, sem guardar o texto aberto', () => {
    const c = cifrar('JBSWY3DPEHPK3PXP');
    expect(c.startsWith('v1:')).toBe(true);
    expect(c).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decifrar(c)).toBe('JBSWY3DPEHPK3PXP');
    expect(cifrar('JBSWY3DPEHPK3PXP')).not.toBe(c); // IV novo a cada vez
  });

  it('recusa valor adulterado', () => {
    const c = cifrar('segredo');
    const ruim = c.slice(0, -4) + (c.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    expect(() => decifrar(ruim)).toThrow();
  });

  it('passe de login: vale 5 minutos, só para o usuário certo, e não pode ser forjado', () => {
    const agora = 1_700_000_000_000;
    const passe = criarPasse2fa('user-1', agora);
    expect(lerPasse2fa(passe, agora + 60_000)).toBe('user-1');
    expect(lerPasse2fa(passe, agora + 6 * 60_000)).toBeNull();
    expect(lerPasse2fa(undefined)).toBeNull();
    const [payload, assinatura] = passe.split('.');
    const forjado = Buffer.from(JSON.stringify({ u: 'outro', e: agora + 999999 })).toString('base64url');
    expect(lerPasse2fa(`${forjado}.${assinatura}`, agora)).toBeNull();
    expect(lerPasse2fa(`${payload}.xxxx`, agora)).toBeNull();
  });

  it('sem TOTP_ENC_KEY o 2FA fica indisponível e a cifra falha fechado', () => {
    const k = process.env.TOTP_ENC_KEY;
    delete process.env.TOTP_ENC_KEY;
    expect(doisFatoresDisponivel()).toBe(false);
    expect(() => cifrar('x')).toThrow();
    process.env.TOTP_ENC_KEY = k;
  });
});
