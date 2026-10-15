import { describe, it, expect } from 'vitest';
import { montarDadosGraficos } from '@/lib/services/graficosRelatorio';
import { resumoRelatorio, type MovimentacaoRelatorio } from '@/lib/services/relatorio';

function mov(p: Record<string, unknown>): MovimentacaoRelatorio {
  return {
    id: Math.random().toString(),
    tipo: 'RECEBIMENTO',
    origem: null,
    destino: null,
    pesoSucataReal: null,
    dataMovimentacao: new Date('2026-10-05T00:00:00Z'),
    createdAt: new Date('2026-10-05T00:00:00Z'),
    grupos: [],
    ...p,
  } as unknown as MovimentacaoRelatorio;
}
const grupo = (perfil: string, peso: number, extra: object = {}) => ({
  id: perfil + peso, perfil, tipoMaterial: 'NOVO', pesoCalculado: peso, pesoInformado: null, metrosTotal: 10, medicoes: [], ...extra,
});

describe('montarDadosGraficos', () => {
  it('agrupa por semana, separa recebido/enviado e ranqueia origem, destino e perfil', () => {
    const movs = [
      mov({ origem: 'Evangelista', grupos: [grupo('TR68', 30), grupo('TR57', 10)] }),
      mov({ origem: 'Evangelista', grupos: [grupo('TR68', 5)] }),
      mov({ tipo: 'REMETIDO', destino: 'Ponta Grossa', grupos: [grupo('TR68', 20)] }),
      mov({ origem: 'Jales', dataMovimentacao: new Date('2026-10-13T00:00:00Z'), grupos: [grupo('TR57', 2)] }),
    ];
    const d = montarDadosGraficos(movs);
    expect(d.granularidade).toBe('semana');
    expect(d.serie).toHaveLength(2);
    expect(d.serie[0]).toMatchObject({ rotulo: '05/10', recebido: 45, enviado: 20 });
    expect(d.serie[1]).toMatchObject({ rotulo: '12/10', recebido: 2, enviado: 0 });
    // Origem e destino saem padronizados (maiúsculas), igual ao que é gravado.
    expect(d.origens[0]).toEqual({ rotulo: 'EVANGELISTA', valor: 45 });
    expect(d.destinos).toEqual([{ rotulo: 'PONTA GROSSA', valor: 20 }]);
    expect(d.perfis[0]).toEqual({ rotulo: 'TR68', valor: 55 });
    expect(d.materiais).toEqual([{ rotulo: 'Novo', valor: 67 }]);
  });

  it('usa meses quando o período é longo e o total dos perfis bate com o resumo (sucata com peso real)', () => {
    const movs = [
      mov({ grupos: [grupo('TR57', 8)] }),
      mov({
        dataMovimentacao: new Date('2026-05-02T00:00:00Z'),
        pesoSucataReal: 12 as never,
        grupos: [grupo('TR57', 99, { tipoMaterial: 'SUCATA' })],
      }),
    ];
    const d = montarDadosGraficos(movs);
    expect(d.granularidade).toBe('mes');
    expect(d.serie.map((p) => p.rotulo)).toEqual(['mai/26', 'out/26']);
    const totalPerfis = d.perfis.reduce((s, i) => s + i.valor, 0);
    expect(totalPerfis).toBeCloseTo(resumoRelatorio(movs).toneladas, 3);
  });

  it('junta perfis além das 5 maiores em "Outros"', () => {
    const perfis = ['TR22', 'TR32', 'TR37', 'TR40', 'TR45', 'TR50', 'TR54'];
    const d = montarDadosGraficos([mov({ grupos: perfis.map((p, i) => grupo(p, 100 - i * 10)) })]);
    expect(d.perfis).toHaveLength(6);
    // 5 maiores (100, 90, 80, 70, 60) + "Outros" = o resto (TR50 = 50 e TR54 = 40).
    expect(d.perfis[5]).toEqual({ rotulo: 'Outros', valor: 50 + 40 });
  });

  it('junta destinos escritos de formas diferentes numa entrada só ("Ponta Grossa" = "Ponta grossa")', () => {
    const movs = [
      mov({ tipo: 'REMETIDO', destino: 'Ponta Grossa', grupos: [grupo('TR68', 10)] }),
      mov({ tipo: 'REMETIDO', destino: 'Ponta grossa', grupos: [grupo('TR68', 5)] }),
      mov({ tipo: 'REMETIDO', destino: '  PONTA   GROSSA ', grupos: [grupo('TR68', 2)] }),
      mov({ tipo: 'REMETIDO', destino: 'Jales', grupos: [grupo('TR68', 1)] }),
    ];
    const d = montarDadosGraficos(movs);
    expect(d.destinos).toEqual([
      { rotulo: 'PONTA GROSSA', valor: 17 },
      { rotulo: 'JALES', valor: 1 },
    ]);
  });

  it('junta origens que só diferem por maiúsculas/acento e mostra a grafia acentuada', () => {
    const movs = [
      mov({ origem: 'Maringa', grupos: [grupo('TR57', 3)] }),
      mov({ origem: 'maringá', grupos: [grupo('TR57', 4)] }),
    ];
    const d = montarDadosGraficos(movs);
    expect(d.origens).toEqual([{ rotulo: 'MARINGÁ', valor: 7 }]);
  });

  it('sem movimentações devolve tudo vazio', () => {
    const d = montarDadosGraficos([]);
    expect(d.serie).toEqual([]);
    expect(d.origens).toEqual([]);
  });
});
