import { describe, it, expect } from 'vitest';
import { normalizarLocal, chaveLocal } from '@/lib/domain/local';

describe('normalizarLocal', () => {
  it('deixa "Ponta Grossa" sempre do mesmo jeito, não importa como foi digitado', () => {
    for (const digitado of ['Ponta Grossa', 'Ponta grossa', 'ponta grossa', 'PONTA GROSSA', ' Ponta   Grossa  ', 'Ponta Grossa']) {
      expect(normalizarLocal(digitado)).toBe('PONTA GROSSA');
    }
  });

  it('mantém acentos e pontuação', () => {
    expect(normalizarLocal('Usina Rondonópolis - MT')).toBe('USINA RONDONÓPOLIS - MT');
  });

  it('nulo, indefinido e vazio viram texto vazio', () => {
    expect(normalizarLocal(null)).toBe('');
    expect(normalizarLocal(undefined)).toBe('');
    expect(normalizarLocal('   ')).toBe('');
  });

  it('é idempotente (aplicar de novo não muda nada)', () => {
    const uma = normalizarLocal(' ponta  grossa ');
    expect(normalizarLocal(uma)).toBe(uma);
  });
});

describe('chaveLocal', () => {
  it('ignora acentos e maiúsculas para comparar', () => {
    expect(chaveLocal('Maringá')).toBe(chaveLocal('maringa'));
    expect(chaveLocal('Maringá')).toBe('MARINGA');
  });

  it('locais diferentes continuam diferentes', () => {
    expect(chaveLocal('Ponta Grossa')).not.toBe(chaveLocal('Jales'));
  });
});
