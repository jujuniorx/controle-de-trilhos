import { describe, it, expect } from 'vitest';
import { saudacao, saudacaoCompleta, saudacaoRotativa } from '@/lib/saudacao';

// Horário de Brasília = UTC-03:00.
const em = (iso: string) => new Date(`${iso}-03:00`);

describe('saudacao (horário)', () => {
  it('madrugada, manhã, tarde e noite', () => {
    expect(saudacao(em('2026-10-15T05:00:00'))).toBe('Boa madrugada');
    expect(saudacao(em('2026-10-15T09:00:00'))).toBe('Bom dia');
    expect(saudacao(em('2026-10-15T14:00:00'))).toBe('Boa tarde');
    expect(saudacao(em('2026-10-15T20:00:00'))).toBe('Boa noite');
  });
});

describe('saudacaoCompleta (dia da semana)', () => {
  it('sexta, segunda e fim de semana mudam a frase', () => {
    expect(saudacaoCompleta(em('2026-10-16T12:00:00'))).toBe('Boa sexta'); // sexta
    expect(saudacaoCompleta(em('2026-10-19T09:00:00'))).toBe('Boa segunda'); // segunda
    expect(saudacaoCompleta(em('2026-10-17T10:00:00'))).toBe('Bom fim de semana'); // sábado
    expect(saudacaoCompleta(em('2026-10-18T10:00:00'))).toBe('Bom fim de semana'); // domingo
  });

  it('dias úteis do meio da semana seguem o horário', () => {
    expect(saudacaoCompleta(em('2026-10-15T09:00:00'))).toBe('Bom dia'); // quinta
    expect(saudacaoCompleta(em('2026-10-15T20:00:00'))).toBe('Boa noite');
  });
});

describe('saudacaoRotativa (revezamento)', () => {
  it('sexta revezando entre as frases de sexta', () => {
    expect(saudacaoRotativa(em('2026-10-16T12:00:00'), () => 0)).toBe('Boa sexta');
    expect(saudacaoRotativa(em('2026-10-16T12:00:00'), () => 0.5)).toBe('Feliz sexta-feira');
    expect(saudacaoRotativa(em('2026-10-16T12:00:00'), () => 0.999)).toBe('Chegamos na sexta');
  });
  it('manhã sorteia entre as frases de manhã', () => {
    expect(saudacaoRotativa(em('2026-10-15T09:00:00'), () => 0)).toBe('Bom dia');
    expect(saudacaoRotativa(em('2026-10-15T09:00:00'), () => 0.99)).toBe('Boa manhã de trabalho');
  });
});
