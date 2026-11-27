import { describe, expect, it } from 'vitest';
import { lerListaVagoes, lerNumeroBr, remetidoVagaoSchema, separarNfs } from '@/lib/validation/vagaoRemetido';

describe('separarNfs', () => {
  it('separa as notas do B.O. por barra, vírgula ou espaço, sem repetir', () => {
    expect(separarNfs('2100310798/2100310799')).toEqual(['2100310798', '2100310799']);
    expect(separarNfs(' 2100310801 , 2100310801; 2100310802 ')).toEqual(['2100310801', '2100310802']);
    expect(separarNfs('')).toEqual([]);
  });
});

describe('lerNumeroBr', () => {
  it('lê pesos e valores no jeito brasileiro', () => {
    expect(lerNumeroBr('64,90')).toBe(64.9);
    expect(lerNumeroBr('64.90')).toBe(64.9);
    expect(lerNumeroBr('1.189,65')).toBe(1189.65);
    expect(lerNumeroBr('R$ 1.063.017,60')).toBe(1063017.6);
    expect(lerNumeroBr('  ')).toBeNull();
    expect(lerNumeroBr('abc')).toBeNaN();
  });
});

describe('lerListaVagoes', () => {
  it('lê os vagões colados do B.O., com ou sem o número da linha', () => {
    const r = lerListaVagoes('1 PDR 332510-5 42,20 60,00\nPDT\t844028-0\t64,90\t86,90\n\nlixo');
    expect(r.vagoes).toEqual([
      { serie: 'PDR', numero: '332510-5', pesoLiquido: '42,20', pesoBruto: '60,00' },
      { serie: 'PDT', numero: '844028-0', pesoLiquido: '64,90', pesoBruto: '86,90' },
    ]);
    expect(r.naoLidas).toEqual(['lixo']);
  });
});

describe('remetidoVagaoSchema', () => {
  const base = {
    data: '2026-11-25',
    trilheiro: 'E42',
    nfs: ['2100310798'],
    destino: ' zxp ',
    tipoRemetido: 'TRANS',
    valorNf: 1063017.6,
    movimentaEstoque: false,
    linhas: [{ perfil: 'TR68', material: 'NOVO', marca: 'PANGANG', quantidade: 40 }],
    vagoes: [{ serie: 'pdt', numero: '844028-0', pesoLiquido: 64.9, pesoBruto: 86.9 }],
  };

  it('aceita o B.O. de 25/11 (40 TLS TR68 Pangang) e padroniza destino e série', () => {
    const r = remetidoVagaoSchema.parse(base);
    expect(r.destino).toBe('ZXP');
    expect(r.vagoes[0].serie).toBe('PDT');
  });

  it('TLS novo exige fabricante; reemprego não', () => {
    expect(remetidoVagaoSchema.safeParse({ ...base, linhas: [{ perfil: 'TR68', material: 'NOVO', quantidade: 40 }] }).success).toBe(false);
    expect(remetidoVagaoSchema.safeParse({ ...base, linhas: [{ perfil: 'TR60', material: 'REEMPREGO', quantidade: 13 }] }).success).toBe(true);
  });

  it('recusa perfil sem TLS, quantidade zero e peso inválido', () => {
    expect(remetidoVagaoSchema.safeParse({ ...base, linhas: [{ perfil: 'TR57', material: 'REEMPREGO', quantidade: 5 }] }).success).toBe(false);
    expect(remetidoVagaoSchema.safeParse({ ...base, linhas: [{ perfil: 'TR68', material: 'REEMPREGO', quantidade: 0 }] }).success).toBe(false);
    expect(remetidoVagaoSchema.safeParse({ ...base, vagoes: [{ ...base.vagoes[0], pesoLiquido: Number.NaN }] }).success).toBe(false);
  });
});
