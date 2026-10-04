import { describe, it, expect } from 'vitest';
import { preCadastroRemetidoSchema, confirmacaoRemetidoSchema } from '@/lib/validation/remetido';

const uuid = () => crypto.randomUUID();

function preCadastroValido() {
  return {
    tipoRemetido: 'VENDA',
    reservaPedido: 'PED-2026-001',
    destino: 'Usina Rondonópolis',
    numeroDocumento: undefined,
  };
}

function dadosConfirmacaoValidos() {
  return {
    data: '2026-10-04',
    numeroDocumento: '654321',
    placaCavalo: 'ABC1D23',
    placaCarreta: 'XYZ9E88',
    transportadora: 'Translog Transportes',
    responsavelPatio: 'Rafael Bley',
  };
}

function grupoValido(overrides: Record<string, unknown> = {}) {
  return {
    clientId: uuid(),
    perfil: 'TR22',
    tipoMaterial: 'NOVO',
    pesoInformado: 12.5,
    medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.73 }],
    ...overrides,
  };
}

describe('preCadastroRemetidoSchema', () => {
  it('aceita um pré-cadastro válido sem NF', () => {
    const resultado = preCadastroRemetidoSchema.safeParse(preCadastroValido());
    expect(resultado.success).toBe(true);
  });

  it('aceita um pré-cadastro com NF já conhecida', () => {
    const resultado = preCadastroRemetidoSchema.safeParse({ ...preCadastroValido(), numeroDocumento: '111222' });
    expect(resultado.success).toBe(true);
  });

  it('rejeita tipoRemetido ausente', () => {
    const { tipoRemetido, ...resto } = preCadastroValido();
    const resultado = preCadastroRemetidoSchema.safeParse(resto);
    expect(resultado.success).toBe(false);
  });

  it('rejeita destino vazio', () => {
    const resultado = preCadastroRemetidoSchema.safeParse({ ...preCadastroValido(), destino: '' });
    expect(resultado.success).toBe(false);
  });
});

describe('confirmacaoRemetidoSchema', () => {
  it('aceita uma confirmação válida com grupo NOVO', () => {
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados: dadosConfirmacaoValidos(),
      grupos: [grupoValido()],
    });
    expect(resultado.success).toBe(true);
  });

  it('aceita placaCarreta ausente quando placaCavalo está presente', () => {
    const dados = { ...dadosConfirmacaoValidos(), placaCarreta: undefined };
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados,
      grupos: [grupoValido()],
    });
    expect(resultado.success).toBe(true);
  });

  it('rejeita quando nenhuma das duas placas está presente', () => {
    const dados = { ...dadosConfirmacaoValidos(), placaCavalo: undefined, placaCarreta: undefined };
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados,
      grupos: [grupoValido()],
    });
    expect(resultado.success).toBe(false);
  });

  it('aceita numeroDocumento ausente (NF em aberto para o Administrativo completar)', () => {
    const dados = { ...dadosConfirmacaoValidos(), numeroDocumento: undefined };
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados,
      grupos: [grupoValido()],
    });
    expect(resultado.success).toBe(true);
  });

  it('rejeita grupo sem pesoInformado', () => {
    const grupo = grupoValido();
    delete (grupo as Record<string, unknown>).pesoInformado;
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados: dadosConfirmacaoValidos(),
      grupos: [grupo],
    });
    expect(resultado.success).toBe(false);
  });

  it('rejeita pesoInformado zero ou negativo', () => {
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados: dadosConfirmacaoValidos(),
      grupos: [grupoValido({ pesoInformado: 0 })],
    });
    expect(resultado.success).toBe(false);
  });

  it('aceita grupo REEMPREGO com tampao=true e classificacao G1', () => {
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados: dadosConfirmacaoValidos(),
      grupos: [
        grupoValido({
          tipoMaterial: 'REEMPREGO',
          classificacao: 'G1',
          tampao: true,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 7.5 }],
        }),
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('aceita grupo REEMPREGO com tampao=true e classificacao G2', () => {
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados: dadosConfirmacaoValidos(),
      grupos: [
        grupoValido({
          tipoMaterial: 'REEMPREGO',
          classificacao: 'G2',
          tampao: true,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 7.5 }],
        }),
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('rejeita grupo REEMPREGO com tampao=true e classificacao G3', () => {
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados: dadosConfirmacaoValidos(),
      grupos: [
        grupoValido({
          tipoMaterial: 'REEMPREGO',
          classificacao: 'G3',
          tampao: true,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 7.5 }],
        }),
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it('aceita grupo REEMPREGO normal (sem tampao) com classificacao G3', () => {
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados: dadosConfirmacaoValidos(),
      grupos: [
        grupoValido({
          tipoMaterial: 'REEMPREGO',
          classificacao: 'G3',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 7.5 }],
        }),
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('aceita grupo SUCATA com pesoInformado e classificacaoSC em toda medição', () => {
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados: dadosConfirmacaoValidos(),
      grupos: [
        grupoValido({
          tipoMaterial: 'SUCATA',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' }],
        }),
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('rejeita grupo SUCATA sem classificacaoSC em alguma medição', () => {
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados: dadosConfirmacaoValidos(),
      grupos: [
        grupoValido({
          tipoMaterial: 'SUCATA',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1 }],
        }),
      ],
    });
    expect(resultado.success).toBe(false);
  });

  it('rejeita grupo SUCATA sem pesoInformado', () => {
    const grupo = grupoValido({
      tipoMaterial: 'SUCATA',
      medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' }],
    });
    delete (grupo as Record<string, unknown>).pesoInformado;
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados: dadosConfirmacaoValidos(),
      grupos: [grupo],
    });
    expect(resultado.success).toBe(false);
  });
});
