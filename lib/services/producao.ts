import { prisma } from '@/lib/db';

/** Soldas que formam 1 TLS. Todo TLS tem 312 m. */
export const SOLDAS_POR_TLS = 12;

/** Tempo de parada no papel e na tela: "0:23" = 23 min, "1:05" = 65 min. Numero puro tambem vale (minutos). */
export function minutosDaParada(valor: string | null | undefined): number {
  const texto = (valor ?? '').trim();
  const hm = /^(\d{1,2}):(\d{1,2})$/.exec(texto);
  if (hm) return Number(hm[1]) * 60 + Math.min(Number(hm[2]), 59);
  const n = Math.floor(Number(texto.replace(',', '.')));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function paradaEmHoraMin(minutos: number | null | undefined): string {
  if (!minutos) return '';
  return `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, '0')}`;
}

/** Ate 3 paradas por hora, igual a planilha de papel. */
export const MAX_PARADAS_HORA = 3;
export interface Parada { inicio: string | null; minutos: number; descricao: string | null }

/** As paradas ficam guardadas como texto JSON na linha da hora. */
export function paradasDaLinha(texto: string | null | undefined): Parada[] {
  try {
    const v = JSON.parse(texto || '[]');
    return Array.isArray(v) ? v.filter((p) => p && typeof p.minutos === 'number') : [];
  } catch {
    return [];
  }
}
export const METROS_POR_TLS = 312;
export const PERFIS_PRODUCAO = ['TR60', 'TR68', 'UIC60'] as const;
export const FABRICANTES_PRODUCAO = ['Nippon', 'Evraz', 'Pangang', 'Arcelormittal', 'UHCX'] as const;

export interface LinhaProducao {
  hora: string;
  soldas: number;
  cortes: number;
  justificativaCorte: string | null;
  paradas: Parada[];
  perfil: string;
  fabricante: string;
}

export interface DadosDia {
  data: Date;
  soldadores: string;
  lider: string;
  perfil: string;
  fabricante: string;
  linhas: LinhaProducao[];
}

/** Horas do turno da produção. Sexta termina às 16h, então a faixa das 16h não entra. */
export function horasDoDia(data: Date): string[] {
  const dia = data.getUTCDay(); // 5 = sexta
  const fim = dia === 5 ? 16 : 17;
  const horas: string[] = [];
  for (let h = 7; h < fim; h++) horas.push(`${String(h).padStart(2, '0')}:00`);
  return horas;
}

/**
 * Recalcula TLS e sobra de todos os dias a partir de `desde`, em ordem.
 * A sobra de um dia vira a entrada do seguinte: 53 soldas = 4 TLS + sobra 5.
 */
export async function recalcularAPartir(desde: Date): Promise<void> {
  const anterior = await prisma.producaoDia.findFirst({ where: { data: { lt: desde } }, orderBy: { data: 'desc' } });
  let sobra = anterior?.sobraSaida ?? 0;
  const dias = await prisma.producaoDia.findMany({ where: { data: { gte: desde } }, orderBy: { data: 'asc' }, include: { linhas: true } });
  for (const d of dias) {
    const total = d.linhas.reduce((t, l) => t + l.soldas, 0);
    const acumulado = sobra + total;
    const tls = Math.floor(acumulado / SOLDAS_POR_TLS);
    const novaSobra = acumulado % SOLDAS_POR_TLS;
    await prisma.producaoDia.update({
      where: { id: d.id },
      data: { sobraEntrada: sobra, totalSoldas: total, tlsFormados: tls, sobraSaida: novaSobra },
    });
    sobra = novaSobra;
  }
}

/** Grava ou corrige o dia e refaz as contas dos dias seguintes. */
export async function salvarDiaProducao(dados: DadosDia): Promise<void> {
  const linhas = dados.linhas.filter((l) => l.soldas > 0 || l.cortes > 0 || l.paradas.length > 0);
  await prisma.producaoDia.upsert({
    where: { data: dados.data },
    create: { data: dados.data, soldadores: dados.soldadores, lider: dados.lider, perfil: dados.perfil, fabricante: dados.fabricante },
    update: { soldadores: dados.soldadores, lider: dados.lider, perfil: dados.perfil, fabricante: dados.fabricante },
  });
  const dia = await prisma.producaoDia.findUniqueOrThrow({ where: { data: dados.data } });
  await prisma.producaoLinha.deleteMany({ where: { diaId: dia.id } });
  if (linhas.length)
    await prisma.producaoLinha.createMany({
      data: linhas.map((l) => ({
        diaId: dia.id,
        hora: l.hora,
        soldas: l.soldas,
        cortes: l.cortes,
        justificativaCorte: l.justificativaCorte,
        perfil: l.perfil,
        fabricante: l.fabricante,
        paradas: JSON.stringify(l.paradas),
      })),
    });
  await recalcularAPartir(dados.data);
  // A Usina (Estaleiro de solda) recebe as soldas e os cortes do dia lancados na Producao.
  const soldas = dados.linhas.reduce((t, l) => t + l.soldas, 0);
  const cortes = dados.linhas.reduce((t, l) => t + l.cortes, 0);
  await prisma.estaleiroDia.upsert({
    where: { data: dados.data },
    create: { data: dados.data, soldas, cortes },
    update: { soldas, cortes },
  });
}

export async function buscarDia(data: Date) {
  return prisma.producaoDia.findUnique({ where: { data }, include: { linhas: { orderBy: { hora: 'asc' } } } });
}
