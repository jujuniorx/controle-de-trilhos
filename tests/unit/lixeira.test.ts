import { describe, it, expect, vi } from 'vitest';

// Só testa funções puras; o banco não entra.
vi.mock('@/lib/db', () => ({ prisma: {} }));

import { reviverDatas, rotuloDaMovimentacao } from '@/lib/services/lixeira';

describe('lixeira — reviverDatas', () => {
  it('volta as datas de texto ISO para Date em qualquer profundidade e não mexe no resto', () => {
    const json = JSON.parse(
      JSON.stringify({
        id: 'a',
        createdAt: new Date('2026-10-14T10:00:00.000Z'),
        dataMovimentacao: new Date('2026-10-08T00:00:00.000Z'),
        conferidoEm: null,
        numeroDocumento: '2026-10-08T00:00:00.000Z', // texto comum que parece data NÃO é campo de data
        grupos: [{ metrosTotal: '24.30', medicoes: [{ comprimento: '12.15', quantidade: 2 }] }],
        historico: [{ timestamp: new Date('2026-10-14T11:00:00.000Z'), acao: 'EDICAO' }],
      }),
    );
    const r = reviverDatas(json);
    expect(r.createdAt).toBeInstanceOf(Date);
    expect(r.dataMovimentacao).toBeInstanceOf(Date);
    expect(r.dataMovimentacao.toISOString()).toBe('2026-10-08T00:00:00.000Z');
    expect(r.conferidoEm).toBeNull();
    expect(r.historico[0].timestamp).toBeInstanceOf(Date);
    expect(r.grupos[0].metrosTotal).toBe('24.30'); // Decimal continua texto (o Prisma aceita)
    expect(r.grupos[0].medicoes[0].quantidade).toBe(2);
  });
});

describe('lixeira — rotuloDaMovimentacao', () => {
  it('mostra NF, local padronizado e data', () => {
    expect(
      rotuloDaMovimentacao({
        id: 'x',
        numeroDocumento: '347212-1',
        origem: null,
        destino: 'Cruzeiro',
        dataMovimentacao: new Date('2026-10-08T00:00:00.000Z'),
      }),
    ).toBe('NF 347212-1 · CRUZEIRO · 08/10/2026');
  });

  it('sem nada reconhecível cai para o id', () => {
    expect(
      rotuloDaMovimentacao({ id: 'abc', numeroDocumento: null, origem: null, destino: null, dataMovimentacao: null }),
    ).toBe('abc');
  });
});
