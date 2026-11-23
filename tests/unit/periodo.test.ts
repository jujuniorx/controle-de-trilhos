import { describe, expect, it } from 'vitest';
import { inicioDaSemana, intervaloDoPeriodo, ultimoFimDeSemana, desdeValido, diasDaFaixa, rotuloFaixaCurta, rotuloFaixaLonga, rotuloPeriodo, linhasPorDia } from '@/lib/usina/periodo';

describe('períodos do relatório', () => {
  it('semana começa na segunda e termina no domingo', () => {
    // 2026-10-16 é sexta
    expect(inicioDaSemana('2026-10-16')).toBe('2026-10-12');
    expect(intervaloDoPeriodo('semana', '2026-10-16')).toEqual({ inicio: '2026-10-12', fim: '2026-10-18' });
  });
  it('domingo pertence à semana que começou na segunda anterior', () => {
    expect(inicioDaSemana('2026-10-18')).toBe('2026-10-12');
  });
  it('mês vai do dia 1 ao último dia (inclusive fevereiro)', () => {
    expect(intervaloDoPeriodo('mes', '2026-10-16')).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' });
    expect(intervaloDoPeriodo('mes', '2028-02-10')).toEqual({ inicio: '2028-02-01', fim: '2028-02-29' });
  });
  it('dia é o próprio dia', () => {
    expect(intervaloDoPeriodo('dia', '2026-10-16')).toEqual({ inicio: '2026-10-16', fim: '2026-10-16' });
  });
});

describe('relatório de vários dias (sexta a domingo)', () => {
  it('na segunda, o atalho pega sexta a domingo que acabou de passar', () => {
    // 2026-11-23 é segunda
    expect(ultimoFimDeSemana('2026-11-23')).toEqual({ desde: '2026-11-20', data: '2026-11-22' });
    // no domingo, o fim de semana anterior
    expect(ultimoFimDeSemana('2026-11-22')).toEqual({ desde: '2026-11-13', data: '2026-11-15' });
  });
  it('"desde" inválido, igual ou depois da data vira um dia só; no máximo 7 dias', () => {
    expect(desdeValido(undefined, '2026-11-22')).toBe('2026-11-22');
    expect(desdeValido('2026-11-23', '2026-11-22')).toBe('2026-11-22');
    expect(desdeValido('2026-11-20', '2026-11-22')).toBe('2026-11-20');
    expect(desdeValido('2026-11-01', '2026-11-22')).toBe('2026-11-16');
  });
  it('dias e rótulos da faixa', () => {
    expect(diasDaFaixa('2026-11-20', '2026-11-22')).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
    expect(rotuloFaixaCurta('2026-11-20', '2026-11-22')).toBe('Sex 20 a Dom 22/11');
    expect(rotuloFaixaCurta('2026-10-30', '2026-11-01')).toBe('Sex 30/10 a Dom 01/11');
    expect(rotuloFaixaLonga('2026-11-20', '2026-11-22')).toBe('Sexta, 20/11 a domingo, 22/11/2026');
    expect(rotuloPeriodo('2026-11-22', 'diario', '2026-11-20')).toEqual({ titulo: 'Período', valor: 'Sexta, 20/11 a domingo, 22/11/2026' });
  });
  it('observações com o dia na frente; o mesmo texto em dias seguidos vira uma faixa', () => {
    const dias = ['2026-11-20', '2026-11-21', '2026-11-22'];
    expect(
      linhasPorDia(
        [
          { data: '2026-11-20', chave: 'ALECIO', texto: 'Equipe 1 (ZWU): Deslocamento para km 91+600' },
          { data: '2026-11-21', chave: 'ALECIO', texto: 'Equipe 1 (ZWU): Folga' },
          { data: '2026-11-22', chave: 'ALECIO', texto: 'Equipe 1 (ZWU): Folga' },
          { data: '2026-11-20', chave: 'BRUNO', texto: 'Equipe 2 (ZEV): Embarcados W62' },
          { data: '2026-11-22', chave: 'BRUNO', texto: 'Equipe 2 (ZEV): Embarcados W62' },
          { data: '2026-11-21', chave: 'X', texto: '   ' },
        ],
        dias,
      ),
    ).toEqual([
      'Sex 20/11 · Equipe 1 (ZWU): Deslocamento para km 91+600',
      'Sex 20/11 · Equipe 2 (ZEV): Embarcados W62',
      'Sáb 21 a Dom 22/11 · Equipe 1 (ZWU): Folga',
      'Dom 22/11 · Equipe 2 (ZEV): Embarcados W62',
    ]);
  });
});
