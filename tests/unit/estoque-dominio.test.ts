import { describe, it, expect } from 'vitest';
import {
  diasRestantes,
  escalaMetros,
  gomosAcesos,
  lerNumero,
  metrosTrilho,
  nomeItemTrilho,
  percentualDoMinimo,
  rotuloUnidade,
  situacaoCalibracao,
  situacaoNivel,
  toneladasTrilho,
} from '@/lib/domain/estoque';

describe('estoque: regras', () => {
  it('situação em relação ao mínimo', () => {
    expect(situacaoNivel(0, 10)).toBe('zerado');
    expect(situacaoNivel(5, 10)).toBe('baixo');
    expect(situacaoNivel(10, 10)).toBe('ok');
    expect(situacaoNivel(5, null)).toBe('semMinimo');
  });

  it('gomos vão até o dobro do mínimo', () => {
    expect(gomosAcesos(10, 10)).toBe(5);
    expect(gomosAcesos(40, 10)).toBe(10);
    expect(gomosAcesos(1, 100)).toBe(1);
    expect(gomosAcesos(0, 10)).toBe(0);
    expect(percentualDoMinimo(1380, 1500)).toBe(92);
  });

  it('calibração: vencida, vence em 30 dias e em dia', () => {
    expect(situacaoCalibracao(null, '2026-11-19')).toBe('nenhuma');
    expect(situacaoCalibracao('2026-10-31', '2026-11-19')).toBe('vencida');
    expect(situacaoCalibracao('2026-12-15', '2026-11-19')).toBe('vence');
    expect(situacaoCalibracao('2027-03-01', '2026-11-19')).toBe('emDia');
  });

  it('peso e metros dos trilhos pelo fator do perfil (t/m)', () => {
    expect(toneladasTrilho({ categoria: 'PERFIL', quantidade: 2460, fator: 0.068 })).toBeCloseTo(167.28);
    expect(toneladasTrilho({ categoria: 'LISA', quantidade: 48, fator: 0.068, comprimentoBarra: 12 })).toBeCloseTo(39.168);
    expect(toneladasTrilho({ categoria: 'TALA', quantidade: 340, fator: 0.068 })).toBeNull();
    expect(metrosTrilho({ categoria: 'LISA', quantidade: 48, comprimentoBarra: 12 })).toBe(576);
  });

  it('dias que ainda dá pelo consumo de 30 dias', () => {
    expect(diasRestantes(85, 60)).toBe(42);
    expect(diasRestantes(85, 0)).toBeNull();
  });

  it('lê números como a Portaria digita', () => {
    expect(lerNumero('1.200')).toBe(1200);
    expect(lerNumero('12,5')).toBe(12.5);
    expect(lerNumero('1.200,5')).toBe(1200.5);
    expect(lerNumero('12.5')).toBe(12.5);
    expect(lerNumero('')).toBeNull();
    expect(lerNumero('abc')).toBeNaN();
    expect(lerNumero('-3')).toBeNaN();
  });

  it('nome e unidade dos itens de Trilhos', () => {
    expect(nomeItemTrilho({ categoria: 'PERFIL', perfil: 'TR68' })).toBe('TR68');
    expect(nomeItemTrilho({ categoria: 'TALA', perfil: 'TR57', furos: 6 })).toBe('Tala TR57 · 6 furos');
    expect(nomeItemTrilho({ categoria: 'LISA', perfil: 'TR68', comprimentoBarra: 12 })).toBe('Barra lisa TR68 · 12 m');
    expect(rotuloUnidade('un', 'LISA', 48)).toBe('barras');
    expect(rotuloUnidade('par', 'TALA', 1)).toBe('par');
    expect(escalaMetros([2460, 1200])).toBe(2500);
    expect(escalaMetros([10])).toBe(1000);
  });
});
