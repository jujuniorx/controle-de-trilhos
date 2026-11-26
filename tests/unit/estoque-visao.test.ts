import { describe, expect, it } from 'vitest';
import { SALDO_INICIAL_2026 } from '@/lib/estoque/saldoInicial2026';
import { somarSaldos } from '@/lib/estoque/trilhos';
import { barrasPorClasse, cartaoPerfil, conferenciaSap, outrosNovo, tabelaNovo } from '@/lib/estoque/visao';

const saldos = somarSaldos(SALDO_INICIAL_2026.map((l) => ({ ...l, data: '2026-11-25', origemTipo: 'SALDO_INICIAL' as const, origemId: null, descricao: '' })));

describe('cartaoPerfil (resumo)', () => {
  it('TR68: 95 TLS prontos e mais 185 que dá para formar', () => {
    const c = cartaoPerfil(saldos, 'TR68');
    expect(c.tlsProntos).toBe(95);
    expect(c.totalPossiveis).toBe(185);
    expect(c.metros).toBeCloseTo(114434.63, 2);
    const nippon = c.possiveis.find((p) => p.fabricante === 'NIPPON');
    expect(nippon).toMatchObject({ tls: 0, lisasBarras: 0, talasBarras: 337 });
    expect(c.notas.NIPPON).toBe('Sem barra lisa. 337 talas paradas.');
  });
  it('TR60: 52 TLS prontos e mais 268', () => {
    const c = cartaoPerfil(saldos, 'TR60');
    expect(c.tlsProntos).toBe(52);
    expect(c.totalPossiveis).toBe(268);
    expect(c.notas.PANGANG).toBe('Falta tala: sobram 737 lisas.');
    expect(c.trava).toBe('lisa no Nippon; tala no Pangang e no Evraz');
  });
});

describe('outrosNovo', () => {
  it('lista o que não entra nos cartões de solda', () => {
    const o = outrosNovo(saldos, ['TR68', 'TR60']);
    expect(o).toEqual([
      { rotulo: 'UIC60', metros: 796.47 },
      { rotulo: 'Barras de 21 m', metros: 1293 },
      { rotulo: 'Torcido', metros: 504 },
      { rotulo: 'Curtas 12 m', metros: 336 },
      { rotulo: 'Menores de 12 m', metros: 1881.63 },
    ]);
  });
});

describe('barrasPorClasse', () => {
  it('reemprego por perfil com G1, G2 e G3, do maior para o menor', () => {
    const r = barrasPorClasse(saldos, 'REEMPREGO');
    expect(r[0]).toMatchObject({ perfil: 'TR60', metros: 21567.17 });
    expect(r[0]!.partes).toEqual([
      { classe: 'G1', metros: 2039.45 },
      { classe: 'G2', metros: 15558.76 },
      { classe: 'G3', metros: 3968.96 },
    ]);
  });
  it('sucata ordenada por toneladas, com desgaste', () => {
    const r = barrasPorClasse(saldos, 'SUCATA');
    expect(r[0]).toMatchObject({ perfil: 'TR60' });
    expect(r[0]!.toneladas).toBeCloseTo(1588.59, 1);
    expect(r.reduce((t, x) => t + x.toneladas, 0)).toBeCloseTo(3595.4, 0);
  });
});

describe('conferenciaSap', () => {
  const sap = { TLS_TR60: 973.44, TLS_TR68: 2015.52, BARRAS_TR60: 6687.119, BARRAS_TR68: 6996.857 };
  it('TLS bate quando o equivalente é o mesmo número de TLS', () => {
    const r = conferenciaSap(saldos, sap);
    expect(r.find((x) => x.item === 'TLS_TR60')).toMatchObject({ situacao: 'bate', equivalente: 52, sistemaUnidades: 52 });
  });
  it('barras mostram a diferença em toneladas', () => {
    const b = conferenciaSap(saldos, sap).find((x) => x.item === 'BARRAS_TR60')!;
    expect(b.situacao).toBe('diferenca');
    expect(b.diferenca).toBeCloseTo(1967.04, 2);
  });
  it('sem valor do SAP fica "sem SAP"', () => {
    expect(conferenciaSap(saldos, {}).find((x) => x.item === 'BARRAS_UIC60')).toMatchObject({ situacao: 'sem-sap' });
  });
});

describe('tabelaNovo (detalhado)', () => {
  it('subtotal do TR60 com as colunas da planilha', () => {
    const tr60 = tabelaNovo(saldos).find((g) => g.perfil === 'TR60')!;
    expect(tr60.total).toMatchObject({ tlsUn: 52, tlsM: 16224, lisa: 96032, tala: 48192, curta12: 12, menor12: 0, curtos: 144236, geral: 160460 });
    expect(tr60.linhas.map((l) => [l.fabricante, l.classe])).toContainEqual(['NIPPON', '21M']);
  });
});
