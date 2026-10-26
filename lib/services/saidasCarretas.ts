import { prisma } from '@/lib/db';

export type TipoSaida = 'CARGA' | 'DESCARGA';

export interface SaidaCarreta {
  id: string;
  tipo: TipoSaida;
  placas: string[];
  cidade: string | null;
  motoristaNome: string | null;
  transportadora: string | null;
  numeroDocumento: string | null;
  saidaEm: Date;
  saidaPor: string | null;
}

/** Só letras e números, em maiúsculas: "abc-1d23" encontra "ABC1D23". */
const soAlfanumerico = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const contem = (valor: string | null | undefined, termo: string) =>
  Boolean(valor && valor.toLowerCase().includes(termo.toLowerCase()));

/**
 * Carretas que já saíram: cargas (Remetido, com saída da Portaria) e descargas
 * (chegada de caminhão, com saída registrada). Busca opcional por placa, cidade ou motorista.
 */
export async function listarSaidasCarretas(busca: string, limite = 100): Promise<SaidaCarreta[]> {
  const termo = busca.trim();
  const placa = soAlfanumerico(termo);

  const [cargas, descargas] = await Promise.all([
    prisma.movimentacao.findMany({
      where: { tipo: 'REMETIDO', saidaPortariaEm: { not: null } },
      orderBy: { saidaPortariaEm: 'desc' },
      take: limite,
      select: {
        id: true, placaCavalo: true, placaCarreta: true, placaCarreta2: true, destino: true,
        motoristaNome: true, transportadora: true, numeroDocumento: true,
        saidaPortariaEm: true, saidaPortariaPor: true,
      },
    }),
    prisma.chegadaCaminhao.findMany({
      where: { saidaEm: { not: null } },
      orderBy: { saidaEm: 'desc' },
      take: limite,
      select: {
        id: true, placaCavalo: true, placaCarreta: true, placaCarreta2: true, origem: true,
        motoristaNome: true, transportadora: true,
        saidaEm: true, saidaPor: true,
      },
    }),
  ]);

  const todas: SaidaCarreta[] = [
    ...cargas.map((l) => ({
      id: l.id,
      tipo: 'CARGA' as const,
      placas: [l.placaCavalo, l.placaCarreta, l.placaCarreta2].filter((p): p is string => Boolean(p)),
      cidade: l.destino,
      motoristaNome: l.motoristaNome,
      transportadora: l.transportadora,
      numeroDocumento: l.numeroDocumento,
      saidaEm: l.saidaPortariaEm!,
      saidaPor: l.saidaPortariaPor,
    })),
    ...descargas.map((l) => ({
      id: l.id,
      tipo: 'DESCARGA' as const,
      placas: [l.placaCavalo, l.placaCarreta, l.placaCarreta2].filter((p): p is string => Boolean(p)),
      cidade: l.origem,
      motoristaNome: l.motoristaNome,
      transportadora: l.transportadora,
      numeroDocumento: null,
      saidaEm: l.saidaEm!,
      saidaPor: l.saidaPor,
    })),
  ];

  const filtradas = termo
    ? todas.filter(
        (s) =>
          (placa && s.placas.some((p) => soAlfanumerico(p).includes(placa))) ||
          contem(s.cidade, termo) ||
          contem(s.motoristaNome, termo),
      )
    : todas;

  return filtradas.sort((a, b) => b.saidaEm.getTime() - a.saidaEm.getTime()).slice(0, limite);
}
