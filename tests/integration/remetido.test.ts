import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { preCadastroRemetidoSchema, confirmacaoRemetidoSchema } from '@/lib/validation/remetido';
import { criarPreCadastroRemetido, confirmarRemetido, informarNumeroDocumentoRemetido } from '@/lib/services/remetido';
import { conferirRecebimento } from '@/lib/services/conferencia';

const uuid = () => crypto.randomUUID();
const RESERVA_MARCADOR = 'TESTE-INTEGRACAO-REMETIDO';
const ADMIN = { userId: 'admin-teste-remetido', nome: 'Admin Teste Remetido' };

function preCadastroBase(overrides: Record<string, unknown> = {}) {
  return preCadastroRemetidoSchema.parse({
    tipoRemetido: 'VENDA',
    reservaPedido: `${RESERVA_MARCADOR}-${Math.floor(Math.random() * 1_000_000)}`,
    destino: 'Usina Rondonópolis',
    ...overrides,
  });
}

async function criarPreCadastro(overrides: Record<string, unknown> = {}) {
  return criarPreCadastroRemetido(uuid(), preCadastroBase(overrides));
}

function dadosConfirmacaoBase() {
  return {
    data: '2026-10-04',
    numeroDocumento: String(Math.floor(Math.random() * 900000) + 100000),
    placaCavalo: 'ABC1D23',
    placaCarreta: 'XYZ9E88',
    responsavelPatio: 'Rafael Bley',
  };
}

describe('criarPreCadastroRemetido', () => {
  it('cria o pré-cadastro com status AGUARDANDO_CHEGADA, sem grupos nem medições', async () => {
    const mov = await criarPreCadastro();
    expect(mov.status).toBe('AGUARDANDO_CHEGADA');
    expect(mov.tipo).toBe('REMETIDO');
    expect(mov.numeroDocumento).toBeNull();
    expect(mov.dataMovimentacao).toBeNull();
    expect(mov.responsavelPatio).toBeNull();
    expect(mov.grupos).toHaveLength(0);
    expect(mov.remetidoDetalhe?.tipoRemetido).toBe('VENDA');
  });

  it('não é contabilizado por listarPendentesConferencia (que é só PENDENTE_CONFERENCIA)', async () => {
    const mov = await criarPreCadastro();
    const pendentes = await prisma.movimentacao.findMany({ where: { status: 'PENDENTE_CONFERENCIA', id: mov.id } });
    expect(pendentes).toHaveLength(0);
  });

  it('aceita NF já conhecida no pré-cadastro', async () => {
    const mov = await criarPreCadastro({ numeroDocumento: '555666' });
    expect(mov.numeroDocumento).toBe('555666');
  });
});

describe('confirmarRemetido', () => {
  it('move o status de AGUARDANDO_CHEGADA para PENDENTE_CONFERENCIA e grava os grupos', async () => {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          pesoInformado: 12.5,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });

    const confirmado = await confirmarRemetido(preCadastro.id, input);
    expect(confirmado.status).toBe('PENDENTE_CONFERENCIA');
    expect(confirmado.grupos).toHaveLength(1);
    expect(Number(confirmado.grupos[0].pesoInformado)).toBe(12.5);
    expect(confirmado.grupos[0].pesoCalculado).toBeNull();
  });

  it('nunca recalcula o peso por metros × fator — persiste exatamente o pesoInformado', async () => {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR68',
          tipoMaterial: 'REEMPREGO',
          classificacao: 'G2',
          pesoInformado: 7.777,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 12 }],
        },
      ],
    });

    const confirmado = await confirmarRemetido(preCadastro.id, input);
    expect(Number(confirmado.grupos[0].pesoInformado)).toBe(7.777);
  });

  it('persiste grupo de tampão (REEMPREGO + tampao=true) com classificação G1', async () => {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR57',
          tipoMaterial: 'REEMPREGO',
          classificacao: 'G1',
          tampao: true,
          pesoInformado: 3.2,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 7.5 }],
        },
      ],
    });

    const confirmado = await confirmarRemetido(preCadastro.id, input);
    expect(confirmado.grupos[0].tampao).toBe(true);
    expect(confirmado.grupos[0].classificacao).toBe('G1');
  });

  it('confirma só com placaCavalo (sem placaCarreta)', async () => {
    const preCadastro = await criarPreCadastro();
    const dados = { ...dadosConfirmacaoBase(), placaCarreta: undefined };
    const input = confirmacaoRemetidoSchema.parse({
      dados,
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          pesoInformado: 5,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });

    const confirmado = await confirmarRemetido(preCadastro.id, input);
    expect(confirmado.placaCavalo).toBe('ABC1D23');
    expect(confirmado.placaCarreta).toBeNull();
  });

  it('rejeita confirmar um remetido que já não está mais AGUARDANDO_CHEGADA', async () => {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          pesoInformado: 5,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });

    await confirmarRemetido(preCadastro.id, input);
    await expect(confirmarRemetido(preCadastro.id, input)).rejects.toThrow(/aguardando chegada/i);
  });

  it('persiste grupo SUCATA com pesoInformado e classificacaoSC por medição', async () => {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR57',
          tipoMaterial: 'SUCATA',
          pesoInformado: 2.4,
          medicoes: [
            { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' },
            { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 2.5, classificacaoSC: 'SC3' },
          ],
        },
      ],
    });

    const confirmado = await confirmarRemetido(preCadastro.id, input);
    const grupo = confirmado.grupos[0];
    expect(grupo.tipoMaterial).toBe('SUCATA');
    expect(Number(grupo.pesoInformado)).toBe(2.4);
    expect(grupo.pesoCalculado).toBeNull();
    expect(grupo.medicoes.map((m) => m.classificacaoSC).sort()).toEqual(['SC1', 'SC3']);
  });

  it('confere um remetido com grupo SUCATA sem exigir pesoSucataReal (o peso já vem da NF via pesoInformado)', async () => {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR57',
          tipoMaterial: 'SUCATA',
          pesoInformado: 2.4,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' }],
        },
      ],
    });

    const confirmado = await confirmarRemetido(preCadastro.id, input);
    await conferirRecebimento(confirmado.id, ADMIN);

    const conferido = await prisma.movimentacao.findUniqueOrThrow({ where: { id: confirmado.id } });
    expect(conferido.status).toBe('CONFERIDO');
    expect(conferido.pesoSucataReal).toBeNull();
  });
});

describe('informarNumeroDocumentoRemetido', () => {
  async function confirmarSemNF() {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: { ...dadosConfirmacaoBase(), numeroDocumento: undefined },
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          pesoInformado: 5,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });
    return confirmarRemetido(preCadastro.id, input);
  }

  it('completa a NF que o Pátio deixou em aberto', async () => {
    const confirmado = await confirmarSemNF();
    expect(confirmado.numeroDocumento).toBeNull();

    await informarNumeroDocumentoRemetido(confirmado.id, '999888', ADMIN);
    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: confirmado.id } });
    expect(atualizado.numeroDocumento).toBe('999888');
  });

  it('reabre a conferência ao corrigir a NF de um remetido já CONFERIDO', async () => {
    const confirmado = await confirmarSemNF();
    await informarNumeroDocumentoRemetido(confirmado.id, '111000', ADMIN);
    await conferirRecebimento(confirmado.id, ADMIN);

    const conferido = await prisma.movimentacao.findUniqueOrThrow({ where: { id: confirmado.id } });
    expect(conferido.status).toBe('CONFERIDO');

    await informarNumeroDocumentoRemetido(confirmado.id, '222000', ADMIN);
    const reaberto = await prisma.movimentacao.findUniqueOrThrow({ where: { id: confirmado.id } });
    expect(reaberto.status).toBe('PENDENTE_CONFERENCIA');
    expect(reaberto.numeroDocumento).toBe('222000');
  });

  afterAll(async () => {
    const ids = (
      await prisma.movimentacao.findMany({
        where: { reservaPedido: { startsWith: RESERVA_MARCADOR } },
        select: { id: true },
      })
    ).map((m) => m.id);
    await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
    await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });
});
