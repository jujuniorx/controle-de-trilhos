import { prisma } from '@/lib/db';
import { estadoChegada, estadoPortaria } from '@/lib/domain/portaria';

/**
 * Visão do Administrativo sobre o que a Portaria lançou. Só leitura; os dados (motorista,
 * placas, observação) são os mesmos que a Portaria preencheu. Medições não entram aqui.
 */

const LIMITE = 100;

export async function listarRemetidosDaPortaria() {
  const lista = await prisma.movimentacao.findMany({
    where: {
      tipo: 'REMETIDO',
      OR: [
        { chegadaPortariaEm: { not: null } },
        { carretaLiberadaEm: { not: null } },
        { motoristaNome: { not: null } },
        { placaCarreta: { not: null } },
        { placaCavalo: { not: null } },
        { observacaoPortaria: { not: null } },
      ],
    },
    select: {
      id: true,
      status: true,
      destino: true,
      reservaPedido: true,
      numeroDocumento: true,
      transportadora: true,
      motoristaNome: true,
      placaCarreta: true,
      placaCavalo: true,
      observacaoPortaria: true,
      chegadaPortariaEm: true,
      chegadaPortariaPor: true,
      carretaLiberadaEm: true,
      carretaLiberadaPor: true,
      saidaPortariaEm: true,
      saidaPortariaPor: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: LIMITE,
  });
  return lista.map((m) => ({ ...m, estado: estadoPortaria(m) }));
}

export async function listarChegadasDaPortaria() {
  const lista = await prisma.chegadaCaminhao.findMany({
    orderBy: { criadoEm: 'desc' },
    take: LIMITE,
    select: {
      id: true,
      origem: true,
      transportadora: true,
      motoristaNome: true,
      placaCarreta: true,
      placaCavalo: true,
      observacao: true,
      criadoPor: true,
      criadoEm: true,
      liberadaEm: true,
      liberadaPor: true,
      canceladaEm: true,
      movimentacaoId: true,
      saidaEm: true,
      saidaPor: true,
    },
  });
  return lista.map((c) => ({ ...c, estado: estadoChegada(c) }));
}
