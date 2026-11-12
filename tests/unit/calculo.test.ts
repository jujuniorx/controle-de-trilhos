import { describe, it, expect } from 'vitest';
import { calcularMetros, validarReemprego } from '@/lib/domain/regras';

describe('calcularMetros', () => {
  it('multiplica quantidade por comprimento', () => {
    expect(calcularMetros(20, 12)).toBe(240);
  });

  it('mantém 2 casas decimais', () => {
    expect(calcularMetros(1, 8.73)).toBe(8.73);
    expect(calcularMetros(5, 12.5)).toBe(62.5);
  });
});

describe('validarReemprego', () => {
  it('aceita qualquer comprimento positivo (4 m, 6,99 m, 50 m)', () => {
    expect(validarReemprego(4)).toBe(true);
    expect(validarReemprego(6.99)).toBe(true);
    expect(validarReemprego(50)).toBe(true);
    expect(validarReemprego(0)).toBe(false);
  });
});
