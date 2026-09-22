import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import {
  criarRecebimentoCaminhao,
  listarPendentesConferencia,
  buscarMovimentacaoDetalhe,
  resumoPeso,
} from '@/lib/services/movimentacao';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';

const uuid = () => crypto.randomUUID();
const RESPONSAVEL = 'Teste Integração Admin';

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

async function criarRecebimentoMisto() {
  const input = recebimentoCaminhaoSchema.parse({
    clientId: uuid(),
    dados: dadosBase(),
    grupos: [
      {
        clientId: uuid(),
        perfil: 'TR22',
        tipoMaterial: 'NOVO',
        medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }], // peso 0.102
      },
      {
        clientId: uuid(),
        perfil: 'TR68',
        tipoMaterial: 'REEMPREGO',
        classificacao: 'G2',
        medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 12 }], // peso 0.816
      },
      {
        clientId: uuid(),
        perfil: 'TR57',
        tipoMaterial: 'SUCATA',
        medicoes: [
          { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' },
        ],
      },
    ],
  });
  return criarRecebimentoCaminhao(input);
}

async function criarRecebimentoSemSucata() {
  const input = recebimentoCaminhaoSchema.parse({
    clientId: uuid(),
    dados: dadosBase(),
    grupos: [
      {
        clientId: uuid(),
        perfil: 'TR22',
        tipoMaterial: 'NOVO',
        medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 10 }], // peso 0.22
      },
    ],
  });
  return criarRecebimentoCaminhao(input);
}

describe('listarPendentesConferencia', () => {
  it('lista somente movimentações com status PENDENTE_CONFERENCIA', async () => {
    const pendente = await criarRecebimentoSemSucata();
    const outra = await criarRecebimentoSemSucata();
    await prisma.movimentacao.update({ where: { id: outra.id }, data: { status: 'CONFERIDO' } });

    const lista = await listarPendentesConferencia();
    const ids = lista.map((m) => m.id);
    expect(ids).toContain(pendente.id);
    expect(ids).not.toContain(outra.id);
    expect(lista.every((m) => m.status === 'PENDENTE_CONFERENCIA')).toBe(true);
  });
});

describe('buscarMovimentacaoDetalhe', () => {
  it('retorna a movimentação com grupos e medições completos', async () => {
    const mov = await criarRecebimentoMisto();
    const detalhe = await buscarMovimentacaoDetalhe(mov.id);
    expect(detalhe).not.toBeNull();
    expect(detalhe!.grupos).toHaveLength(3);
    const grupoSucata = detalhe!.grupos.find((g) => g.tipoMaterial === 'SUCATA')!;
    expect(grupoSucata.medicoes[0].classificacaoSC).toBe('SC1');
    expect(grupoSucata.pesoCalculado).toBeNull();
  });

  it('retorna null para um id inexistente', async () => {
    expect(await buscarMovimentacaoDetalhe('id-que-nao-existe')).toBeNull();
  });
});

describe('resumoPeso', () => {
  it('mostra "peso total" (não pendente) quando não há grupo de sucata', async () => {
    const mov = await criarRecebimentoSemSucata();
    const detalhe = await buscarMovimentacaoDetalhe(mov.id);
    const resumo = resumoPeso(detalhe!);
    expect(resumo.temSucata).toBe(false);
    expect(resumo.pendente).toBe(false);
    expect(resumo.pesoTotal).toBe(0.22);
  });

  it('considera somente NOVO+REEMPREGO em "peso até agora" quando a sucata está pendente', async () => {
    const mov = await criarRecebimentoMisto();
    const detalhe = await buscarMovimentacaoDetalhe(mov.id);
    const resumo = resumoPeso(detalhe!);
    expect(resumo.temSucata).toBe(true);
    expect(resumo.pendente).toBe(true);
    expect(resumo.pesoNovoReemprego).toBe(0.918); // 0.102 (NOVO) + 0.816 (REEMPREGO)
    expect(resumo.pesoTotal).toBeNull();
    expect(resumo.pesoSucataReal).toBeNull();
  });

  it('soma o peso da sucata ao total quando pesoSucataReal está informado', async () => {
    const mov = await criarRecebimentoMisto();
    await prisma.movimentacao.update({ where: { id: mov.id }, data: { pesoSucataReal: 5 } });
    const detalhe = await buscarMovimentacaoDetalhe(mov.id);
    const resumo = resumoPeso(detalhe!);
    expect(resumo.pendente).toBe(false);
    expect(resumo.pesoSucataReal).toBe(5);
    expect(resumo.pesoTotal).toBe(5.918); // 0.918 + 5
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
