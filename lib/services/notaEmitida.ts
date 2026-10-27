import { prisma } from '@/lib/db';
import { enviarAvisoPush } from '@/lib/services/push';
import { normalizarLocal } from '@/lib/domain/local';
import { ErroRegraNegocio } from '@/lib/services/errors';

/** Admin recebe o aviso a cada 30 min; o Pátio, a cada 1 hora, até a nota ser confirmada. */
export const INTERVALO_ADMIN_MIN = 30;
export const INTERVALO_PATIO_MIN = 60;

const MIN = 60 * 1000;

/**
 * Carretas liberadas pelo Pátio cuja nota fiscal ainda não foi confirmada como emitida.
 * Pede para o disparo externo (cron) chamar a cada 30 min; cada aviso só sai quando o intervalo do destinatário passou.
 */
export async function enviarAvisosNotaPendente(agora = new Date()): Promise<{ admin: number; patio: number }> {
  const pendentes = await prisma.movimentacao.findMany({
    // Só depois da conferência: a nota só precisa ser emitida quando a movimentação estiver conferida.
    where: { tipo: 'REMETIDO', status: 'CONFERIDO', carretaLiberadaEm: { not: null }, notaEmitidaEm: null },
    select: {
      id: true,
      destino: true,
      placaCarreta: true,
      placaCavalo: true,
      ultimoAvisoNotaAdminEm: true,
      ultimoAvisoNotaPatioEm: true,
    },
  });

  const contagem = { admin: 0, patio: 0 };
  for (const m of pendentes) {
    const placa = m.placaCarreta ?? m.placaCavalo;
    const destino = normalizarLocal(m.destino) || 'Carga';
    const corpo = `${destino}${placa ? ` · ${placa}` : ''}: carreta liberada pelo Pátio e a nota fiscal ainda não foi emitida.`;

    if (devidoAgora(m.ultimoAvisoNotaAdminEm, INTERVALO_ADMIN_MIN, agora)) {
      const trocou = await prisma.movimentacao.updateMany({
        where: { id: m.id, notaEmitidaEm: null, ultimoAvisoNotaAdminEm: m.ultimoAvisoNotaAdminEm },
        data: { ultimoAvisoNotaAdminEm: agora },
      });
      if (trocou.count > 0) {
        await enviarAvisoPush({ titulo: 'Emitir nota fiscal', corpo, url: '/admin' }, 'ADMIN');
        contagem.admin++;
      }
    }

    if (devidoAgora(m.ultimoAvisoNotaPatioEm, INTERVALO_PATIO_MIN, agora)) {
      const trocou = await prisma.movimentacao.updateMany({
        where: { id: m.id, notaEmitidaEm: null, ultimoAvisoNotaPatioEm: m.ultimoAvisoNotaPatioEm },
        data: { ultimoAvisoNotaPatioEm: agora },
      });
      if (trocou.count > 0) {
        await enviarAvisoPush({ titulo: 'Nota fiscal pendente', corpo, url: '/patio/remetidos' }, 'PATIO');
        contagem.patio++;
      }
    }
  }
  return contagem;
}

/** Ainda não avisou, ou já passou o intervalo desde o último aviso. */
function devidoAgora(ultimo: Date | null, intervaloMin: number, agora: Date): boolean {
  return !ultimo || agora.getTime() >= ultimo.getTime() + intervaloMin * MIN;
}

/** A Bianca confirma que a nota da carreta foi emitida: os avisos param e o Pátio vê a confirmação. */
export async function confirmarNotaEmitida(movimentacaoId: string, usuario: { nome: string }): Promise<void> {
  const mov = await prisma.movimentacao.findFirst({
    where: { id: movimentacaoId, tipo: 'REMETIDO' },
    select: { carretaLiberadaEm: true, notaEmitidaEm: true },
  });
  if (!mov) throw new ErroRegraNegocio('Carreta não encontrada.');
  if (!mov.carretaLiberadaEm) throw new ErroRegraNegocio('A carreta ainda não foi liberada pelo Pátio.');
  if (mov.notaEmitidaEm) throw new ErroRegraNegocio('A nota desta carreta já foi confirmada.');

  await prisma.movimentacao.updateMany({
    where: { id: movimentacaoId, notaEmitidaEm: null },
    data: { notaEmitidaEm: new Date(), notaEmitidaPor: usuario.nome },
  });
}
