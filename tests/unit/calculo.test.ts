import { describe, it, expect } from 'vitest';
import { fatorPerfil, calcularPeso, calcularMetros, classificarSC, validarReemprego } from '@/lib/services/calculo';

describe('fatorPerfil', () => {
  it('calcula o fator a partir do número do perfil', () => {
    expect(fatorPerfil('TR68')).toBe(0.068);
    expect(fatorPerfil('TR22')).toBe(0.022);
  });
});

describe('calcularPeso', () => {
  it('calcula peso com 3 casas decimais', () => {
    expect(calcularPeso(100, 'TR68')).toBe(6.8);
  });
});

describe('calcularMetros', () => {
  it('multiplica quantidade por comprimento', () => {
    expect(calcularMetros(20, 12)).toBe(240);
  });
});

describe('classificarSC', () => {
  it('classifica os limites exatos de cada faixa', () => {
    expect(classificarSC(7.0)).toBe('SC1');
    expect(classificarSC(12.0)).toBe('SC1');
    expect(classificarSC(6.99)).toBe('SC2');
    expect(classificarSC(3.0)).toBe('SC2');
    expect(classificarSC(2.99)).toBe('SC3');
    expect(classificarSC(0)).toBe('SC3');
  });

  it('rejeita comprimento fora da faixa válida', () => {
    expect(() => classificarSC(12.01)).toThrow();
    expect(() => classificarSC(-1)).toThrow();
  });
});

describe('validarReemprego', () => {
  it('rejeita comprimento abaixo de 7 metros', () => {
    expect(validarReemprego(6.99)).toBe(false);
    expect(validarReemprego(7.0)).toBe(true);
  });
});
