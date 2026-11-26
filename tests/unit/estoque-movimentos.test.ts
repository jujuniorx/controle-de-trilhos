import { describe, it, expect } from 'vitest';
import { agruparMovimentos } from '@/components/estoque/trilhos/UltimasMovimentacoes';
import type { Lancamento } from '@/lib/estoque/trilhos';

const p = { secao: 'NOVO' as const, perfil: 'TR68', fabricante: 'PANGANG' as const, classe: 'NORMAL' };
const tls = (data: string, origemId: string): Lancamento[] => [
  { ...p, tipo: 'TLS', data, metros: 312, unidades: 1, origemTipo: 'PRODUCAO', origemId, descricao: '' },
  { ...p, tipo: 'LISA', data, metros: -264, unidades: null, origemTipo: 'PRODUCAO', origemId, descricao: '' },
  { ...p, tipo: 'TALA', data, metros: -48, unidades: null, origemTipo: 'PRODUCAO', origemId, descricao: '' },
];

describe('agruparMovimentos', () => {
  const lanc: Lancamento[] = [
    ...tls('2026-11-25', '2026-11-25'),
    ...tls('2026-11-25', '2026-11-25'),
    ...tls('2026-11-25', '2026-11-25'),
    ...tls('2026-11-25', '2026-11-26'),
    ...tls('2026-11-26', '2026-11-26'),
    ...tls('2026-11-26', '2026-11-26'),
    { secao: 'REEMPREGO', perfil: 'TR60', tipo: 'BARRA', fabricante: null, classe: 'G2', data: '2026-11-25', metros: -121.1, unidades: null, origemTipo: 'REMETIDO', origemId: 'm1', descricao: 'Envio NF 87801-1 · ITIQUIRA' },
  ];
  const dias = agruparMovimentos(lanc);

  it('um bloco por dia, do mais novo para o mais antigo', () => {
    expect(dias.map((d) => d.data)).toEqual(['2026-11-26', '2026-11-25']);
  });

  it('a Produção do dia vira uma linha só, com o total somado', () => {
    const prod = dias[1]!.itens.find((i) => i.origemTipo === 'PRODUCAO')!;
    expect(prod.titulo).toBe('Produção');
    expect(prod.principal).toEqual([{ texto: '+4 TLS TR68 Pangang', sinal: 1 }]);
    expect(prod.consumo).toEqual([{ texto: '−1.056 m lisa', sinal: -1 }, { texto: '−192 m tala', sinal: -1 }]);
    expect(prod.nota).toBe('1 deles fechou em 26/11');
    expect(prod.href).toBe('/admin/producao?data=2026-11-25');
  });

  it('envio com o que saiu', () => {
    const env = dias[1]!.itens.find((i) => i.origemTipo === 'REMETIDO')!;
    expect(env.titulo).toBe('Envio NF 87801-1 · ITIQUIRA');
    expect(env.principal).toEqual([{ texto: '−121,10 m TR60 G2', sinal: -1 }]);
    expect(env.href).toBe('/admin/remetidos/m1');
  });

  it('limite conta linhas, não dias', () => {
    expect(agruparMovimentos(lanc, undefined, undefined, 2).flatMap((d) => d.itens)).toHaveLength(2);
  });
});
