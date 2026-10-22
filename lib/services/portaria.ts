import { prisma } from '@/lib/db';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { registrarHistorico } from '@/lib/services/historico';
import { enviarAvisoPush } from '@/lib/services/push';
import { normalizarLocal } from '@/lib/domain/local';
import {
  estadoPortaria,
  motivoNaoPodeConfirmarSaida,
  motivoNaoPodeLiberar,
  motivoNaoPodeRegistrarChegada,
  ROTULO_ESTADO,
} from '@/lib/domain/portaria';
import type { DadosPortaria } from '@/lib/validation/portaria';

/**
 * Portaria (Remetido). Fluxo: o Pátio cria o "aguardando chegada" → a carreta chega e a Portaria
 * registra motorista/placas → o Pátio carrega, confirma e LIBERA a carreta → a Portaria confirma a
 * saída (com horário). A Portaria NUNCA lê nem grava medições: as consultas abaixo só selecionam
 * campos de identificação.
 */

const SELECT_PORTARIA = {
  id: true,
  status: true,
  destino: true,
  origem: true,
  reservaPedido: true,
  numeroDocumento: true,
  transportadora: true,
  placaCavalo: true,
  placaCarreta: true,
  placaCarreta2: true,
  comprimentoCarreta: true,
  motoristaNome: true,
  motoristaCpf: true,
  motoristaTelefone: true,
  capacidadeCarga: true,
  materialPrevisto: true,
  chegadaPortariaEm: true,
  chegadaPortariaPor: true,
  carretaLiberadaEm: true,
  carretaLiberadaPor: true,
  saidaPortariaEm: true,
  saidaPortariaPor: true,
  observacaoPortaria: true,
  createdAt: true,
  remetidoDetalhe: { select: { tipoRemetido: true } },
} as const;

export async function listarPortaria() {
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const lista = await prisma.movimentacao.findMany({
    where: {
      tipo: 'REMETIDO',
      OR: [
        // esperando a carreta chegar
        { status: 'AGUARDANDO_CHEGADA', chegadaPortariaEm: null, carretaLiberadaEm: null, saidaPortariaEm: null },
        // já chegou (ou foi liberada pelo fluxo antigo) e ainda não saiu
        { saidaPortariaEm: null, OR: [{ chegadaPortariaEm: { not: null } }, { carretaLiberadaEm: { not: null } }] },
        // saiu nas últimas 24 h
        { saidaPortariaEm: { gte: ontem } },
      ],
    },
    select: SELECT_PORTARIA,
    orderBy: { createdAt: 'desc' },
  });
  return lista.map((m) => ({
    ...m,
    capacidadeCarga: m.capacidadeCarga ? Number(m.capacidadeCarga) : null,
    comprimentoCarreta: m.comprimentoCarreta ? Number(m.comprimentoCarreta) : null,
    estado: estadoPortaria(m),
  }));
}

export type ItemPortaria = Awaited<ReturnType<typeof listarPortaria>>[number];

async function carregarRemetido(id: string) {
  const mov = await prisma.movimentacao.findFirst({ where: { id, tipo: 'REMETIDO' }, select: SELECT_PORTARIA });
  if (!mov) throw new ErroRegraNegocio('Remetido não encontrado.');
  return mov;
}

/** O campo em branco limpa o valor salvo (null); só a Portaria mexe nestes campos. */
function paraBanco(d: DadosPortaria) {
  return {
    origem: d.origem ? normalizarLocal(d.origem) : null,
    destino: d.destino ? normalizarLocal(d.destino) : null,
    materialPrevisto: d.materialPrevisto ?? null,
    observacaoPortaria: d.observacao ?? null,
    transportadora: d.transportadora ?? null,
    motoristaNome: d.motoristaNome ?? null,
    motoristaCpf: d.motoristaCpf ?? null,
    motoristaTelefone: d.motoristaTelefone ?? null,
    placaCarreta: d.placaCarreta ?? null,
    placaCarreta2: d.placaCarreta2 ?? null,
    placaCavalo: d.placaCavalo ?? null,
    capacidadeCarga: d.capacidadeCarga ?? null,
    comprimentoCarreta: d.comprimentoCarreta ?? null,
  };
}

export async function salvarDadosPortaria(id: string, dados: DadosPortaria, atorNome: string, atorId?: string): Promise<void> {
  const mov = await carregarRemetido(id);
  if (mov.saidaPortariaEm) throw new ErroRegraNegocio('Esta carreta já saiu.');
  await prisma.movimentacao.update({ where: { id }, data: paraBanco(dados) });
  await registrarHistorico({ movimentacaoId: id, usuarioId: atorId, usuarioNome: `${atorNome} (portaria)`, acao: 'PORTARIA_DADOS' });
}

/** Portaria: salva os dados e registra a chegada da carreta (hora automática). Exige ao menos uma placa. Avisa o Pátio. */
export async function registrarChegadaCarreta(id: string, dados: DadosPortaria, atorNome: string, atorId?: string): Promise<void> {
  const mov = await carregarRemetido(id);
  const motivo = motivoNaoPodeRegistrarChegada(mov, dados.placaCavalo, dados.placaCarreta, dados.placaCarreta2);
  if (motivo) throw new ErroRegraNegocio(motivo);

  // Condição no WHERE: se duas pessoas registrarem juntas, só uma vence (e só ela avisa o Pátio).
  const r = await prisma.movimentacao.updateMany({
    where: { id, chegadaPortariaEm: null, carretaLiberadaEm: null, saidaPortariaEm: null },
    data: { ...paraBanco(dados), chegadaPortariaEm: new Date(), chegadaPortariaPor: atorNome },
  });
  if (r.count === 0) throw new ErroRegraNegocio('Não foi possível registrar: a situação mudou. Atualize a tela.');

  await registrarHistorico({ movimentacaoId: id, usuarioId: atorId, usuarioNome: `${atorNome} (portaria)`, acao: 'CARRETA_CHEGOU' });

  const placa = dados.placaCarreta ?? dados.placaCavalo;
  const destino = normalizarLocal(dados.destino ?? mov.destino) || 'Remetido';
  await enviarAvisoPush(
    {
      titulo: 'Carreta na portaria',
      corpo: `${destino}${placa ? ` · ${placa}` : ''}`,
      url: `/patio/remetidos/${id}/confirmar`,
    },
    'PATIO',
  );
}

/** Pátio: carregou e conferiu — libera a carreta para sair. Avisa a Portaria. */
export async function liberarCarreta(id: string): Promise<void> {
  const mov = await carregarRemetido(id);
  const motivo = motivoNaoPodeLiberar(mov);
  if (motivo) throw new ErroRegraNegocio(motivo);

  const r = await prisma.movimentacao.updateMany({
    where: { id, chegadaPortariaEm: { not: null }, carretaLiberadaEm: null, saidaPortariaEm: null },
    data: { carretaLiberadaEm: new Date(), carretaLiberadaPor: 'Pátio' },
  });
  if (r.count === 0) throw new ErroRegraNegocio('Não foi possível liberar: a situação mudou. Atualize a tela.');

  await registrarHistorico({ movimentacaoId: id, usuarioNome: 'Pátio', acao: 'CARRETA_LIBERADA' });

  const placa = mov.placaCarreta ?? mov.placaCavalo;
  const destino = normalizarLocal(mov.destino) || 'Remetido';
  await enviarAvisoPush(
    {
      titulo: 'Carreta liberada',
      corpo: `${destino}${placa ? ` · ${placa}` : ''}. Pode sair.`,
      url: '/portaria',
    },
    'PORTARIA',
  );
}

/** Pátio: liberou por engano — volta para "aguardando o Pátio". Só antes da Portaria confirmar a saída. */
export async function desfazerLiberacaoCarreta(id: string): Promise<void> {
  const mov = await carregarRemetido(id);
  if (mov.saidaPortariaEm) throw new ErroRegraNegocio('Esta carreta já saiu.');
  if (!mov.carretaLiberadaEm) return;
  await prisma.movimentacao.update({ where: { id }, data: { carretaLiberadaEm: null, carretaLiberadaPor: null } });
  await registrarHistorico({ movimentacaoId: id, usuarioNome: 'Pátio', acao: 'LIBERACAO_DESFEITA' });
}

/** Portaria: a carreta passou pela portaria — registra a hora de saída. */
export async function confirmarSaidaCarreta(id: string, atorNome: string, atorId?: string): Promise<void> {
  const mov = await carregarRemetido(id);
  const motivo = motivoNaoPodeConfirmarSaida(mov);
  if (motivo) throw new ErroRegraNegocio(motivo);

  const r = await prisma.movimentacao.updateMany({
    where: { id, carretaLiberadaEm: { not: null }, saidaPortariaEm: null },
    data: { saidaPortariaEm: new Date(), saidaPortariaPor: atorNome },
  });
  if (r.count === 0) throw new ErroRegraNegocio('Não foi possível confirmar: a situação mudou. Atualize a tela.');
  await registrarHistorico({ movimentacaoId: id, usuarioId: atorId, usuarioNome: `${atorNome} (portaria)`, acao: 'CARRETA_SAIU' });
}

/** Pátio: carretas que a Portaria registrou e que ainda esperam a liberação. */
export async function listarCarretasNaPortaria() {
  return prisma.movimentacao.findMany({
    where: { tipo: 'REMETIDO', chegadaPortariaEm: { not: null }, carretaLiberadaEm: null, saidaPortariaEm: null },
    select: {
      id: true,
      destino: true,
      origem: true,
      reservaPedido: true,
      placaCarreta: true,
      placaCavalo: true,
      transportadora: true,
      observacaoPortaria: true,
      chegadaPortariaEm: true,
      status: true,
    },
    orderBy: { chegadaPortariaEm: 'asc' },
  });
}

/** Estado e dados da Portaria de um remetido (usado pelo Pátio: aviso e pré-preenchimento). */
export async function dadosPortariaDoRemetido(id: string) {
  const m = await prisma.movimentacao.findUnique({
    where: { id },
    select: {
      placaCavalo: true,
      placaCarreta: true,
      transportadora: true,
      motoristaNome: true,
      chegadaPortariaEm: true,
      carretaLiberadaEm: true,
      carretaLiberadaPor: true,
      saidaPortariaEm: true,
      observacaoPortaria: true,
      status: true,
    },
  });
  return m ? { ...m, estado: estadoPortaria(m) } : null;
}

/** Dados para a ficha em PDF da Portaria (nenhuma medição). */
export async function buscarFichaPortaria(id: string) {
  const m = await prisma.movimentacao.findFirst({ where: { id, tipo: 'REMETIDO' }, select: SELECT_PORTARIA });
  if (!m) return null;
  const estado = estadoPortaria(m);
  return {
    modulo: 'REMETIDO' as const,
    situacao: { rotulo: ROTULO_ESTADO[estado], ok: estado === 'LIBERADA' || estado === 'SAIU' },
    destino: m.destino,
    origem: m.origem,
    reservaPedido: m.reservaPedido,
    numeroDocumento: m.numeroDocumento,
    tipoRemetido: m.remetidoDetalhe?.tipoRemetido ?? null,
    materialPrevisto: m.materialPrevisto,
    transportadora: m.transportadora,
    motoristaNome: m.motoristaNome,
    motoristaCpf: m.motoristaCpf,
    motoristaTelefone: m.motoristaTelefone,
    placaCarreta: m.placaCarreta,
    placaCarreta2: m.placaCarreta2,
    placaCavalo: m.placaCavalo,
    capacidadeCarga: m.capacidadeCarga ? Number(m.capacidadeCarga) : null,
    comprimentoCarreta: m.comprimentoCarreta ? Number(m.comprimentoCarreta) : null,
    chegadaEm: m.chegadaPortariaEm,
    carretaLiberadaEm: m.carretaLiberadaEm,
    carretaLiberadaPor: m.carretaLiberadaPor,
    saidaEm: m.saidaPortariaEm,
    saidaPor: m.saidaPortariaPor,
    observacao: m.observacaoPortaria,
  };
}

/**
 * Portaria: a carreta chegou e o Pátio NÃO tinha cadastrado o envio antes. A Portaria cria o envio
 * aqui mesmo, já com a chegada registrada. O Pátio recebe o aviso e depois confere as medidas
 * (mesma tela de confirmação de sempre). Destino e ao menos uma placa são obrigatórios.
 */
export async function criarEnvioPelaPortaria(
  dados: DadosPortaria & { destino: string },
  atorNome: string,
  atorId?: string,
): Promise<string> {
  const placa = dados.placaCarreta ?? dados.placaCarreta2 ?? dados.placaCavalo;
  if (!dados.placaCavalo && !dados.placaCarreta && !dados.placaCarreta2) {
    throw new ErroRegraNegocio('Informe ao menos uma placa (cavalo ou carreta) para registrar a chegada.');
  }
  const agora = new Date();
  const mov = await prisma.movimentacao.create({
    data: {
      clientId: crypto.randomUUID(),
      tipo: 'REMETIDO',
      tipoDocumento: 'NF',
      tipoTransporte: 'CAMINHAO',
      status: 'AGUARDANDO_CHEGADA',
      ...paraBanco(dados),
      destino: normalizarLocal(dados.destino),
      chegadaPortariaEm: agora,
      chegadaPortariaPor: atorNome,
      remetidoDetalhe: { create: { tipoRemetido: null } },
    },
    select: { id: true },
  });

  await registrarHistorico({ movimentacaoId: mov.id, usuarioId: atorId, usuarioNome: `${atorNome} (portaria)`, acao: 'PORTARIA_CRIOU_ENVIO' });
  await registrarHistorico({ movimentacaoId: mov.id, usuarioId: atorId, usuarioNome: `${atorNome} (portaria)`, acao: 'CARRETA_CHEGOU' });

  return mov.id;
}
