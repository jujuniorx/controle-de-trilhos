import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { registrarHistorico } from '@/lib/services/historico';

describe('registrarHistorico', () => {
  it('grava uma entrada de histórico para uma movimentação', async () => {
    const mov = await prisma.movimentacao.create({
      data: {
        clientId: crypto.randomUUID(),
        tipo: 'RECEBIMENTO',
        tipoDocumento: 'NF',
        numeroDocumento: '000001',
        tipoTransporte: 'CAMINHAO',
        responsavelPatio: 'Teste',
      },
    });

    await registrarHistorico({ movimentacaoId: mov.id, usuarioNome: 'Teste', acao: 'CRIACAO' });

    const historico = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: mov.id } });
    expect(historico).toHaveLength(1);
    expect(historico[0].acao).toBe('CRIACAO');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
