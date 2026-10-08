import { describe, it, expect } from 'vitest';
import { parseNumeroBR, arredondar3, pecasDoGrupo } from '@/lib/domain/regras';

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

describe('pecasDoGrupo', () => {
  it('soma a quantidade de todas as medições', () => {
    expect(pecasDoGrupo([{ quantidade: 15 }, { quantidade: 1 }])).toBe(16);
  });

  it('retorna 0 para grupo sem medições', () => {
    expect(pecasDoGrupo([])).toBe(0);
  });
});
