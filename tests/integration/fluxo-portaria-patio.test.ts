import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { preCadastroRemetidoSchema } from '@/lib/validation/remetido';
import { dadosPortariaSchema } from '@/lib/validation/portaria';
import { dadosChegadaSchema } from '@/lib/validation/chegada';
import { criarPreCadastroRemetido } from '@/lib/services/remetido';
import {
  registrarChegadaCarreta,
  liberarCarreta,
  desfazerLiberacaoCarreta,
  confirmarSaidaCarreta,
  listarPortaria,
  listarCarretasNaPortaria,
  criarEnvioPelaPortaria,
} from '@/lib/services/portaria';
import { criarChegada, liberarChegada, confirmarSaidaChegada, buscarChegadaLiberada } from '@/lib/services/chegada';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';
import { conferirRecebimento, informarPesoSucataReal } from '@/lib/services/conferencia';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';

const uuid = () => crypto.randomUUID();
const MARCADOR = 'TESTE-FLUXO-PORTARIA';
const ADMIN = { userId: 'admin-teste-fluxo', nome: 'Admin Teste Fluxo' };

async function erroDe(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  return '';
}

describe('Fluxo Portaria ↔ Pátio — Remetido (carreta que vai carregar)', () => {
  it('Pátio avisa → Portaria registra a chegada → Pátio libera → Portaria confirma a saída', async () => {
    const mov = await criarPreCadastroRemetido(
      uuid(),
      preCadastroRemetidoSchema.parse({ tipoRemetido: 'VENDA', reservaPedido: `${MARCADOR}-${Date.now()}`, destino: 'Usina Teste' }),
      'Pátio',
    );
    const id = mov.id;

    // Antes da chegada: não pode liberar nem sair
    expect(await erroDe(liberarCarreta(id))).not.toBe('');
    expect(await erroDe(confirmarSaidaCarreta(id, 'Portaria'))).not.toBe('');

    // Chegada sem nenhuma placa é recusada
    expect(await erroDe(registrarChegadaCarreta(id, dadosPortariaSchema.parse({ motoristaNome: 'João' }), 'Portaria'))).not.toBe('');

    // Portaria registra a chegada
    await registrarChegadaCarreta(
      id,
      dadosPortariaSchema.parse({ motoristaNome: 'João da Silva', placaCarreta: 'ABC1D23', transportadora: 'Ana Transportes', observacao: 'Chegou cedo' }),
      'Portaria Teste',
    );
    const aposChegada = await prisma.movimentacao.findUniqueOrThrow({ where: { id } });
    expect(aposChegada.chegadaPortariaEm).not.toBeNull();
    expect(aposChegada.transportadora).toBe('Ana Transportes');
    expect(aposChegada.observacaoPortaria).toBe('Chegou cedo');

    // Aparece para o Pátio na lista "Carretas na Portaria"
    expect((await listarCarretasNaPortaria()).some((c) => c.id === id)).toBe(true);
    // Chegada duplicada é recusada
    expect(await erroDe(registrarChegadaCarreta(id, dadosPortariaSchema.parse({ placaCarreta: 'ABC1D23' }), 'Portaria'))).not.toBe('');

    // Sair antes de o Pátio liberar é recusado
    expect(await erroDe(confirmarSaidaCarreta(id, 'Portaria'))).not.toBe('');

    // Pátio libera (e pode desfazer enquanto a Portaria não confirmou)
    await liberarCarreta(id);
    await desfazerLiberacaoCarreta(id);
    expect((await prisma.movimentacao.findUniqueOrThrow({ where: { id } })).carretaLiberadaEm).toBeNull();
    await liberarCarreta(id);
    expect((await listarCarretasNaPortaria()).some((c) => c.id === id)).toBe(false);

    // Portaria confirma a saída, com horário
    await confirmarSaidaCarreta(id, 'Portaria Teste');
    const fim = await prisma.movimentacao.findUniqueOrThrow({ where: { id } });
    expect(fim.saidaPortariaEm).not.toBeNull();
    expect(fim.saidaPortariaPor).toBe('Portaria Teste');

    // Saída duplicada, dados novos e desfazer depois de sair: tudo recusado
    expect(await erroDe(confirmarSaidaCarreta(id, 'Portaria'))).not.toBe('');
    expect(await erroDe(desfazerLiberacaoCarreta(id))).not.toBe('');

    // Continua visível na Portaria (saiu há menos de 24 h)
    const lista = await listarPortaria();
    expect(lista.find((m) => m.id === id)?.estado).toBe('SAIU');

    // Histórico registra cada etapa
    const acoes = (await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: id } })).map((h) => h.acao);
    expect(acoes).toEqual(expect.arrayContaining(['CARRETA_CHEGOU', 'CARRETA_LIBERADA', 'CARRETA_SAIU']));
  });
});

describe('Fluxo Portaria ↔ Pátio — Recebimento (caminhão que vai descarregar)', () => {
  it('Portaria registra → Pátio recebe → Portaria confirma a saída → Admin informa/corrige o peso', async () => {
    const { id: chegadaId } = await criarChegada('Portaria Teste');
    const dados = dadosChegadaSchema.parse({ origem: MARCADOR, placaCarreta: 'XYZ9E88', transportadora: 'Ana', motoristaNome: 'Maria' });

    // Sem placa não registra
    expect(await erroDe(liberarChegada(chegadaId, dadosChegadaSchema.parse({ origem: MARCADOR }), 'Portaria Teste'))).not.toBe('');

    await liberarChegada(chegadaId, dados, 'Portaria Teste');
    const pre = await buscarChegadaLiberada(chegadaId);
    expect(pre?.transportadora).toBe('Ana'); // o Pátio vê o que a Portaria lançou

    // Ainda não descarregou: não pode sair
    expect(await erroDe(confirmarSaidaChegada(chegadaId, 'Portaria Teste'))).not.toBe('');

    // Pátio recebe a sucata medida
    const input = recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      chegadaId,
      dados: { data: '2026-10-15', numeroDocumento: '123456', origem: MARCADOR, placaCarreta: 'XYZ9E88', responsavelPatio: 'Pátio Teste' },
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'SUCATA',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 2, comprimento: 5, classificacaoSC: 'SC1' }],
        },
      ],
    });
    const mov = await criarRecebimentoCaminhao(input);
    expect(mov.grupos).toHaveLength(1);

    // A chegada ficou ligada ao recebimento e agora a Portaria pode confirmar a saída
    const chegada = await prisma.chegadaCaminhao.findUniqueOrThrow({ where: { id: chegadaId } });
    expect(chegada.movimentacaoId).toBe(mov.id);
    await confirmarSaidaChegada(chegadaId, 'Portaria Teste');
    expect((await prisma.chegadaCaminhao.findUniqueOrThrow({ where: { id: chegadaId } })).saidaEm).not.toBeNull();
    expect(await erroDe(confirmarSaidaChegada(chegadaId, 'Portaria Teste'))).not.toBe('');

    // Sem peso real não confere; com peso confere; corrigir depois reabre e dá para conferir de novo
    expect(await erroDe(conferirRecebimento(mov.id, ADMIN))).not.toBe('');
    await informarPesoSucataReal(mov.id, 12.5, ADMIN);
    await conferirRecebimento(mov.id, ADMIN);
    expect((await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } })).status).toBe('CONFERIDO');

    await informarPesoSucataReal(mov.id, 13.2, ADMIN);
    const corrigido = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(Number(corrigido.pesoSucataReal)).toBe(13.2);
    expect(corrigido.status).toBe('PENDENTE_CONFERENCIA');
    await conferirRecebimento(mov.id, ADMIN);
    expect((await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } })).status).toBe('CONFERIDO');
  });
});

describe('Carreta que chegou sem aviso do Pátio — a Portaria cria o envio', () => {
  it('cria o envio com a chegada já registrada e o Pátio passa a ver', async () => {
    const id = await criarEnvioPelaPortaria(
      { destino: 'Usina Sem Aviso', placaCarreta: 'DEF2G34', motoristaNome: 'Pedro', origem: MARCADOR } as never,
      'Portaria Teste',
    );
    const mov = await prisma.movimentacao.findUniqueOrThrow({ where: { id } });
    expect(mov.status).toBe('AGUARDANDO_CHEGADA');
    expect(mov.chegadaPortariaEm).not.toBeNull();
    expect(mov.motoristaNome).toBe('Pedro');
    expect((await listarCarretasNaPortaria()).some((c) => c.id === id)).toBe(true);
    const acoes = (await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: id } })).map((h) => h.acao);
    expect(acoes).toEqual(expect.arrayContaining(['PORTARIA_CRIOU_ENVIO', 'CARRETA_CHEGOU']));
  });

  it('recusa sem placa', async () => {
    expect(await erroDe(criarEnvioPelaPortaria({ destino: 'Usina', origem: MARCADOR } as never, 'Portaria Teste'))).toMatch(/placa/);
  });
});

afterAll(async () => {
  const movs = await prisma.movimentacao.findMany({
    where: { OR: [{ reservaPedido: { startsWith: MARCADOR } }, { origem: MARCADOR }] },
    select: { id: true },
  });
  const ids = movs.map((m) => m.id);
  await prisma.chegadaCaminhao.deleteMany({ where: { OR: [{ origem: MARCADOR }, { movimentacaoId: { in: ids } }] } });
  await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
  await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});
