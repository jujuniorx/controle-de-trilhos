import { describe, it, expect } from 'vitest';
import { validarArquivo, sanitizarNomeArquivo, TAMANHO_MAXIMO_BYTES } from '@/lib/services/documentoPesagem';

const PDF = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.from('-1.4 conteúdo de teste')]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('conteúdo de teste')]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('conteúdo de teste')]);
const TEXTO_DISFARCADO_DE_PDF = Buffer.from('isto não é um pdf de verdade');

describe('validarArquivo', () => {
  it('1. aceita PDF, JPG e PNG válidos', () => {
    expect(validarArquivo({ nomeOriginal: 'nota.pdf', contentType: 'application/pdf', bytes: PDF })).toBeNull();
    expect(validarArquivo({ nomeOriginal: 'foto.jpg', contentType: 'image/jpeg', bytes: JPEG })).toBeNull();
    expect(validarArquivo({ nomeOriginal: 'foto.png', contentType: 'image/png', bytes: PNG })).toBeNull();
  });

  it('2. rejeita extensão/tipo não permitido', () => {
    const erro = validarArquivo({ nomeOriginal: 'planilha.xlsx', contentType: 'application/vnd.ms-excel', bytes: PDF });
    expect(erro).toMatch(/não permitido/i);
  });

  it('rejeita quando o content-type não corresponde à extensão declarada', () => {
    const erro = validarArquivo({ nomeOriginal: 'nota.pdf', contentType: 'image/png', bytes: PDF });
    expect(erro).toMatch(/não corresponde/i);
  });

  it('rejeita conteúdo cujo início não corresponde à assinatura do formato (renomear .txt para .pdf não passa)', () => {
    const erro = validarArquivo({
      nomeOriginal: 'nota.pdf',
      contentType: 'application/pdf',
      bytes: TEXTO_DISFARCADO_DE_PDF,
    });
    expect(erro).toMatch(/conteúdo do arquivo não corresponde/i);
  });

  it('3. rejeita arquivo acima do limite de tamanho', () => {
    const grande = Buffer.concat([PDF, Buffer.alloc(TAMANHO_MAXIMO_BYTES)]);
    const erro = validarArquivo({ nomeOriginal: 'nota.pdf', contentType: 'application/pdf', bytes: grande });
    expect(erro).toMatch(/maior que/i);
  });

  it('rejeita arquivo vazio', () => {
    const erro = validarArquivo({ nomeOriginal: 'nota.pdf', contentType: 'application/pdf', bytes: Buffer.alloc(0) });
    expect(erro).toMatch(/nenhum arquivo/i);
  });
});

describe('sanitizarNomeArquivo', () => {
  it('remove acentos e caracteres fora de um charset seguro', () => {
    expect(sanitizarNomeArquivo('relatório de pesagem (2026).pdf')).toBe('relatorio_de_pesagem__2026_.pdf');
  });

  it('remove separadores de caminho, evitando path traversal', () => {
    expect(sanitizarNomeArquivo('../../etc/passwd')).not.toContain('/');
    expect(sanitizarNomeArquivo('..\\..\\config.pdf')).not.toContain('\\');
  });

  it('nunca retorna vazio', () => {
    expect(sanitizarNomeArquivo('')).toBe('arquivo');
  });
});
