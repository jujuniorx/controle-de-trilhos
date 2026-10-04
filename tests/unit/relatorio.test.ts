import { describe, it, expect } from 'vitest';
import { resumoRelatorio } from '@/lib/services/relatorio';
import type { MovimentacaoRelatorio } from '@/lib/services/relatorio';

function medicao(quantidade: number) {
  return { quantidade };
}

function grupo(overrides: Record<string, unknown> = {}) {
  return {
    metrosTotal: 10,
    pesoCalculado: null,
    pesoInformado: null,
    medicoes: [medicao(1)],
    ...overrides,
  };
}

function mov(overrides: Record<string, unknown> = {}) {
  return { pesoSucataReal: null, grupos: [grupo()], ...overrides } as unknown as MovimentacaoRelatorio;
}

describe('resumoRelatorio', () => {
  it('conta carregamentos, soma peças (quantidade das medições) e metros', () => {
    const movs = [
      mov({ grupos: [grupo({ metrosTotal: 10, medicoes: [medicao(2), medicao(1)] })] }),
      mov({ grupos: [grupo({ metrosTotal: 5, medicoes: [medicao(3)] })] }),
    ];
    const resumo = resumoRelatorio(movs);
    expect(resumo.carregamentos).toBe(2);
    expect(resumo.pecas).toBe(6);
    expect(resumo.metros).toBe(15);
  });

  it('soma pesoCalculado (Recebimento NOVO/REEMPREGO) e pesoInformado (Remetido) por grupo', () => {
    const movs = [
      mov({ grupos: [grupo({ pesoCalculado: 2.2 }), grupo({ pesoInformado: 1.1 })] }),
    ];
    expect(resumoRelatorio(movs).toneladas).toBe(3.3);
  });

  it('soma pesoSucataReal da Movimentacao (sucata de Recebimento, já conferida)', () => {
    const movs = [mov({ pesoSucataReal: 4.5, grupos: [grupo({ pesoCalculado: 1 })] })];
    expect(resumoRelatorio(movs).toneladas).toBe(5.5);
  });

  it('não soma nada de peso quando sucata de Recebimento ainda está pendente (pesoCalculado e pesoSucataReal nulos)', () => {
    const movs = [mov({ pesoSucataReal: null, grupos: [grupo({ pesoCalculado: null, pesoInformado: null })] })];
    expect(resumoRelatorio(movs).toneladas).toBe(0);
  });

  it('retorna tudo zerado para lista vazia', () => {
    const resumo = resumoRelatorio([]);
    expect(resumo).toEqual({ carregamentos: 0, pecas: 0, metros: 0, toneladas: 0 });
  });
});
