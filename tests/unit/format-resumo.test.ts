import { describe, it, expect } from 'vitest';
import { fmtToneladas, fmtInteiro } from '@/lib/format';
import { textoAuditoria } from '@/lib/ui/textoAuditoria';

describe('fmtToneladas', () => {
  it('mostra totais com 1 casa, sem parecer milhão', () => {
    expect(fmtToneladas(1239.436)).toBe('1.239,4');
    expect(fmtToneladas(31.18)).toBe('31,2');
    expect(fmtToneladas(0)).toBe('0,0');
  });
});

describe('fmtInteiro', () => {
  it('usa ponto de milhar', () => {
    expect(fmtInteiro(1000)).toBe('1.000');
    expect(fmtInteiro(842)).toBe('842');
    expect(fmtInteiro(1234567.6)).toBe('1.234.568');
    expect(fmtInteiro(-2500)).toBe('-2.500');
  });
});

describe('textoAuditoria', () => {
  it('reescreve o formato antigo da exclusão', () => {
    expect(textoAuditoria('Remetido EVANGELISTA-SP (vai para a lixeira). Motivo: ja saiu')).toBe('Remetido EVANGELISTA-SP foi para a Lixeira · Motivo: “ja saiu”');
  });
  it('não mexe em outros textos', () => {
    expect(textoAuditoria('Usuário criado')).toBe('Usuário criado');
  });
});
