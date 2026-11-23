import { describe, it, expect } from 'vitest';
import { eixoSerra, montarRelatorioSerra, periodoDosMeses, type LinhaComposicao } from '@/lib/domain/relatorioSerra';

// Os dados do primeiro "Trilhos 2026" (atualizado em 13/11/2026): agosto lançado como total no dia 31, setembro só
// no relatório anterior (no sistema os dias de setembro estão vazios), outubro e novembro dia a dia.
const linhas: LinhaComposicao[] = [
  { data: '2026-08-31', ativo: 'W61', barras: 456 },
  { data: '2026-09-29', ativo: 'W61', barras: null },
  { data: '2026-10-10', ativo: 'W61', barras: 499 },
  { data: '2026-10-20', ativo: 'W62', barras: 20 },
  { data: '2026-11-05', ativo: 'W61', barras: 133 },
  { data: '2026-11-10', ativo: 'W62', barras: 112 },
  { data: '2026-11-18', ativo: 'W61', barras: 65 }, // depois do corte de 13/11
];

describe('relatório da serra', () => {
  it('reproduz o relatório de 13/11/2026', () => {
    const r = montarRelatorioSerra(linhas, '2026-11-13');
    expect(r.meses.map((m) => [m.rotulo, m.w61, m.w62])).toEqual([
      ['Ago', 456, 0],
      ['Set', 448, 0],
      ['Out', 499, 20],
      ['Nov', 133, 112],
    ]);
    expect(r.metros.w61).toBe(16128);
    expect(r.metros.w62).toBe(1386);
    expect(r.metros.total).toBe(17514);
    expect(r.pendenteM).toBe(30111);
    expect(r.percentualMeta).toBeCloseTo(36.775, 2);
    expect(r.periodo).toEqual({ w61: 'AGO A NOV', w62: 'OUT E NOV' });
    expect(r.usouBase).toBe(true);
    expect(r.parcialAte).toBe('novembro até 13/11');
  });

  it('o mês do sistema vence a base do relatório anterior, e mês fechado não tem "até"', () => {
    const r = montarRelatorioSerra([...linhas, { data: '2026-09-15', ativo: 'W61', barras: 450 }], '2026-11-30');
    expect(r.meses[1].w61).toBe(450);
    expect(r.meses[3].w61).toBe(198);
    expect(r.parcialAte).toBeNull();
  });

  it('período e eixo', () => {
    expect(periodoDosMeses(['2026-11'])).toBe('NOV');
    expect(eixoSerra(499)).toEqual({ max: 600, passo: 100 });
  });
});
