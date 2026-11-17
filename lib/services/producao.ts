import { prisma } from '@/lib/db';
import { FABRICANTE_REEMPREGO, SOLDAS_POR_TLS, contarTls, descontarBarras } from '@/lib/producaoTls';

/** Soldas que formam 1 TLS de trilho novo (312 m). No reemprego o número varia: ver lib/producaoTls. */
export { FABRICANTE_REEMPREGO, SOLDAS_POR_TLS };

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
/** Resposta "TLS encerrado?" da hora (reemprego), guardada junto das paradas: 'sim:31', 'nao:28' ou ''. */
export function respostaTlsDaLinha(texto: string | null | undefined): string {
  try {
    const v = JSON.parse(texto || '[]');
    const item = Array.isArray(v) ? v.find((p) => p && typeof p.tls === 'string') : null;
    return item ? String(item.tls) : '';
  } catch {
    return '';
  }
}
/** Paradas que já começaram e ainda não têm fim (o Administrativo mostra ao vivo). Guardadas junto das paradas. */
export interface ParadaAberta { inicio: string; descricao: string | null }
export function paradasEmAndamento(texto: string | null | undefined): ParadaAberta[] {
  try {
    const v = JSON.parse(texto || '[]');
    return Array.isArray(v) ? v.filter((p) => p && p.andamento === true && typeof p.inicio === 'string').map((p) => ({ inicio: p.inicio, descricao: p.descricao ?? null })) : [];
  } catch {
    return [];
  }
}
export const METROS_POR_TLS = 312;
export const PERFIS_PRODUCAO = ['TR60', 'TR68', 'UIC60'] as const;
export const FABRICANTES_PRODUCAO = ['Nippon', 'Evraz', 'Pangang 4', 'Pangang 5', 'Arcelormittal', 'UHCX', 'Reemprego'] as const;

export interface LinhaProducao {
  hora: string;
  soldas: number;
  cortes: number;
  justificativaCorte: string | null;
  paradas: Parada[];
  perfil: string;
  fabricante: string;
  /** Resposta "TLS encerrado?" (reemprego). */
  tls?: string | null;
  /** Paradas com início e ainda sem fim. */
  andamento?: ParadaAberta[];
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
 * No reemprego o TLS só fecha na hora em que o soldador respondeu que encerrou.
 */
export async function recalcularAPartir(_desde: Date): Promise<void> {
  // Refaz a conta de todos os dias em ordem: o TLS é contado no dia em que começou,
  // mesmo que feche em um dia seguinte (a solda de hoje fecha o TLS de ontem, que conta para ontem).
  const dias = await prisma.producaoDia.findMany({ orderBy: { data: 'asc' }, include: { linhas: { orderBy: { hora: 'asc' } } } });
  const creditos = new Map<string, number>();
  const credita = (id: string, n: number) => creditos.set(id, (creditos.get(id) ?? 0) + n);
  const contas: { id: string; entrada: number; total: number; saida: number; inicio: Date | null }[] = [];
  let sobra = 0;
  let inicioSobra: string | null = null; // dia em que começou o TLS que está em aberto
  let inicioSobraData: Date | null = null; // mesmo dia, como data para gravar
  for (const d of dias) {
    const total = d.linhas.reduce((t, l) => t + l.soldas, 0);
    const horasTls = d.linhas.map((l) => ({ soldas: l.soldas, fabricante: l.fabricante, perfil: l.perfil, resposta: respostaTlsDaLinha(l.paradas) }));
    const { tls, sobra: novaSobra } = contarTls(sobra, descontarBarras(horasTls, d.ajusteTls));
    if (tls > 0) {
      if (sobra > 0 && inicioSobra) {
        // O primeiro TLS fechado hoje é o que já estava aberto de antes: conta no dia em que começou.
        credita(inicioSobra, 1);
        credita(d.id, tls - 1);
      } else {
        credita(d.id, tls);
      }
    }
    if (novaSobra > 0) {
      // Se fechou algum TLS hoje, ou não havia nada aberto, o TLS em aberto começou hoje.
      if (tls > 0 || sobra === 0 || !inicioSobra) {
        inicioSobra = d.id;
        inicioSobraData = d.data;
      }
    } else {
      inicioSobra = null;
      inicioSobraData = null;
    }
    contas.push({ id: d.id, entrada: sobra, total, saida: novaSobra, inicio: inicioSobraData });
    sobra = novaSobra;
  }
  for (const c of contas) {
    const d = dias.find((x) => x.id === c.id)!;
    const tlsFormados = creditos.get(c.id) ?? 0;
    const inicioAtual = d.inicioSobra?.getTime() ?? null;
    if (d.sobraEntrada === c.entrada && d.totalSoldas === c.total && d.tlsFormados === tlsFormados && d.sobraSaida === c.saida && inicioAtual === (c.inicio?.getTime() ?? null)) continue;
    await prisma.producaoDia.update({
      where: { id: c.id },
      data: { sobraEntrada: c.entrada, totalSoldas: c.total, tlsFormados, sobraSaida: c.saida, inicioSobra: c.inicio },
    });
  }
}

/** Grava ou corrige o dia e refaz as contas dos dias seguintes. */
export async function salvarDiaProducao(dados: DadosDia): Promise<void> {
  const linhas = dados.linhas.filter((l) => l.soldas > 0 || l.cortes > 0 || l.paradas.length > 0 || (l.andamento?.length ?? 0) > 0);
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
        paradas: JSON.stringify([
          ...l.paradas,
          ...(l.andamento ?? []).map((p) => ({ andamento: true, inicio: p.inicio, descricao: p.descricao })),
          ...(l.tls ? [{ tls: l.tls }] : []),
        ]),
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

/** Soldas que sobraram em aberto do último dia lançado antes desta data. */
export async function sobraAntesDe(data: Date): Promise<number> {
  const anterior = await prisma.producaoDia.findFirst({ where: { data: { lt: data } }, orderBy: { data: 'desc' } });
  return anterior?.sobraSaida ?? 0;
}

/** Sobra do último dia lançado antes desta data, com a data desse dia (para dizer "de sexta", "de ontem"). */
export async function sobraAnteriorCom(data: Date): Promise<{ sobra: number; data: Date | null }> {
  const anterior = await prisma.producaoDia.findFirst({ where: { data: { lt: data } }, orderBy: { data: 'desc' } });
  // A origem é o dia em que começou o TLS que ficou aberto (gravado no recálculo de cada dia).
  return { sobra: anterior?.sobraSaida ?? 0, data: anterior?.inicioSobra ?? null };
}

/** Administrativo: barras soldadas a mais e cortadas depois, descontadas da conta do TLS deste dia. */
export async function ajustarBarrasDoDia(data: Date, barras: number, motivo: string) {
  const dia = await prisma.producaoDia.findUnique({ where: { data } });
  if (!dia) throw new Error('Esse dia ainda não tem lançamento da Produção.');
  await prisma.producaoDia.update({ where: { id: dia.id }, data: { ajusteTls: barras, ajusteTlsMotivo: motivo || null } });
  await recalcularAPartir(data);
}

export async function buscarDia(data: Date) {
  return prisma.producaoDia.findUnique({ where: { data }, include: { linhas: { orderBy: { hora: 'asc' } } } });
}

/**
 * Soldas e cortes do ano inteiro, como estão na Usina (estaleiro): é o número que o Administrativo já usa.
 * Os dias contados são os que têm soldas lançadas.
 */
export async function totaisDoAno(ano: number): Promise<{ soldas: number; cortes: number; dias: number }> {
  const faixa = { gte: new Date(`${ano}-01-01T00:00:00Z`), lte: new Date(`${ano}-12-31T00:00:00Z`) };
  const [soma, comSoldas] = await Promise.all([
    prisma.estaleiroDia.aggregate({ where: { data: faixa }, _sum: { soldas: true, cortes: true } }),
    prisma.estaleiroDia.count({ where: { data: faixa, soldas: { gt: 0 } } }),
  ]);
  return {
    soldas: soma._sum.soldas ?? 0,
    cortes: soma._sum.cortes ?? 0,
    dias: comSoldas,
  };
}

export interface DiaDoPeriodo {
  data: string;
  soldas: number;
  tlsFormados: number;
  cortes: number;
  paradaMin: number;
  soldadores: string;
}

export interface ResumoPeriodo {
  dias: DiaDoPeriodo[];
  soldas: number;
  tlsFormados: number;
  cortes: number;
  paradaMin: number;
  diasComLancamento: number;
}

/** Soma de soldas, TLS formados, cortes e paradas entre duas datas (inclusive), dia a dia. */
export async function resumoPeriodo(de: Date, ate: Date): Promise<ResumoPeriodo> {
  const linhas = await prisma.producaoDia.findMany({
    where: { data: { gte: de, lte: ate } },
    orderBy: { data: 'asc' },
    include: { linhas: true },
  });
  const dias: DiaDoPeriodo[] = linhas.map((d) => ({
    data: d.data.toISOString().slice(0, 10),
    soldas: d.totalSoldas,
    tlsFormados: d.tlsFormados,
    cortes: d.linhas.reduce((t, l) => t + l.cortes, 0),
    paradaMin: d.linhas.reduce((t, l) => t + paradasDaLinha(l.paradas).reduce((s, p) => s + p.minutos, 0), 0),
    soldadores: d.soldadores,
  }));
  const soma = (f: (d: DiaDoPeriodo) => number) => dias.reduce((t, d) => t + f(d), 0);
  return {
    dias,
    soldas: soma((d) => d.soldas),
    tlsFormados: soma((d) => d.tlsFormados),
    cortes: soma((d) => d.cortes),
    paradaMin: soma((d) => d.paradaMin),
    diasComLancamento: dias.filter((d) => d.soldas > 0).length,
  };
}
