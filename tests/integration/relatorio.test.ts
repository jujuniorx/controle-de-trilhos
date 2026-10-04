import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';
import { criarPreCadastroRemetido } from '@/lib/services/remetido';
import { preCadastroRemetidoSchema } from '@/lib/validation/remetido';
import { buscarMovimentacoesRelatorio, listarPendencias } from '@/lib/services/relatorio';

const uuid = () => crypto.randomUUID();
const MARCADOR = 'TESTE-RELATORIO';

function dadosRecebimentoBase(overrides: Record<string, unknown> = {}) {
  return {
    data: '2026-10-04',
    numeroDocumento: String(Math.floor(Math.random() * 900000) + 100000),
    origem: MARCADOR,
    placaCavalo: 'ABC1D23',
    responsavelPatio: 'Teste Integração Relatório',
    ...overrides,
  };
}

async function criarRecebimentoNovo() {
  const input = recebimentoCaminhaoSchema.parse({
    clientId: uuid(),
    dados: dadosRecebimentoBase(),
    grupos: [
      {
        clientId: uuid(),
        perfil: 'TR22',
        tipoMaterial: 'NOVO',
        medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 10 }],
      },
    ],
  });
  return criarRecebimentoCaminhao(input);
}

async function criarRecebimentoComSucataPendente() {
  const input = recebimentoCaminhaoSchema.parse({
    clientId: uuid(),
    dados: dadosRecebimentoBase(),
    grupos: [
      {
        clientId: uuid(),
        perfil: 'TR57',
        tipoMaterial: 'SUCATA',
        medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' }],
      },
    ],
  });
  return criarRecebimentoCaminhao(input);
}

async function criarRemetidoAguardandoChegada() {
  const input = preCadastroRemetidoSchema.parse({
    tipoRemetido: 'VENDA',
    reservaPedido: `${MARCADOR}-${Math.floor(Math.random() * 1_000_000)}`,
    destino: MARCADOR,
  });
  return criarPreCadastroRemetido(uuid(), input);
}

describe('buscarMovimentacoesRelatorio', () => {
  it('filtra por origem/destino (texto, insensível a caixa), batendo tanto Recebimento (origem) quanto Remetido (destino)', async () => {
    const recebimento = await criarRecebimentoNovo();
    const remetido = await criarRemetidoAguardandoChegada();

    const resultado = await buscarMovimentacoesRelatorio({ origemDestino: MARCADOR.toLowerCase() });
    const ids = resultado.map((m) => m.id);
    expect(ids).toContain(recebimento.id);
    expect(ids).toContain(remetido.id);
  });

  it('filtra por tipo', async () => {
    const recebimento = await criarRecebimentoNovo();
    const remetido = await criarRemetidoAguardandoChegada();

    const resultado = await buscarMovimentacoesRelatorio({ origemDestino: MARCADOR, tipo: 'RECEBIMENTO' });
    const ids = resultado.map((m) => m.id);
    expect(ids).toContain(recebimento.id);
    expect(ids).not.toContain(remetido.id);
  });

  it('filtra por material do grupo (SUCATA)', async () => {
    const novo = await criarRecebimentoNovo();
    const comSucata = await criarRecebimentoComSucataPendente();

    const resultado = await buscarMovimentacoesRelatorio({ origemDestino: MARCADOR, material: 'SUCATA' });
    const ids = resultado.map((m) => m.id);
    expect(ids).toContain(comSucata.id);
    expect(ids).not.toContain(novo.id);
  });

  it('filtra por status', async () => {
    const remetido = await criarRemetidoAguardandoChegada();
    const resultado = await buscarMovimentacoesRelatorio({ origemDestino: MARCADOR, status: 'AGUARDANDO_CHEGADA' });
    expect(resultado.map((m) => m.id)).toContain(remetido.id);

    const semResultado = await buscarMovimentacoesRelatorio({ origemDestino: MARCADOR, status: 'CONFERIDO' });
    expect(semResultado.map((m) => m.id)).not.toContain(remetido.id);
  });
});

describe('listarPendencias', () => {
  it('inclui recebimento com sucata sem pesoSucataReal em recebidosAguardandoPesoSucata e em aguardandoConferencia', async () => {
    const comSucata = await criarRecebimentoComSucataPendente();
    const pendencias = await listarPendencias();

    expect(pendencias.recebidosAguardandoPesoSucata.map((m) => m.id)).toContain(comSucata.id);
    expect(pendencias.aguardandoConferencia.map((m) => m.id)).toContain(comSucata.id);
  });

  it('inclui remetido recém pré-cadastrado em remetidosAguardandoChegada, mas não em aguardandoConferencia', async () => {
    const remetido = await criarRemetidoAguardandoChegada();
    const pendencias = await listarPendencias();

    expect(pendencias.remetidosAguardandoChegada.map((m) => m.id)).toContain(remetido.id);
    expect(pendencias.aguardandoConferencia.map((m) => m.id)).not.toContain(remetido.id);
  });

  it('não lista recebimento sem sucata em recebidosAguardandoPesoSucata', async () => {
    const semSucata = await criarRecebimentoNovo();
    const pendencias = await listarPendencias();
    expect(pendencias.recebidosAguardandoPesoSucata.map((m) => m.id)).not.toContain(semSucata.id);
  });
});

afterAll(async () => {
  const movimentacoes = await prisma.movimentacao.findMany({
    where: { OR: [{ origem: MARCADOR }, { destino: MARCADOR }] },
    select: { id: true },
  });
  const ids = movimentacoes.map((m) => m.id);
  await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
  await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});
