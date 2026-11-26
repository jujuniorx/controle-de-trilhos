import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { criarChegadaVagao } from '@/lib/services/movimentacao';
import { conferirRecebimento } from '@/lib/services/conferencia';
import { chegadaVagaoSchema } from '@/lib/validation/vagao';
import { montarEstoqueTrilhos } from '@/lib/services/estoqueTrilhos';
import { chavePosicao, type Posicao } from '@/lib/estoque/trilhos';

const ADMIN = { userId: 'admin-teste-vagao', nome: 'Admin Teste Vagao' };
const LISA: Posicao = { secao: 'NOVO', perfil: 'TR68', tipo: 'LISA', fabricante: 'PANGANG', classe: 'NORMAL' };
const TALA: Posicao = { ...LISA, tipo: 'TALA' };
const criados: string[] = [];

async function saldo(p: Posicao): Promise<number> {
  const e = await montarEstoqueTrilhos();
  return e.saldos.find((s) => chavePosicao(s) === chavePosicao(p))?.metros ?? 0;
}

afterAll(async () => {
  for (const id of criados) {
    await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: id } } });
    await prisma.grupo.deleteMany({ where: { movimentacaoId: id } });
    await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: id } });
    await prisma.movimentacao.delete({ where: { id } });
  }
});

describe('chegada de vagão', () => {
  it('36 lisas + 6 talas TR68 Pangang: 864 m e 144 m, pendente; conferido entra no estoque', async () => {
    const [lisaAntes, talaAntes] = [await saldo(LISA), await saldo(TALA)];
    const { id } = await criarChegadaVagao(
      chegadaVagaoSchema.parse({
        data: '2026-11-26',
        vagao: 'teste 001',
        responsavelPatio: 'Teste Vagao',
        linhas: [
          { perfil: 'TR68', marca: 'PANGANG', formaNovo: 'LISA', barras: 36 },
          { perfil: 'TR68', marca: 'PANGANG', formaNovo: 'TALA', barras: 6 },
        ],
      }),
    );
    criados.push(id);

    const mov = await prisma.movimentacao.findUniqueOrThrow({ where: { id }, include: { grupos: true } });
    expect(mov.status).toBe('PENDENTE_CONFERENCIA');
    expect(mov.tipoTransporte).toBe('VAGAO');
    expect(mov.origem).toBe('VAGÃO TESTE 001');
    expect(mov.grupos.map((g) => [g.formaNovo, Number(g.metrosTotal)]).sort()).toEqual([
      ['LISA', 864],
      ['TALA', 144],
    ]);
    expect(await saldo(LISA)).toBeCloseTo(lisaAntes, 3);

    await conferirRecebimento(id, ADMIN);
    expect(await saldo(LISA)).toBeCloseTo(lisaAntes + 864, 3);
    expect(await saldo(TALA)).toBeCloseTo(talaAntes + 144, 3);
  });
});
