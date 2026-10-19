import { prisma } from '@/lib/db';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { enviarAvisoPush } from '@/lib/services/push';
import { motivoNaoPodeConfirmarSaidaChegada } from '@/lib/domain/portaria';
import { normalizarLocal } from '@/lib/domain/local';
import { estadoChegada, motivoNaoPodeLiberarChegada, motivoNaoPodeMarcarCarregada, ROTULO_ESTADO_CHEGADA } from '@/lib/domain/portaria';
import type { DadosChegada } from '@/lib/validation/chegada';

/**
 * Portaria — Recebimento. O caminhão chega, a Portaria cadastra os dados e registra a chegada
 * (o Pátio é avisado); o Pátio descarrega e faz o recebimento (medição) já com os dados
 * preenchidos, o que avisa a Portaria de que pode sair; a Portaria confirma a saída (com hora).
 * Nenhuma medição passa por aqui.
 */

const num = (d: unknown) => (d == null ? null : Number(d));

/** Dia de hoje (AAAA-MM-DD) no fuso de São Paulo. */
function diaHoje(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Próximo número de ordem do dia: o maior já dado + 1. */
async function proximaOrdemDoDia(dia: string): Promise<number> {
  const maior = await prisma.chegadaCaminhao.aggregate({ where: { ordemData: dia }, _max: { ordemDia: true } });
  return (maior._max.ordemDia ?? 0) + 1;
}

function paraBanco(d: DadosChegada) {
  return {
    origem: d.origem ? normalizarLocal(d.origem) : null,
    materialPrevisto: d.materialPrevisto ?? null,
    observacao: d.observacao ?? null,
    transportadora: d.transportadora ?? null,
    motoristaNome: d.motoristaNome ?? null,
    motoristaCpf: d.motoristaCpf ?? null,
    motoristaTelefone: d.motoristaTelefone ?? null,
    placaCarreta: d.placaCarreta ?? null,
    placaCarreta2: d.placaCarreta2 ?? null,
    placaCavalo: d.placaCavalo ?? null,
    capacidadeCarga: d.capacidadeCarga ?? null,
    comprimentoCarreta: d.comprimentoCarreta ?? null,
    cargaDescarga: d.cargaDescarga ?? false,
    destinoCarga: d.cargaDescarga && d.destinoCarga ? normalizarLocal(d.destinoCarga) || null : null,
  };
}

async function carregarAberta(id: string) {
  const c = await prisma.chegadaCaminhao.findUnique({ where: { id } });
  if (!c) throw new ErroRegraNegocio('Chegada não encontrada.');
  const estado = estadoChegada(c);
  if (estado === 'CANCELADA') throw new ErroRegraNegocio('Esta chegada foi cancelada.');
  if (estado === 'SAIU') throw new ErroRegraNegocio('Este caminhão já saiu.');
  if (estado === 'RECEBIDA') throw new ErroRegraNegocio('O Pátio já descarregou este caminhão.');
  return c;
}

/**
 * Pátio: os trilhos já foram descarregados e o caminhão precisa sair, mas a medição fica para depois.
 * Libera a saída (a Portaria confirma) sem exigir o recebimento. A medição continua pelo "Novo recebimento".
 */
export async function marcarChegadaDescarregada(id: string, atorNome: string): Promise<void> {
  const c = await prisma.chegadaCaminhao.findUnique({ where: { id } });
  if (!c) throw new ErroRegraNegocio('Chegada não encontrada.');
  if (c.canceladaEm) throw new ErroRegraNegocio('Esta chegada foi cancelada.');
  if (!c.liberadaEm) throw new ErroRegraNegocio('A Portaria ainda não registrou a chegada deste caminhão.');
  if (c.descarregadaEm || c.movimentacaoId) return;
  const r = await prisma.chegadaCaminhao.updateMany({
    where: { id, liberadaEm: { not: null }, canceladaEm: null, movimentacaoId: null, descarregadaEm: null },
    data: { descarregadaEm: new Date(), descarregadaPor: atorNome },
  });
  if (r.count === 0) throw new ErroRegraNegocio('Não foi possível concluir: a situação mudou. Atualize a tela.');
}

/** Pátio, carga e descarga: o caminhão foi carregado e a medição da carga é registrada. Libera a saída para a Portaria. */
export async function marcarChegadaCarregada(id: string, medidaM: number | null, atorNome: string): Promise<void> {
  const c = await prisma.chegadaCaminhao.findUnique({ where: { id } });
  if (!c) throw new ErroRegraNegocio('Chegada não encontrada.');
  const motivo = motivoNaoPodeMarcarCarregada(c, medidaM);
  if (motivo || medidaM === null) throw new ErroRegraNegocio(motivo ?? 'Informe a medição da carga.');
  const r = await prisma.chegadaCaminhao.updateMany({
    where: { id, cargaDescarga: true, cargaCarregadaEm: null, saidaEm: null, canceladaEm: null, descarregadaEm: { not: null } },
    data: { cargaCarregadaEm: new Date(), cargaCarregadaPor: atorNome, cargaMedidaM: medidaM },
  });
  if (r.count === 0) throw new ErroRegraNegocio('Não foi possível concluir: a situação mudou. Atualize a tela.');
}

export async function criarChegada(atorNome: string): Promise<{ id: string }> {
  const c = await prisma.chegadaCaminhao.create({ data: { criadoPor: atorNome } });
  return { id: c.id };
}

export async function listarChegadasPortaria() {
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const lista = await prisma.chegadaCaminhao.findMany({
    where: { canceladaEm: null, OR: [{ saidaEm: null }, { saidaEm: { gte: ontem } }] },
    orderBy: { criadoEm: 'desc' },
  });
  return lista.map((c) => ({ ...c, capacidadeCarga: num(c.capacidadeCarga), estado: estadoChegada(c) }));
}
export type ItemChegada = Awaited<ReturnType<typeof listarChegadasPortaria>>[number];

export async function salvarDadosChegada(id: string, dados: DadosChegada): Promise<void> {
  await carregarAberta(id);
  await prisma.chegadaCaminhao.update({ where: { id }, data: paraBanco(dados) });
}

export async function liberarChegada(id: string, dados: DadosChegada, atorNome: string): Promise<void> {
  const c = await carregarAberta(id);
  const motivo = motivoNaoPodeLiberarChegada(c, dados.placaCavalo, dados.placaCarreta, dados.placaCarreta2);
  if (motivo) throw new ErroRegraNegocio(motivo);

  // Condição no WHERE: se duas pessoas liberarem juntas, só uma vence (e só ela avisa o Pátio).
  const dia = diaHoje();
  const ordemDia = await proximaOrdemDoDia(dia);
  const r = await prisma.chegadaCaminhao.updateMany({
    where: { id, liberadaEm: null, canceladaEm: null, movimentacaoId: null },
    data: { ...paraBanco(dados), liberadaEm: new Date(), liberadaPor: atorNome, ordemDia, ordemData: dia },
  });
  if (r.count === 0) throw new ErroRegraNegocio('Não foi possível liberar: a chegada mudou de situação. Atualize a tela.');

  const placa = dados.placaCarreta ?? dados.placaCavalo;
  const origem = dados.origem ? normalizarLocal(dados.origem) : '';
  await enviarAvisoPush(
    {
      titulo: 'Caminhão chegou na Portaria',
      corpo: `${origem || 'Recebimento'}${placa ? ` — placa ${placa}` : ''}. Pode descarregar.`,
      url: `/patio/recebimentos/novo?chegada=${id}`,
    },
    'PATIO',
  );
}

/** Portaria: o caminhão (já descarregado pelo Pátio) passou pela portaria — registra a hora de saída. */
export async function confirmarSaidaChegada(id: string, atorNome: string): Promise<void> {
  const c = await prisma.chegadaCaminhao.findUnique({ where: { id } });
  if (!c) throw new ErroRegraNegocio('Chegada não encontrada.');
  const motivo = motivoNaoPodeConfirmarSaidaChegada(c);
  if (motivo) throw new ErroRegraNegocio(motivo);
  const r = await prisma.chegadaCaminhao.updateMany({
    where: { id, saidaEm: null, canceladaEm: null, OR: [{ movimentacaoId: { not: null } }, { descarregadaEm: { not: null } }] },
    data: { saidaEm: new Date(), saidaPor: atorNome },
  });
  if (r.count === 0) throw new ErroRegraNegocio('Não foi possível confirmar: a situação mudou. Atualize a tela.');
}

/** Portaria: muda o número de ordem do caminhão (o automático é o próximo do dia). */
export async function definirOrdemChegada(id: string, ordem: number): Promise<void> {
  if (!Number.isInteger(ordem) || ordem < 1 || ordem > 999) throw new ErroRegraNegocio('O número de ordem deve ser de 1 a 999.');
  const c = await prisma.chegadaCaminhao.findUnique({ where: { id } });
  if (!c) throw new ErroRegraNegocio('Chegada não encontrada.');
  if (c.canceladaEm) throw new ErroRegraNegocio('Esta chegada foi cancelada.');
  await prisma.chegadaCaminhao.update({ where: { id }, data: { ordemDia: ordem, ordemData: c.ordemData ?? diaHoje() } });
}

/** Cancela uma chegada que ainda não foi descarregada (cadastrada por engano, caminhão foi embora). */
export async function cancelarChegada(id: string): Promise<void> {
  await carregarAberta(id);
  await prisma.chegadaCaminhao.update({ where: { id }, data: { canceladaEm: new Date() } });
}

/** Pátio: caminhões liberados para descarregar que ainda não viraram recebimento. */
export async function listarChegadasLiberadas() {
  return prisma.chegadaCaminhao.findMany({
    where: { liberadaEm: { not: null }, canceladaEm: null, movimentacaoId: null },
    select: { id: true, origem: true, transportadora: true, placaCarreta: true, placaCavalo: true, liberadaEm: true, materialPrevisto: true, observacao: true, descarregadaEm: true, saidaEm: true, ordemDia: true, ordemData: true, cargaDescarga: true, destinoCarga: true, cargaCarregadaEm: true },
    orderBy: [{ ordemData: 'asc' }, { ordemDia: 'asc' }, { liberadaEm: 'asc' }],
  });
}

/** Pátio: dados para pré-preencher o recebimento. Só devolve se estiver liberada e aberta. */
export async function buscarChegadaLiberada(id: string) {
  const c = await prisma.chegadaCaminhao.findUnique({ where: { id } });
  // Liberada pela Portaria e ainda sem recebimento (inclusive se o Pátio já descarregou e o caminhão saiu).
  if (!c || !c.liberadaEm || c.canceladaEm || c.movimentacaoId) return null;
  return {
    id: c.id,
    origem: c.origem ?? '',
    placaCavalo: c.placaCavalo ?? '',
    placaCarreta: c.placaCarreta ?? '',
    transportadora: c.transportadora ?? '',
    observacao: c.observacao ?? '',
  };
}

/** Administrativo: dados da Portaria de um recebimento já feito. */
export async function buscarChegadaDoRecebimento(movimentacaoId: string) {
  const c = await prisma.chegadaCaminhao.findUnique({ where: { movimentacaoId } });
  return c ? { ...c, capacidadeCarga: num(c.capacidadeCarga) } : null;
}

/** Dados da ficha em PDF da chegada. */
export async function buscarFichaChegada(id: string) {
  const c = await prisma.chegadaCaminhao.findUnique({ where: { id } });
  if (!c) return null;
  const estado = estadoChegada(c);
  return {
    modulo: 'RECEBIMENTO' as const,
    situacao: { rotulo: ROTULO_ESTADO_CHEGADA[estado], ok: estado === 'RECEBIDA' || estado === 'SAIU' },
    destino: null,
    origem: c.origem,
    reservaPedido: null,
    numeroDocumento: null,
    tipoRemetido: null,
    materialPrevisto: c.materialPrevisto,
    transportadora: c.transportadora,
    motoristaNome: c.motoristaNome,
    motoristaCpf: c.motoristaCpf,
    motoristaTelefone: c.motoristaTelefone,
    placaCarreta: c.placaCarreta,
    placaCarreta2: c.placaCarreta2,
    placaCavalo: c.placaCavalo,
    capacidadeCarga: num(c.capacidadeCarga),
    comprimentoCarreta: num(c.comprimentoCarreta),
    chegadaEm: c.liberadaEm,
    carretaLiberadaEm: null,
    carretaLiberadaPor: null,
    saidaEm: c.saidaEm,
    saidaPor: c.saidaPor,
    observacao: c.observacao,
  };
}
