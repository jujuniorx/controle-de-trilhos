import { describe, it, expect } from 'vitest';
import { gerarFichaPortariaPdf, nomeArquivoFicha, type FichaPortaria } from '@/lib/pdf/fichaPortaria';
import { quebrarLinhas } from '@/lib/pdf/simples';
import { formatarCpf, formatarTelefone } from '@/lib/domain/portaria';

const ficha: FichaPortaria = {
  estado: 'LIBERADA',
  destino: 'Pindorama',
  origem: 'Ponta Grossa',
  reservaPedido: null,
  numeroDocumento: null,
  tipoRemetido: 'VENDA',
  materialPrevisto: 'Trilho TR-57 (acentuação: ção, é, ã)',
  transportadora: 'Transportes (Silva) \\ & Filhos',
  motoristaNome: 'José da Conceição',
  motoristaCpf: '52998224725',
  motoristaTelefone: '14998765432',
  placaCarreta: 'FVB2B28',
  placaCavalo: 'EHJ8H61',
  capacidadeCarga: 32.5,
  carretaLiberadaEm: new Date('2026-10-15T14:30:00Z'),
  carretaLiberadaPor: 'Rui',
};

describe('ficha da Portaria em PDF', () => {
  it('gera um PDF válido (cabeçalho, xref e fim de arquivo)', () => {
    const texto = gerarFichaPortariaPdf(ficha, new Date('2026-10-15T14:31:00Z')).toString('latin1');
    expect(texto.startsWith('%PDF-1.4')).toBe(true);
    expect(texto.includes('startxref')).toBe(true);
    expect(texto.trimEnd().endsWith('%%EOF')).toBe(true);
  });
  it('traz os dados preenchidos, formatados, e nenhuma medição', () => {
    const texto = gerarFichaPortariaPdf(ficha).toString('latin1');
    for (const trecho of ['FVB2B28', 'EHJ8H61', '529.982.247-25', '\\(14\\) 99876-5432', 'PINDORAMA', 'Jos\xe9 da Concei\xe7\xe3o', '32,5 t', 'Liberada em 15/10/2026, 11:30']) {
      expect(texto.includes(trecho)).toBe(true);
    }
    expect(texto.toLowerCase().includes('metros')).toBe(false);
  });
  it('escapa parênteses e barra no texto', () => {
    const texto = gerarFichaPortariaPdf(ficha).toString('latin1');
    expect(texto.includes('Transportes \\(Silva\\) \\\\ & Filhos')).toBe(true);
  });
  it('funciona com tudo em branco', () => {
    const vazio: FichaPortaria = { ...ficha, estado: 'MEDINDO', carretaLiberadaEm: null, carretaLiberadaPor: null, placaCarreta: null, placaCavalo: null, capacidadeCarga: null, motoristaCpf: null, motoristaTelefone: null, motoristaNome: null, transportadora: null, materialPrevisto: null, origem: null, destino: null, tipoRemetido: null };
    expect(gerarFichaPortariaPdf(vazio).length > 500).toBe(true);
    expect(nomeArquivoFicha(vazio)).toBe('ficha-portaria.pdf');
  });
  it('nome do arquivo usa a placa da carreta (ou do cavalo)', () => {
    expect(nomeArquivoFicha(ficha)).toBe('ficha-portaria-FVB2B28.pdf');
    expect(nomeArquivoFicha({ placaCarreta: null, placaCavalo: 'EHJ8H61' })).toBe('ficha-portaria-EHJ8H61.pdf');
  });
});

describe('quebrarLinhas e formatos', () => {
  it('quebra por palavras e corta palavra gigante', () => {
    const linhas = quebrarLinhas('uma frase bem comprida para quebrar em varias linhas', 13, 120, 'negrito');
    expect(linhas.length > 1).toBe(true);
    expect(quebrarLinhas('A'.repeat(100), 13, 120).every((l) => l.length <= 20)).toBe(true);
  });
  it('formata CPF e telefone', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
    expect(formatarTelefone('1432345678')).toBe('(14) 3234-5678');
  });
});
