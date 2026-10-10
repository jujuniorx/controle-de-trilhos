import { describe, it, expect } from 'vitest';
import { pesoSucataRealSchema } from '@/lib/validation/conferencia';

describe('pesoSucataRealSchema', () => {
  it('aceita um número positivo', () => {
    expect(pesoSucataRealSchema.safeParse(1.25).success).toBe(true);
  });

  it('rejeita zero e negativo', () => {
    expect(pesoSucataRealSchema.safeParse(0).success).toBe(false);
    expect(pesoSucataRealSchema.safeParse(-1.25).success).toBe(false);
  });

  it('rejeita NaN e Infinity', () => {
    expect(pesoSucataRealSchema.safeParse(NaN).success).toBe(false);
    expect(pesoSucataRealSchema.safeParse(Infinity).success).toBe(false);
  });

  it('rejeita valores que não são number (ex.: texto)', () => {
    expect(pesoSucataRealSchema.safeParse('1,25' as unknown as number).success).toBe(false);
  });
});
