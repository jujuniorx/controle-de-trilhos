import { describe, it, expect } from 'vitest';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';

const uuid = () => crypto.randomUUID();

function dadosValidos() {
  return {
    data: '2026-09-20',
    numeroDocumento: '123456',
    origem: 'Rondonópolis',
    placaCavalo: 'ABC1D23',
    placaCarreta: 'XYZ9E88',
    responsavelPatio: 'Rafael Bley',
  };
}

describe('recebimentoCaminhaoSchema', () => {
  it('aceita um recebimento válido com grupo NOVO sem fabricante', () => {
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados: dadosValidos(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.73 }],
        },
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('rejeita placa fora do padrão', () => {
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados: { ...dadosValidos(), placaCavalo: '1234567' },
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.73 }],
        },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it('exige classificação G1/G2/G3 em grupo REEMPREGO', () => {
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados: dadosValidos(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR68',
          tipoMaterial: 'REEMPREGO',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 12 }],
        },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it('rejeita medição de REEMPREGO abaixo de 7 metros', () => {
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados: dadosValidos(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR68',
          tipoMaterial: 'REEMPREGO',
          classificacao: 'G1',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 6.99 }],
        },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it('exige classificacaoSC em toda medição de grupo SUCATA', () => {
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados: dadosValidos(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR57',
          tipoMaterial: 'SUCATA',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1 }],
        },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it('aceita SUCATA quando toda medição informa SC1/SC2/SC3', () => {
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados: dadosValidos(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR57',
          tipoMaterial: 'SUCATA',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' }],
        },
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('normaliza o comprimento para 2 casas decimais', () => {
    const resultado = recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      dados: dadosValidos(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.7345 }],
        },
      ],
    });
    expect(resultado.grupos[0].medicoes[0].comprimento).toBe(8.73);
  });

  it('não impõe limite máximo de comprimento', () => {
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados: dadosValidos(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 45.5 }],
        },
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('rejeita recebimento sem nenhum grupo', () => {
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados: dadosValidos(),
      grupos: [],
    });
    expect(resultado.success).toBe(false);
  });

  it('aceita placaCarreta ausente quando placaCavalo está presente', () => {
    const dados = { ...dadosValidos(), placaCarreta: undefined };
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados,
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.73 }],
        },
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('rejeita quando nenhuma das duas placas está presente', () => {
    const dados = { ...dadosValidos(), placaCavalo: undefined, placaCarreta: undefined };
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados,
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.73 }],
        },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it('aceita transportadora ausente', () => {
    const dados = { ...dadosValidos(), transportadora: undefined };
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados,
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.73 }],
        },
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('aceita transportadora presente', () => {
    const dados = { ...dadosValidos(), transportadora: 'Translog Transportes' };
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados,
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.73 }],
        },
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('aceita marca NIPPON sem fabricanteOutro em grupo NOVO', () => {
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados: dadosValidos(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.73 }],
        },
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('rejeita grupo NOVO sem marca (obrigatória — Bloco 1.5)', () => {
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados: dadosValidos(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.73 }],
        },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it('rejeita marca OUTROS sem fabricanteOutro em grupo NOVO', () => {
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados: dadosValidos(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'OUTROS',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.73 }],
        },
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it('rejeita fabricanteOutro presente quando marca é NIPPON', () => {
    const resultado = recebimentoCaminhaoSchema.safeParse({
      clientId: uuid(),
      dados: dadosValidos(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          fabricanteOutro: 'Outro fabricante qualquer',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.73 }],
        },
      ],
    });
    expect(resultado.success).toBe(false);
  });
});
