import { describe, expect, it } from 'vitest';
import { inicioDaSemana, intervaloDoPeriodo } from '@/lib/usina/periodo';

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
