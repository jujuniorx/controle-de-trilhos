import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';

const uuid = () => crypto.randomUUID();
const RESPONSAVEL = 'Teste Integração Movimentacao';

function dadosBase() {
  return {
    data: '2026-09-20',
    numeroDocumento: String(Math.floor(Math.random() * 900000) + 100000),
    origem: 'Rondonópolis',
    placaCavalo: 'ABC1D23',
    placaCarreta: 'XYZ9E88',
    responsavelPatio: RESPONSAVEL,
  };
}

describe('criarRecebimentoCaminhao', () => {
  it('cria um recebimento com grupo NOVO e calcula o peso pelo fator cadastrado', async () => {
    const input = recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      dados: dadosBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });

    const mov = await criarRecebimentoCaminhao(input);
    expect(mov.status).toBe('PENDENTE_CONFERENCIA');
    expect(mov.pesoSucataReal).toBeNull();
    expect(mov.grupos).toHaveLength(1);
    const grupo = mov.grupos[0];
    expect(grupo.tipoMaterial).toBe('NOVO');
    expect(grupo.fabricante).toBe('Nippon');
    expect(Number(grupo.pesoCalculado)).toBe(0.102);
  });

  it('cria um recebimento com grupo NOVO e marca OUTROS, gravando o texto livre em fabricante', async () => {
    const input = recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      dados: dadosBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'OUTROS',
          fabricanteOutro: 'ARCELORMITTAL',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });

    const mov = await criarRecebimentoCaminhao(input);
    const grupo = mov.grupos[0];
    expect(grupo.fabricante).toBe('ARCELORMITTAL');
  });

  it('cria um recebimento só com placaCavalo (sem placaCarreta), persistindo placaCarreta nulo', async () => {
    const input = recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      dados: { ...dadosBase(), placaCarreta: undefined },
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });

    const mov = await criarRecebimentoCaminhao(input);
    expect(mov.placaCavalo).toBe('ABC1D23');
    expect(mov.placaCarreta).toBeNull();
  });

  it('persiste a transportadora informada', async () => {
    const input = recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      dados: { ...dadosBase(), transportadora: 'Translog Transportes' },
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });

    const mov = await criarRecebimentoCaminhao(input);
    expect(mov.transportadora).toBe('Translog Transportes');
  });

  it('cria um recebimento com grupo REEMPREGO exigindo classificação e soma metros/peso corretamente', async () => {
    const input = recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      dados: dadosBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR68',
          tipoMaterial: 'REEMPREGO',
          classificacao: 'G2',
          medicoes: [
            { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 12.0 },
            { clientId: uuid(), modo: 'QTD_COMPRIMENTO', quantidade: 5, comprimento: 12.0 },
          ],
        },
      ],
    });

    const mov = await criarRecebimentoCaminhao(input);
    const grupo = mov.grupos[0];
    expect(grupo.classificacao).toBe('G2');
    expect(Number(grupo.metrosTotal)).toBe(72);
    expect(Number(grupo.pesoCalculado)).toBe(4.896); // (12 + 60) * 0.068
  });

  it('cria um recebimento com grupo SUCATA sem calcular peso, mantendo pesoSucataReal nulo', async () => {
    const input = recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      dados: dadosBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR57',
          tipoMaterial: 'SUCATA',
          medicoes: [
            { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' },
            { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 2.5, classificacaoSC: 'SC3' },
          ],
        },
      ],
    });

    const mov = await criarRecebimentoCaminhao(input);
    expect(mov.pesoSucataReal).toBeNull();
    const grupo = mov.grupos[0];
    expect(grupo.pesoCalculado).toBeNull();
    expect(grupo.medicoes.map((m) => m.classificacaoSC).sort()).toEqual(['SC1', 'SC3']);
  });

  it('rejeita grupo NOVO/REEMPREGO com perfil sem fator cadastrado, sem criar nada no banco', async () => {
    const original = await prisma.fatorPerfil.findUniqueOrThrow({ where: { perfil: 'TR32' } });
    await prisma.fatorPerfil.delete({ where: { perfil: 'TR32' } });
    const clientId = uuid();
    try {
      const input = recebimentoCaminhaoSchema.parse({
        clientId,
        dados: dadosBase(),
        grupos: [
          {
            clientId: uuid(),
            perfil: 'TR32',
            tipoMaterial: 'NOVO',
            medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 5 }],
          },
        ],
      });

      await expect(criarRecebimentoCaminhao(input)).rejects.toThrow(/ainda não cadastrado/);
      expect(await prisma.movimentacao.count({ where: { clientId } })).toBe(0);
    } finally {
      await prisma.fatorPerfil.create({ data: { perfil: original.perfil, fator: original.fator } });
    }
  });

  it('é idempotente pelo clientId — reenviar o mesmo payload não duplica', async () => {
    const clientId = uuid();
    const input = recebimentoCaminhaoSchema.parse({
      clientId,
      dados: dadosBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 5 }],
        },
      ],
    });

    const primeira = await criarRecebimentoCaminhao(input);
    const segunda = await criarRecebimentoCaminhao(input);
    expect(segunda.id).toBe(primeira.id);
    const total = await prisma.movimentacao.count({ where: { clientId } });
    expect(total).toBe(1);
  });

  it('grava histórico de criação', async () => {
    const input = recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      dados: dadosBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 5 }],
        },
      ],
    });

    const mov = await criarRecebimentoCaminhao(input);
    const historico = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: mov.id } });
    expect(historico).toHaveLength(1);
    expect(historico[0].acao).toBe('CRIACAO');
  });

  afterAll(async () => {
    const ids = (
      await prisma.movimentacao.findMany({ where: { responsavelPatio: RESPONSAVEL }, select: { id: true } })
    ).map((m) => m.id);
    await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
    await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });
});
