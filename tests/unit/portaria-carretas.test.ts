import { describe, expect, it } from 'vitest';
import { formatarCpfDigitado, novoEnvioPortariaSchema } from '@/lib/validation/portaria';
import { nfOpcional } from '@/lib/validation/recebimento';
import { motivoNaoPodeRegistrarChegada } from '@/lib/domain/portaria';

describe('CPF com traço automático', () => {
  it('põe o traço logo depois do 9º número', () => {
    expect(formatarCpfDigitado('45603560843')).toBe('456035608-43');
    expect(formatarCpfDigitado('456035608')).toBe('456035608');
    expect(formatarCpfDigitado('4560356084')).toBe('456035608-4');
  });
  it('ignora letras e limita a 11 números', () => {
    expect(formatarCpfDigitado('45a60.35608-4399')).toBe('456035608-43');
  });
});

describe('NF sempre opcional', () => {
  it('aceita campo vazio e NF válida, recusa NF com letra', () => {
    expect(nfOpcional.parse('')).toBeUndefined();
    expect(nfOpcional.parse('   ')).toBeUndefined();
    expect(nfOpcional.parse('087781-1')).toBe('087781-1');
    expect(() => nfOpcional.parse('12A')).toThrow();
  });
});

describe('Portaria: segunda carreta conta como placa', () => {
  it('registra a chegada só com a 2ª carreta', () => {
    const dados = { destino: 'Gaspar', placaCarreta2: 'ABC1D23' };
    const parsed = novoEnvioPortariaSchema.safeParse({ ...dados, placaCavalo: '', placaCarreta: '' });
    expect(parsed.success).toBe(true);
    expect(motivoNaoPodeRegistrarChegada({} as never, '', '', 'ABC1D23')).toBeNull();
  });
  it('limite e comprimento aceitam vírgula', () => {
    const r = novoEnvioPortariaSchema.parse({ destino: 'X', placaCavalo: 'ABC1D23', capacidadeCarga: '48', comprimentoCarreta: '15,5' });
    expect(r.capacidadeCarga).toBe(48);
    expect(r.comprimentoCarreta).toBe(15.5);
  });
});
