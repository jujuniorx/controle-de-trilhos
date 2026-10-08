import { describe, it, expect } from 'vitest';
import { resumoRelatorio } from '@/lib/services/relatorio';
import type { MovimentacaoRelatorio } from '@/lib/services/relatorio';

function medicao(quantidade: number) {
  return { quantidade };
}

function grupo(overrides: Record<string, unknown> = {}) {
  return {
    tipoMaterial: 'REEMPREGO',
    metrosTotal: 10,
    pesoCalculado: null,
    pesoInformado: null,
    medicoes: [medicao(1)],
    ...overrides,
  };
}

function mov(overrides: Record<string, unknown> = {}) {
  return { tipo: 'RECEBIMENTO', pesoSucataReal: null, grupos: [grupo()], ...overrides } as unknown as MovimentacaoRelatorio;
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
      mov({ grupos: [grupo({ tipoMaterial: 'NOVO', pesoCalculado: 2.2 }), grupo({ tipoMaterial: 'REEMPREGO', pesoCalculado: 1.1 })] }),
    ];
    expect(resumoRelatorio(movs).toneladas).toBe(3.3);
  });

  it('Remetido: soma pesoInformado quando presente, senão a estimativa (pesoCalculado), por grupo — qualquer material', () => {
    const movs = [
      mov({
        tipo: 'REMETIDO',
        grupos: [grupo({ tipoMaterial: 'SUCATA', pesoInformado: 2 }), grupo({ tipoMaterial: 'SUCATA', pesoInformado: null, pesoCalculado: 0.5 })],
      }),
    ];
    expect(resumoRelatorio(movs).toneladas).toBe(2.5);
  });

  it('Recebimento com sucata PENDENTE: soma a estimativa (pesoCalculado) dos grupos SUCATA — "a confirmar"', () => {
    const movs = [
      mov({
        pesoSucataReal: null,
        grupos: [
          grupo({ tipoMaterial: 'REEMPREGO', pesoCalculado: 1 }),
          grupo({ tipoMaterial: 'SUCATA', pesoCalculado: 5.203 }),
        ],
      }),
    ];
    expect(resumoRelatorio(movs).toneladas).toBe(6.203);
  });

  it('REGRESSÃO (Task 7): Recebimento com sucata CONFERIDA não soma a estimativa do grupo e o peso real ao mesmo tempo', () => {
    const movs = [
      mov({
        pesoSucataReal: 4.5,
        grupos: [
          grupo({ tipoMaterial: 'REEMPREGO', pesoCalculado: 1 }),
          // pesoCalculado da sucata continua gravado no banco (nunca é limpo) —
          // mesmo assim não pode ser somado de novo depois da conferência.
          grupo({ tipoMaterial: 'SUCATA', pesoCalculado: 5.203 }),
        ],
      }),
    ];
    expect(resumoRelatorio(movs).toneladas).toBe(5.5); // 1 (reemprego) + 4.5 (peso real) — nunca 10.703
  });

  it('não soma nada de peso quando não há nenhum dado (tudo nulo)', () => {
    const movs = [mov({ pesoSucataReal: null, grupos: [grupo({ tipoMaterial: 'SUCATA', pesoCalculado: null, pesoInformado: null })] })];
    expect(resumoRelatorio(movs).toneladas).toBe(0);
  });

  it('retorna tudo zerado para lista vazia', () => {
    const resumo = resumoRelatorio([]);
    expect(resumo).toEqual({ carregamentos: 0, pecas: 0, metros: 0, toneladas: 0 });
  });

  it('valida o recebimento de referência completo (Task 12): 51 barras, 499,29 m, 30,700 t', () => {
    const movs = [
      mov({
        pesoSucataReal: null, // ainda não conferido — soma as 3 estimativas de sucata
        grupos: [
          grupo({ tipoMaterial: 'REEMPREGO', metrosTotal: 165.43, pesoCalculado: 9.926, medicoes: [medicao(15)] }),
          grupo({ tipoMaterial: 'REEMPREGO', metrosTotal: 9.63, pesoCalculado: 0.578, medicoes: [medicao(1)] }),
          grupo({ tipoMaterial: 'REEMPREGO', metrosTotal: 20.92, pesoCalculado: 1.423, medicoes: [medicao(2)] }),
          grupo({ tipoMaterial: 'REEMPREGO', metrosTotal: 9.98, pesoCalculado: 0.679, medicoes: [medicao(1)] }),
          grupo({ tipoMaterial: 'SUCATA', metrosTotal: 76.52, pesoCalculado: 5.203, medicoes: [medicao(9)] }),
          grupo({ tipoMaterial: 'SUCATA', metrosTotal: 208.91, pesoCalculado: 12.535, medicoes: [medicao(22)] }),
          grupo({ tipoMaterial: 'SUCATA', metrosTotal: 7.9, pesoCalculado: 0.356, medicoes: [medicao(1)] }),
        ],
      }),
    ];
    const resumo = resumoRelatorio(movs);
    expect(resumo.pecas).toBe(51);
    expect(resumo.metros).toBe(499.29);
    expect(resumo.toneladas).toBe(30.7);
  });
});
