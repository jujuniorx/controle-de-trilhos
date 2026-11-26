import { describe, it, expect } from 'vitest';
import { chegadaVagaoSchema } from '@/lib/validation/vagao';

function valido(linhas: unknown[] = [{ perfil: 'TR68', marca: 'PANGANG', formaNovo: 'LISA', barras: 36 }]) {
  return { data: '2026-11-26', vagao: 'GDT 123456-7', responsavelPatio: 'Rafael Bley', linhas };
}

describe('chegadaVagaoSchema', () => {
  it('aceita um vagão com uma linha válida', () => {
    expect(chegadaVagaoSchema.safeParse(valido()).success).toBe(true);
  });

  it('rejeita linha sem dizer se é lisa ou tala', () => {
    const r = chegadaVagaoSchema.safeParse(valido([{ perfil: 'TR68', marca: 'PANGANG', barras: 36 }]));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain('Escolha se é barra lisa ou tala.');
  });

  it('rejeita zero barras', () => {
    expect(chegadaVagaoSchema.safeParse(valido([{ perfil: 'TR68', marca: 'PANGANG', formaNovo: 'TALA', barras: 0 }])).success).toBe(false);
  });

  it('rejeita vagão sem nenhuma linha', () => {
    expect(chegadaVagaoSchema.safeParse(valido([])).success).toBe(false);
  });

  it('exige a identificação do vagão', () => {
    expect(chegadaVagaoSchema.safeParse({ ...valido(), vagao: '  ' }).success).toBe(false);
  });

  it('marca Outros exige o nome do fabricante', () => {
    expect(chegadaVagaoSchema.safeParse(valido([{ perfil: 'TR60', marca: 'OUTROS', formaNovo: 'LISA', barras: 2 }])).success).toBe(false);
  });
});
