import { prisma } from '@/lib/db';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { registrarHistorico } from '@/lib/services/historico';
import { enviarAvisoPush } from '@/lib/services/push';
import { normalizarLocal } from '@/lib/domain/local';
import { estadoPortaria, motivoNaoPodeLiberar, ROTULO_ESTADO } from '@/lib/domain/portaria';
import type { DadosPortaria } from '@/lib/validation/portaria';

/**
 * Portaria (só Remetido). Fluxo: o Pátio cria o "aguardando chegada" e mede → marca "medição
 * concluída" → a Portaria preenche os dados do motorista/caminhão e libera a carreta → o Pátio
 * recebe o aviso. A Portaria NUNCA lê nem grava medições: as consultas abaixo só selecionam
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
  motoristaNome: true,
  motoristaCpf: true,
  motoristaTelefone: true,
  capacidadeCarga: true,
  materialPrevisto: true,
  medicaoConcluidaEm: true,
  carretaLiberadaEm: true,
  carretaLiberadaPor: true,
  observacaoPortaria: true,
  createdAt: true,
  remetidoDetalhe: { select: { tipoRemetido: true } },
} as const;

export async function listarPortaria() {
  const lista = await prisma.movimentacao.findMany({
    where: { tipo: 'REMETIDO', status: 'AGUARDANDO_CHEGADA' },
    select: SELECT_PORTARIA,
    orderBy: { createdAt: 'desc' },
  });
  return lista.map((m) => ({
    ...m,
    capacidadeCarga: m.capacidadeCarga ? Number(m.capacidadeCarga) : null,
    estado: estadoPortaria(m),
  }));
}

export type ItemPortaria = Awaited<ReturnType<typeof listarPortaria>>[number];

async function carregarAguardando(id: string) {
  const mov = await prisma.movimentacao.findUnique({ where: { id }, select: SELECT_PORTARIA });
  if (!mov || !mov.id) throw new ErroRegraNegocio('Remetido não encontrado.');
  if (mov.status !== 'AGUARDANDO_CHEGADA') throw new ErroRegraNegocio('Este remetido não está mais aguardando chegada.');
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
    placaCavalo: d.placaCavalo ?? null,
    capacidadeCarga: d.capacidadeCarga ?? null,
  };
}

export async function salvarDadosPortaria(id: string, dados: DadosPortaria, atorNome: string, atorId?: string): Promise<void> {
  await carregarAguardando(id);
  await prisma.movimentacao.update({ where: { id }, data: paraBanco(dados) });
  await registrarHistorico({ movimentacaoId: id, usuarioId: atorId, usuarioNome: `${atorNome} (portaria)`, acao: 'PORTARIA_DADOS' });
}

/** Salva os dados e libera a carreta. Exige medição concluída e ao menos uma placa. */
export async function liberarCarreta(id: string, dados: DadosPortaria, atorNome: string, atorId?: string): Promise<void> {
  const mov = await carregarAguardando(id);
  const motivo = motivoNaoPodeLiberar(mov, dados.placaCavalo, dados.placaCarreta);
  if (motivo) throw new ErroRegraNegocio(motivo);

  // updateMany com a condição no WHERE: se duas pessoas liberarem ao mesmo tempo, só uma vence
  // (e só ela dispara o aviso).
  const r = await prisma.movimentacao.updateMany({
    where: { id, status: 'AGUARDANDO_CHEGADA', carretaLiberadaEm: null, medicaoConcluidaEm: { not: null } },
    data: { ...paraBanco(dados), carretaLiberadaEm: new Date(), carretaLiberadaPor: atorNome },
  });
  if (r.count === 0) throw new ErroRegraNegocio('Não foi possível liberar: o remetido mudou de situação. Atualize a tela.');

  await registrarHistorico({ movimentacaoId: id, usuarioId: atorId, usuarioNome: `${atorNome} (portaria)`, acao: 'CARRETA_LIBERADA' });

  const placa = dados.placaCarreta ?? dados.placaCavalo;
  const destino = normalizarLocal(dados.destino ?? mov.destino) || 'Remetido';
  await enviarAvisoPush({
    titulo: 'Carreta liberada',
    corpo: `${destino}${placa ? ` — placa ${placa}` : ''}. Pode carregar.`,
    url: `/patio/remetidos/${id}/confirmar`,
  });
}

/** Pátio: terminou de medir; só falta a carreta chegar. */
export async function concluirMedicao(id: string): Promise<void> {
  const mov = await carregarAguardando(id);
  if (mov.medicaoConcluidaEm) return;
  await prisma.movimentacao.update({ where: { id }, data: { medicaoConcluidaEm: new Date() } });
  await registrarHistorico({ movimentacaoId: id, usuarioNome: 'Pátio', acao: 'MEDICAO_CONCLUIDA' });
}

/** Pátio: errou ou vai medir mais. Só antes da Portaria liberar. */
export async function reabrirMedicao(id: string): Promise<void> {
  const mov = await carregarAguardando(id);
  if (mov.carretaLiberadaEm) throw new ErroRegraNegocio('A carreta já foi liberada pela Portaria.');
  if (!mov.medicaoConcluidaEm) return;
  await prisma.movimentacao.update({ where: { id }, data: { medicaoConcluidaEm: null } });
  await registrarHistorico({ movimentacaoId: id, usuarioNome: 'Pátio', acao: 'MEDICAO_REABERTA' });
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
      medicaoConcluidaEm: true,
      carretaLiberadaEm: true,
      carretaLiberadaPor: true,
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
    situacao: { rotulo: ROTULO_ESTADO[estado], ok: estado === 'LIBERADA' },
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
    placaCavalo: m.placaCavalo,
    capacidadeCarga: m.capacidadeCarga ? Number(m.capacidadeCarga) : null,
    carretaLiberadaEm: m.carretaLiberadaEm,
    carretaLiberadaPor: m.carretaLiberadaPor,
    observacao: m.observacaoPortaria,
  };
}
