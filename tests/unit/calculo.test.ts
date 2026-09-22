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
  it('rejeita comprimento abaixo de 7 metros', () => {
    expect(validarReemprego(6.99)).toBe(false);
    expect(validarReemprego(7.0)).toBe(true);
  });
});
