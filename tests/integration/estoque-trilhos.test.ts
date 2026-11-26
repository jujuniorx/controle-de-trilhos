import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';
import { conferirRecebimento } from '@/lib/services/conferencia';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';
import { ajustarSaldoTrilho, carregarSaldoInicial, montarEstoqueTrilhos } from '@/lib/services/estoqueTrilhos';
import { chavePosicao, type Posicao } from '@/lib/estoque/trilhos';

const uuid = () => crypto.randomUUID();
const ADMIN = { userId: 'admin-teste-estoque-trilhos', nome: 'Admin Teste Estoque Trilhos' };
const G2_TR60: Posicao = { secao: 'REEMPREGO', perfil: 'TR60', tipo: 'BARRA', fabricante: null, classe: 'G2' };
const MOTIVO = 'Teste de integração do estoque de trilhos';

async function saldoDe(p: Posicao): Promise<number> {
  const e = await montarEstoqueTrilhos();
  return e.saldos.find((s) => chavePosicao(s) === chavePosicao(p))?.metros ?? 0;
}

const criados: string[] = [];

afterAll(async () => {
  for (const id of criados) {
    await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: id } } });
    await prisma.grupo.deleteMany({ where: { movimentacaoId: id } });
    await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: id } });
    await prisma.movimentacao.delete({ where: { id } });
  }
  await prisma.estoqueTrilhoLancamento.deleteMany({ where: { origemTipo: 'AJUSTE', motivo: MOTIVO } });
});

describe('estoque de trilhos', () => {
  it('carregar o saldo inicial duas vezes não duplica', async () => {
    await carregarSaldoInicial(ADMIN.nome);
    expect(await carregarSaldoInicial(ADMIN.nome)).toEqual({ criados: 0 });
  });

  it('recebimento conferido de reemprego soma no G2; reaberto, sai de novo', async () => {
    const antes = await saldoDe(G2_TR60);
    const input = recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      dados: {
        data: '2026-11-26',
        dataCarregamento: '2026-11-26',
        numeroDocumento: String(Math.floor(Math.random() * 900000) + 100000),
        origem: 'TESTE ESTOQUE',
        placaCavalo: 'ABC1D23',
        responsavelPatio: 'Teste Estoque',
      },
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR60',
          tipoMaterial: 'REEMPREGO',
          classificacao: 'G2',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 10 }],
        },
      ],
    });
    const mov = await criarRecebimentoCaminhao(input);
    criados.push(mov.id);
    expect(await saldoDe(G2_TR60)).toBeCloseTo(antes, 3);
    await conferirRecebimento(mov.id, ADMIN);
    expect(await saldoDe(G2_TR60)).toBeCloseTo(antes + 10, 3);
    await prisma.movimentacao.update({ where: { id: mov.id }, data: { status: 'PENDENTE_CONFERENCIA' } });
    expect(await saldoDe(G2_TR60)).toBeCloseTo(antes, 3);
  });

  it('ajuste do admin entra como lançamento AJUSTE', async () => {
    const antes = await saldoDe(G2_TR60);
    await ajustarSaldoTrilho(G2_TR60, -12, null, MOTIVO, ADMIN.nome);
    const e = await montarEstoqueTrilhos();
    expect(e.lancamentos.some((l) => l.origemTipo === 'AJUSTE' && l.descricao.includes(MOTIVO))).toBe(true);
    expect(e.saldos.find((s) => chavePosicao(s) === chavePosicao(G2_TR60))?.metros).toBeCloseTo(antes - 12, 3);
  });
});
