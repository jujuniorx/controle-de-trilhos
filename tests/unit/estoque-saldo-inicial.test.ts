import { describe, expect, it } from 'vitest';
import { SALDO_INICIAL_2026 } from '@/lib/estoque/saldoInicial2026';

function soma(filtro: (l: (typeof SALDO_INICIAL_2026)[number]) => boolean, campo: 'metros' | 'unidades' = 'metros'): number {
  return Math.round(SALDO_INICIAL_2026.filter(filtro).reduce((t, l) => t + (l[campo] ?? 0), 0) * 1000) / 1000;
}

describe('saldo inicial da planilha de 25/11/2026', () => {
  it('TLS novo: 52 no TR60 e 95 no TR68', () => {
    expect(soma((l) => l.tipo === 'TLS' && l.perfil === 'TR60', 'unidades')).toBe(52);
    expect(soma((l) => l.tipo === 'TLS' && l.perfil === 'TR68', 'unidades')).toBe(95);
    expect(soma((l) => l.tipo === 'TLS' && l.perfil === 'TR68')).toBe(29640);
  });
  it('barras do novo', () => {
    expect(soma((l) => l.tipo === 'LISA' && l.perfil === 'TR60')).toBe(96032);
    expect(soma((l) => l.tipo === 'TALA' && l.perfil === 'TR68')).toBe(29586);
    expect(soma((l) => l.tipo === 'MENOR12' && l.perfil === 'UIC60')).toBe(796.47);
    expect(soma((l) => l.tipo === 'CURTA12')).toBe(336);
  });
  it('classes do novo vêm da coluna Classificação', () => {
    expect(SALDO_INICIAL_2026.some((l) => l.classe === '21M' && l.perfil === 'TR68' && l.metros === 861)).toBe(true);
    expect(SALDO_INICIAL_2026.some((l) => l.classe === 'TESTE' && l.fabricante === 'UHCX')).toBe(true);
  });
  it('reemprego soma 32.298,05 m', () => {
    expect(soma((l) => l.secao === 'REEMPREGO')).toBe(32298.05);
    expect(soma((l) => l.secao === 'REEMPREGO' && l.classe === 'G1')).toBe(8502.25);
  });
  it('sucata soma 64.325,21 m, com 2.099,553 m de tocos', () => {
    expect(soma((l) => l.secao === 'SUCATA')).toBe(64325.211);
    expect(soma((l) => l.secao === 'SUCATA' && l.classe === 'SC3')).toBe(2099.553);
  });
  it('não grava linha zerada', () => {
    expect(SALDO_INICIAL_2026.every((l) => l.metros !== 0)).toBe(true);
  });
});
