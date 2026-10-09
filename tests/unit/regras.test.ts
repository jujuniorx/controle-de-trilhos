import { describe, it, expect } from 'vitest';
import { parseNumeroBR, arredondar3, pecasDoGrupo, classificarSC } from '@/lib/domain/regras';

describe('parseNumeroBR', () => {
  it('aceita vírgula ou ponto como separador decimal', () => {
    expect(parseNumeroBR('1,250')).toBe(1.25);
    expect(parseNumeroBR('1.250')).toBe(1.25);
  });

  it('rejeita vazio', () => {
    expect(parseNumeroBR('')).toBeNull();
    expect(parseNumeroBR('   ')).toBeNull();
  });

  it('rejeita negativo', () => {
    expect(parseNumeroBR('-1')).toBeNull();
  });

  it('rejeita texto que não é número', () => {
    expect(parseNumeroBR('abc')).toBeNull();
    expect(parseNumeroBR('1,2,3')).toBeNull();
  });
});

describe('arredondar3', () => {
  it('arredonda para 3 casas decimais', () => {
    expect(arredondar3(0.9179999999999999)).toBe(0.918);
    expect(arredondar3(1.2504)).toBe(1.25);
  });
});

describe('classificarSC', () => {
  it('SC1 a partir de 7,00 m (sem limite máximo)', () => {
    expect(classificarSC(7)).toBe('SC1');
    expect(classificarSC(76.52)).toBe('SC1');
  });

  it('SC2 de 3,00 a 6,99 m', () => {
    expect(classificarSC(3)).toBe('SC2');
    expect(classificarSC(6.99)).toBe('SC2');
  });

  it('SC3 de 0 a 2,99 m', () => {
    expect(classificarSC(0)).toBe('SC3');
    expect(classificarSC(2.99)).toBe('SC3');
  });
});

describe('pecasDoGrupo', () => {
  it('soma a quantidade de todas as medições', () => {
    expect(pecasDoGrupo([{ quantidade: 15 }, { quantidade: 1 }])).toBe(16);
  });

  it('retorna 0 para grupo sem medições', () => {
    expect(pecasDoGrupo([])).toBe(0);
  });
});
