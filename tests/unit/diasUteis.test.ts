import { describe, expect, it } from 'vitest';
import { conjuntoFeriados, diasUteisNaUsina, ehDiaUtil, somarDias } from '@/lib/usina/diasUteis';

const feriados = conjuntoFeriados();

describe('diasUteisNaUsina', () => {
  it('conta só dias úteis, sem sábado e domingo', () => {
    // 2026-10-05 é segunda. Segunda a sexta = 5 dias úteis, partida no sábado 10-10.
    expect(diasUteisNaUsina('2026-10-05', '2026-10-10', feriados)).toBe(5);
  });

  it('não conta feriado', () => {
    // 2026-10-12 é segunda e feriado (Nossa Senhora Aparecida). Chegada na sexta 10-09, partida na quarta 10-14:
    // sexta (útil), sábado, domingo, segunda feriado, terça (útil) = 2
    expect(diasUteisNaUsina('2026-10-09', '2026-10-14', feriados)).toBe(2);
  });

  it('chegada e partida no mesmo dia dá zero', () => {
    expect(diasUteisNaUsina('2026-10-07', '2026-10-07', feriados)).toBe(0);
  });

  it('retorna null quando falta data ou a partida é antes da chegada', () => {
    expect(diasUteisNaUsina(null, '2026-10-07', feriados)).toBeNull();
    expect(diasUteisNaUsina('2026-10-07', undefined, feriados)).toBeNull();
    expect(diasUteisNaUsina('2026-10-07', '2026-10-01', feriados)).toBeNull();
  });
});

describe('ehDiaUtil e somarDias', () => {
  it('reconhece fim de semana e feriado', () => {
    expect(ehDiaUtil('2026-10-17', feriados)).toBe(false); // sábado
    expect(ehDiaUtil('2026-10-12', feriados)).toBe(false); // feriado
    expect(ehDiaUtil('2026-10-13', feriados)).toBe(true); // terça
  });

  it('soma dias atravessando o fim do mês sem depender do fuso', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
  });
});
