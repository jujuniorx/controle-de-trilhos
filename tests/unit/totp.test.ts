import { describe, it, expect } from 'vitest';
import { base32Encode, base32Decode, codigoTotp, verificarTotp, gerarSegredoTotp, otpauthUri, passoAtual } from '@/lib/services/totp';

// Vetores oficiais da RFC 6238 (SHA-1, segredo ASCII "12345678901234567890"), 8 dígitos → aqui comparamos os 6 últimos.
const SEGREDO = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it('base32 ida e volta', () => {
    expect(SEGREDO).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(SEGREDO).toString()).toBe('12345678901234567890');
    const s = gerarSegredoTotp();
    expect(base32Encode(base32Decode(s))).toBe(s);
  });

  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ])('bate com o vetor da RFC no instante %i', (t, oito) => {
    expect(codigoTotp(SEGREDO, Math.floor(t / 30), 8)).toBe(oito);
    expect(codigoTotp(SEGREDO, Math.floor(t / 30))).toBe(oito.slice(-6));
  });

  it('aceita o código atual e 1 passo de tolerância, recusa fora disso', () => {
    const agora = 1_700_000_000_000;
    const passo = passoAtual(agora);
    expect(verificarTotp(SEGREDO, codigoTotp(SEGREDO, passo), { agoraMs: agora })).toBe(passo);
    expect(verificarTotp(SEGREDO, codigoTotp(SEGREDO, passo - 1), { agoraMs: agora })).toBe(passo - 1);
    expect(verificarTotp(SEGREDO, codigoTotp(SEGREDO, passo + 5), { agoraMs: agora })).toBeNull();
  });

  it('não deixa reutilizar o mesmo código (anti-replay)', () => {
    const agora = 1_700_000_000_000;
    const passo = passoAtual(agora);
    const cod = codigoTotp(SEGREDO, passo);
    expect(verificarTotp(SEGREDO, cod, { agoraMs: agora, ultimoPasso: passo })).toBeNull();
    expect(verificarTotp(SEGREDO, cod, { agoraMs: agora, ultimoPasso: passo - 1 })).toBe(passo);
  });

  it('recusa formato inválido e aceita espaços', () => {
    const agora = 1_700_000_000_000;
    const cod = codigoTotp(SEGREDO, passoAtual(agora));
    expect(verificarTotp(SEGREDO, 'abc123', { agoraMs: agora })).toBeNull();
    expect(verificarTotp(SEGREDO, '12345', { agoraMs: agora })).toBeNull();
    expect(verificarTotp(SEGREDO, `${cod.slice(0, 3)} ${cod.slice(3)}`, { agoraMs: agora })).not.toBeNull();
  });

  it('monta o link otpauth com emissor e segredo', () => {
    const uri = otpauthUri(SEGREDO, 'paula');
    expect(uri.startsWith('otpauth://totp/Controle%20de%20Trilhos%3Apaula?')).toBe(true);
    expect(uri).toContain(`secret=${SEGREDO}`);
    expect(uri).toContain('issuer=Controle%20de%20Trilhos');
  });
});
