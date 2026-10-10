import { describe, it, expect } from 'vitest';
import { preCadastroRemetidoSchema, confirmacaoRemetidoSchema, lancamentoDiretoRemetidoSchema } from '@/lib/validation/remetido';

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
    // Marca é obrigatória só para NOVO (Bloco 1.5); schemas de REEMPREGO/SUCATA
    // não declaram esse campo e o Zod descarta chaves desconhecidas por padrão,
    // então este default não interfere nos overrides que trocam tipoMaterial.
    marca: 'NIPPON',
    pesoInformado: 12.5,
    medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.73 }],
    ...overrides,
  };
}

describe('preCadastroRemetidoSchema', () => {
  it('aceita um pré-cadastro sem reserva/pedido (o Pátio não precisa informar)', () => {
    const resultado = preCadastroRemetidoSchema.safeParse({ tipoRemetido: 'VENDA', destino: 'Usina Rondonópolis' });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.reservaPedido).toBeUndefined();
  });

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

  it('aceita grupo sem pesoInformado — campo passa a ser opcional (o Pátio normalmente não sabe o peso da NF)', () => {
    const grupo = grupoValido();
    delete (grupo as Record<string, unknown>).pesoInformado;
    const resultado = confirmacaoRemetidoSchema.safeParse({
      clientId: uuid(),
      dados: dadosConfirmacaoValidos(),
      grupos: [grupo],
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.grupos[0].pesoInformado).toBeUndefined();
    }
  });

  it('rejeita grupo NOVO sem marca (obrigatória — Bloco 1.5)', () => {
    const grupo = grupoValido();
    delete (grupo as Record<string, unknown>).marca;
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

  it('aceita grupo SUCATA sem pesoInformado — mesma regra: o campo é opcional para todo tipo de material', () => {
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
    expect(resultado.success).toBe(true);
  });
});

describe('lancamentoDiretoRemetidoSchema', () => {
  function lancamentoValido(overrides: Record<string, unknown> = {}) {
    return {
      tipoRemetido: 'VENDA',
      reservaPedido: 'PED-2026-002',
      destino: 'Usina Rondonópolis',
      dados: dadosConfirmacaoValidos(),
      grupos: [grupoValido()],
      ...overrides,
    };
  }

  it('aceita um lançamento direto válido (identificação + dados + grupos juntos)', () => {
    const resultado = lancamentoDiretoRemetidoSchema.safeParse(lancamentoValido());
    expect(resultado.success).toBe(true);
  });

  it('aceita tipoRemetido ausente — o Pátio não tem essa informação no lançamento direto (Bloco 2.2)', () => {
    const { tipoRemetido, ...resto } = lancamentoValido();
    const resultado = lancamentoDiretoRemetidoSchema.safeParse(resto);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.tipoRemetido).toBeUndefined();
    }
  });

  it('rejeita destino vazio', () => {
    const resultado = lancamentoDiretoRemetidoSchema.safeParse(lancamentoValido({ destino: '' }));
    expect(resultado.success).toBe(false);
  });

  it('rejeita reservaPedido vazio (string presente, mas em branco)', () => {
    const resultado = lancamentoDiretoRemetidoSchema.safeParse(lancamentoValido({ reservaPedido: '' }));
    expect(resultado.success).toBe(false);
  });

  it('aceita reservaPedido ausente — campo removido da tela de lançamento direto', () => {
    const { reservaPedido, ...resto } = lancamentoValido();
    const resultado = lancamentoDiretoRemetidoSchema.safeParse(resto);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.reservaPedido).toBeUndefined();
    }
  });

  it('aceita numeroDocumento ausente em dados (NF ainda não conhecida)', () => {
    const dados = { ...dadosConfirmacaoValidos(), numeroDocumento: undefined };
    const resultado = lancamentoDiretoRemetidoSchema.safeParse(lancamentoValido({ dados }));
    expect(resultado.success).toBe(true);
  });

  it('rejeita sem nenhum grupo', () => {
    const resultado = lancamentoDiretoRemetidoSchema.safeParse(lancamentoValido({ grupos: [] }));
    expect(resultado.success).toBe(false);
  });

  it('aplica as mesmas regras de grupo da confirmação: tampão só pode ser G1 ou G2', () => {
    const resultado = lancamentoDiretoRemetidoSchema.safeParse(
      lancamentoValido({
        grupos: [
          grupoValido({
            tipoMaterial: 'REEMPREGO',
            classificacao: 'G3',
            tampao: true,
            medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 7.5 }],
          }),
        ],
      }),
    );
    expect(resultado.success).toBe(false);
  });
});
