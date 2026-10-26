import { prisma } from '@/lib/db';
import { enviarAvisoPush } from '@/lib/services/push';
import { normalizarLocal } from '@/lib/domain/local';

/** Primeiro lembrete: 20 min depois que o Pátio libera. Segundo: 15 min depois do primeiro. Depois disso, para. */
const PRIMEIRO_MIN = 20;
const INTERVALO_MIN = 15;
const MAXIMO_LEMBRETES = 2;

const MIN = 60 * 1000;

/**
 * Envia à Portaria os lembretes de saída pendente. Roda enquanto a tela da Portaria está aberta.
 * A troca de contador é condicional (updateMany com o valor lido), então dois aparelhos abertos
 * ao mesmo tempo não mandam o mesmo lembrete duas vezes.
 */
export async function enviarLembretesSaidaPendente(agora = new Date()): Promise<number> {
  const pendentes = await prisma.movimentacao.findMany({
    where: {
      tipo: 'REMETIDO',
      carretaLiberadaEm: { not: null },
      saidaPortariaEm: null,
      lembretesSaidaEnviados: { lt: MAXIMO_LEMBRETES },
    },
    select: {
      id: true,
      destino: true,
      placaCarreta: true,
      placaCavalo: true,
      carretaLiberadaEm: true,
      lembretesSaidaEnviados: true,
      ultimoLembreteSaidaEm: true,
    },
  });

  let enviados = 0;
  for (const m of pendentes) {
    const n = m.lembretesSaidaEnviados;
    const referencia = n === 0 ? m.carretaLiberadaEm! : m.ultimoLembreteSaidaEm!;
    const minutosDesde = n === 0 ? PRIMEIRO_MIN : INTERVALO_MIN;
    if (agora.getTime() < referencia.getTime() + minutosDesde * MIN) continue;

    const trocou = await prisma.movimentacao.updateMany({
      where: { id: m.id, lembretesSaidaEnviados: n, saidaPortariaEm: null },
      data: { lembretesSaidaEnviados: n + 1, ultimoLembreteSaidaEm: agora },
    });
    if (trocou.count === 0) continue;

    const placa = m.placaCarreta ?? m.placaCavalo;
    const destino = normalizarLocal(m.destino) || 'Carga';
    const minutos = Math.round((agora.getTime() - m.carretaLiberadaEm!.getTime()) / MIN);
    await enviarAvisoPush(
      {
        titulo: 'Registrar saída',
        corpo: `${destino}${placa ? ` · ${placa}` : ''}: liberada pelo Pátio há ${minutos} min e a saída ainda não foi registrada.`,
        url: '/portaria',
      },
      'PORTARIA',
    );
    enviados++;
  }
  return enviados;
}
