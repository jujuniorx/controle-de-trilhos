import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID as uuid } from 'crypto';
import { prisma } from '@/lib/db';
import { informarPesoGrupoRemetido } from '@/lib/services/remetido';

describe('informarPesoGrupoRemetido', () => {
  afterAll(async () => {
    // Nenhum teste deste arquivo limpava o que criava — ficava poluindo o banco
    // (compartilhado com produção neste projeto) a cada rodada da suíte.
    const ids = (
      await prisma.movimentacao.findMany({
        where: { reservaPedido: { in: ['RES-TESTE-PESO', 'RES-TESTE-PESO-2'] } },
        select: { id: true },
      })
    ).map((m) => m.id);
    await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
    await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it('preenche pesoInformado de um grupo do Remetido e registra no histórico', async () => {
    const mov = await prisma.movimentacao.create({
      data: {
        clientId: uuid(),
        tipo: 'REMETIDO',
        tipoDocumento: 'NF',
        tipoTransporte: 'CAMINHAO',
        status: 'PENDENTE_CONFERENCIA',
        destino: 'Teste',
        reservaPedido: 'RES-TESTE-PESO',
        remetidoDetalhe: { create: { tipoRemetido: 'VENDA' } },
        grupos: {
          create: [{ clientId: uuid(), perfil: 'TR57', tipoMaterial: 'SUCATA', metrosTotal: 8.1, pesoCalculado: 0.462, pesoInformado: null }],
        },
      },
      include: { grupos: true },
    });

    await informarPesoGrupoRemetido(mov.grupos[0].id, 1.5, { userId: 'u1', nome: 'Admin Teste' });

    const grupo = await prisma.grupo.findUniqueOrThrow({ where: { id: mov.grupos[0].id } });
    expect(Number(grupo.pesoInformado)).toBe(1.5);

    const historico = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: mov.id, acao: 'PESO_NF_INFORMADO' } });
    expect(historico).toHaveLength(1);
    expect(historico[0].valorNovo).toBe('1.5');
  });

  it('corrigir o peso de um Remetido já CONFERIDO reabre para PENDENTE_CONFERENCIA', async () => {
    const mov = await prisma.movimentacao.create({
      data: {
        clientId: uuid(),
        tipo: 'REMETIDO',
        tipoDocumento: 'NF',
        tipoTransporte: 'CAMINHAO',
        status: 'CONFERIDO',
        destino: 'Teste',
        reservaPedido: 'RES-TESTE-PESO-2',
        remetidoDetalhe: { create: { tipoRemetido: 'VENDA' } },
        grupos: { create: [{ clientId: uuid(), perfil: 'TR57', tipoMaterial: 'SUCATA', metrosTotal: 8.1, pesoCalculado: 0.462, pesoInformado: 0.462 }] },
      },
      include: { grupos: true },
    });

    await informarPesoGrupoRemetido(mov.grupos[0].id, 1.8, { userId: 'u1', nome: 'Admin Teste' });

    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(atualizado.status).toBe('PENDENTE_CONFERENCIA');
  });
});
