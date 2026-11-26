import { describe, it, expect } from 'vitest';
import { lerCargasTrilheiro, linhasDoBo } from '@/lib/estoque/cargasTrilheiro';

const form = (campos: Record<string, string>) => ({ get: (k: string) => campos[k] ?? null });

describe('lerCargasTrilheiro', () => {
  it('lê 32 TR68 Pangang + 8 TR68 Nippon', () => {
    const r = lerCargasTrilheiro(form({ cargas_E40_n: '2', carga_E40_0_perfil: 'TR68', carga_E40_0_fab: 'PANGANG', carga_E40_0_qtd: '32', carga_E40_1_perfil: 'TR68', carga_E40_1_fab: 'NIPPON', carga_E40_1_qtd: '8' }), 'E40');
    expect(r).toEqual({ ok: true, linhas: [
      { perfil: 'TR68', reemprego: false, fabricante: 'PANGANG', quantidade: 32 },
      { perfil: 'TR68', reemprego: false, fabricante: 'NIPPON', quantidade: 8 },
    ] });
  });

  it('reemprego não tem fabricante', () => {
    const r = lerCargasTrilheiro(form({ cargas_E42_n: '1', carga_E42_0_perfil: 'TR57', carga_E42_0_fab: 'REEMPREGO', carga_E42_0_qtd: '40' }), 'E42');
    expect(r).toEqual({ ok: true, linhas: [{ perfil: 'TR57', reemprego: true, fabricante: null, quantidade: 40 }] });
  });

  it('linha toda vazia é ignorada', () => {
    expect(lerCargasTrilheiro(form({ cargas_E40_n: '1', carga_E40_0_perfil: 'TR68', carga_E40_0_fab: '', carga_E40_0_qtd: '' }), 'E40')).toEqual({ ok: true, linhas: [] });
  });

  it('sem fabricante e sem reemprego: erro', () => {
    const r = lerCargasTrilheiro(form({ cargas_E40_n: '1', carga_E40_0_perfil: 'TR68', carga_E40_0_fab: '', carga_E40_0_qtd: '20' }), 'E40');
    expect(r).toEqual({ ok: false, erro: 'E40: escolha o fabricante (ou Reemprego) dos TLS carregados.' });
  });

  it('quantidade fora de 1 a 60: erro', () => {
    for (const q of ['0', '61', '2,5', 'abc']) {
      const r = lerCargasTrilheiro(form({ cargas_E40_n: '1', carga_E40_0_perfil: 'TR68', carga_E40_0_fab: 'NIPPON', carga_E40_0_qtd: q }), 'E40');
      expect(r).toEqual({ ok: false, erro: 'E40: a quantidade de TLS é um número inteiro de 1 a 60.' });
    }
  });

  it('perfil desconhecido: erro', () => {
    const r = lerCargasTrilheiro(form({ cargas_E40_n: '1', carga_E40_0_perfil: 'XX', carga_E40_0_fab: 'NIPPON', carga_E40_0_qtd: '5' }), 'E40');
    expect(r.ok).toBe(false);
  });
});

describe('linhasDoBo', () => {
  const salvas = [{ perfil: 'TR68', reemprego: false, fabricante: 'PANGANG', quantidade: 40 }];
  it('mesmo B.O. em que foram salvas: mostra as linhas', () => {
    expect(linhasDoBo('2026-11-20', '2026-11-20', salvas)).toEqual(salvas);
  });
  it('B.O. novo (giro novo): começa vazio, para não descontar os mesmos TLS duas vezes', () => {
    expect(linhasDoBo('2026-11-27', '2026-11-20', salvas)).toEqual([]);
  });
});
