import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { preCadastroRemetidoSchema } from '@/lib/validation/remetido';
import { criarPreCadastroRemetido } from '@/lib/services/remetido';
import { excluirMovimentacao } from '@/lib/services/excluirMovimentacao';

const MARCADOR = 'TESTE-INTEGRACAO-EXCLUIR';

afterAll(async () => {
  const ids = (await prisma.movimentacao.findMany({ where: { destino: MARCADOR }, select: { id: true } })).map((m) => m.id);
  await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
});

describe('excluirMovimentacao', () => {
  it('apaga a movimentação com o histórico e o detalhe de remetido', async () => {
    const mov = await criarPreCadastroRemetido(
      crypto.randomUUID(),
      preCadastroRemetidoSchema.parse({ tipoRemetido: 'VENDA', destino: MARCADOR }),
    );
    expect(await prisma.historicoAlteracao.count({ where: { movimentacaoId: mov.id } })).toBeGreaterThan(0);

    await excluirMovimentacao(mov.id);

    expect(await prisma.movimentacao.findUnique({ where: { id: mov.id } })).toBeNull();
    expect(await prisma.historicoAlteracao.count({ where: { movimentacaoId: mov.id } })).toBe(0);
    expect(await prisma.remetidoDetalhe.count({ where: { movimentacaoId: mov.id } })).toBe(0);
  });

  it('recusa id que não existe', async () => {
    await expect(excluirMovimentacao('id-inexistente')).rejects.toThrow(/não encontrada/);
  });
});
