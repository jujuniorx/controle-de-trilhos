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
export interface FiltroSaidas {
  /** 'CARGA', 'DESCARGA' ou vazio para as duas. */
  tipo?: string;
  /** Quantos dias para trás (7, 30...). Vazio mostra tudo. */
  dias?: number;
}

export async function listarSaidasCarretas(busca: string, limite = 100, filtro: FiltroSaidas = {}): Promise<SaidaCarreta[]> {
  const termo = busca.trim();
  const placa = soAlfanumerico(termo);
  const desde = filtro.dias && filtro.dias > 0 ? new Date(Date.now() - filtro.dias * 24 * 60 * 60 * 1000) : null;

  const [cargas, descargas] = await Promise.all([
    prisma.movimentacao.findMany({
      where: { tipo: 'REMETIDO', saidaPortariaEm: desde ? { gte: desde } : { not: null } },
      orderBy: { saidaPortariaEm: 'desc' },
      take: limite,
      select: {
        id: true, placaCavalo: true, placaCarreta: true, placaCarreta2: true, destino: true,
        motoristaNome: true, transportadora: true, numeroDocumento: true,
        saidaPortariaEm: true, saidaPortariaPor: true,
      },
    }),
    prisma.chegadaCaminhao.findMany({
      where: { saidaEm: desde ? { gte: desde } : { not: null } },
      orderBy: { saidaEm: 'desc' },
      take: limite,
      select: {
        id: true, placaCavalo: true, placaCarreta: true, placaCarreta2: true, origem: true,
        motoristaNome: true, transportadora: true,
        saidaEm: true, saidaPor: true,
      },
    }),
  ]);

  /**
   * Placas rotuladas e sem repetição. Quando o mesmo número está salvo em dois campos
   * (acontece quando a 2ª carreta foi preenchida com a placa do cavalo), a lista mostrava
   * o mesmo número duas vezes e ninguém sabia qual era qual.
   */
  const placasDe = (cavalo: string | null, carreta: string | null, carreta2: string | null): string[] => {
    const vistas = new Set<string>();
    const saida: string[] = [];
    for (const [rotulo, valor] of [['Cavalo', cavalo], ['Carreta', carreta], ['Carreta 2', carreta2]] as const) {
      const limpo = valor?.trim().toUpperCase();
      if (!limpo || vistas.has(limpo)) continue;
      vistas.add(limpo);
      saida.push(`${rotulo} ${limpo}`);
    }
    return saida;
  };

  const todas: SaidaCarreta[] = [
    ...cargas.map((l) => ({
      id: l.id,
      tipo: 'CARGA' as const,
      placas: placasDe(l.placaCavalo, l.placaCarreta, l.placaCarreta2),
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
      placas: placasDe(l.placaCavalo, l.placaCarreta, l.placaCarreta2),
      cidade: l.origem,
      motoristaNome: l.motoristaNome,
      transportadora: l.transportadora,
      numeroDocumento: null,
      saidaEm: l.saidaEm!,
      saidaPor: l.saidaPor,
    })),
  ];

  const porTipo = filtro.tipo === 'CARGA' || filtro.tipo === 'DESCARGA' ? todas.filter((s) => s.tipo === filtro.tipo) : todas;
  const filtradas = termo
    ? porTipo.filter(
        (s) =>
          (placa && s.placas.some((p) => soAlfanumerico(p).includes(placa))) ||
          contem(s.cidade, termo) ||
          contem(s.motoristaNome, termo),
      )
    : porTipo;

  return filtradas.sort((a, b) => b.saidaEm.getTime() - a.saidaEm.getTime()).slice(0, limite);
}
