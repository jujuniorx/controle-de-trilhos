import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export interface SaidaCarreta {
  id: string;
  placas: string[];
  destino: string | null;
  motoristaNome: string | null;
  transportadora: string | null;
  numeroDocumento: string | null;
  saidaEm: Date;
  saidaPor: string | null;
}

/** Só letras e números, em maiúsculas: "abc-1d23" encontra "ABC1D23". */
const soAlfanumerico = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

/**
 * Carretas que a Portaria já registrou como saídas (saidaPortariaEm preenchido).
 * Busca opcional por placa (cavalo ou carretas), cidade/destino ou motorista.
 */
export async function listarSaidasCarretas(busca: string, limite = 100): Promise<SaidaCarreta[]> {
  const termo = busca.trim();
  const filtros: Prisma.MovimentacaoWhereInput[] = [];
  if (termo) {
    const placa = soAlfanumerico(termo);
    if (placa) {
      filtros.push({ placaCavalo: { contains: placa, mode: 'insensitive' } });
      filtros.push({ placaCarreta: { contains: placa, mode: 'insensitive' } });
      filtros.push({ placaCarreta2: { contains: placa, mode: 'insensitive' } });
    }
    filtros.push({ destino: { contains: termo, mode: 'insensitive' } });
    filtros.push({ motoristaNome: { contains: termo, mode: 'insensitive' } });
  }

  const linhas = await prisma.movimentacao.findMany({
    where: {
      tipo: 'REMETIDO',
      saidaPortariaEm: { not: null },
      ...(filtros.length ? { OR: filtros } : {}),
    },
    orderBy: { saidaPortariaEm: 'desc' },
    take: limite,
    select: {
      id: true,
      placaCavalo: true,
      placaCarreta: true,
      placaCarreta2: true,
      destino: true,
      motoristaNome: true,
      transportadora: true,
      numeroDocumento: true,
      saidaPortariaEm: true,
      saidaPortariaPor: true,
    },
  });

  return linhas.map((l) => ({
    id: l.id,
    placas: [l.placaCavalo, l.placaCarreta, l.placaCarreta2].filter((p): p is string => Boolean(p)),
    destino: l.destino,
    motoristaNome: l.motoristaNome,
    transportadora: l.transportadora,
    numeroDocumento: l.numeroDocumento,
    saidaEm: l.saidaPortariaEm!,
    saidaPor: l.saidaPortariaPor,
  }));
}
