// Relatório da usina — leitura e gravação dos lançamentos. Datas sempre como 'AAAA-MM-DD'.
import { prisma } from '@/lib/db';
import { intervaloDoPeriodo, inicioDaSemana, type Periodo } from '@/lib/usina/periodo';
import { somarDias } from '@/lib/usina/diasUteis';

export const TIPOS_TLS = ['UIC60_REEMPREGO', 'UIC60_NOVO', 'GB60_REEMPREGO', 'TR68_REEMPREGO', 'TR68_NOVO'] as const;
export type TipoTlsValor = (typeof TIPOS_TLS)[number];

export const ROTULO_TLS: Record<TipoTlsValor, string> = {
  UIC60_REEMPREGO: 'UIC 60 reemprego',
  UIC60_NOVO: 'UIC 60 novo',
  GB60_REEMPREGO: 'GB 60 reemprego',
  TR68_REEMPREGO: 'TR68 reemprego',
  TR68_NOVO: 'TR68 novo',
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const dataBanco = (s: string) => new Date(`${s}T00:00:00Z`);

export async function estaleiroDoPeriodo(periodo: Periodo, data: string) {
  const { inicio, fim } = intervaloDoPeriodo(periodo, data);
  const semana = inicioDaSemana(data);

  const [dias, estoque, manutencao, escala, carreta] = await Promise.all([
    prisma.estaleiroDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } }, orderBy: { data: 'asc' } }),
    prisma.estoqueTlsDia.findMany({ where: { data: dataBanco(data) } }),
    prisma.manutencaoSemana.findUnique({ where: { semanaInicio: dataBanco(semana) } }),
    prisma.escalaSemana.findUnique({ where: { semanaInicio: dataBanco(semana) } }),
    carregamentoCarretaDoPeriodo(inicio, fim),
  ]);

  const soldasNoDia = (d: string) => dias.find((x) => iso(x.data) === d);
  const totais = dias.reduce(
    (acc, d) => ({ soldas: acc.soldas + (d.soldas ?? 0), cortes: acc.cortes + (d.cortes ?? 0) }),
    { soldas: 0, cortes: 0 },
  );

  return {
    inicio,
    fim,
    semana,
    diaDoLancamento: soldasNoDia(data) ?? null,
    totais,
    estoqueDoDia: Object.fromEntries(
      TIPOS_TLS.map((t) => [t, estoque.find((e) => e.tipo === t)?.quantidade ?? null]),
    ) as Record<TipoTlsValor, number | null>,
    manutencaoDia: iso(manutencao?.diaManutencao) ?? addSextaFeira(semana),
    escala: escala?.conteudo ?? '',
    carreta,
  };
}

/** Sexta-feira da semana (dia padrão da manutenção). */
export function addSextaFeira(semanaInicio: string): string {
  return somarDias(semanaInicio, 4);
}

/** O que saiu da usina nos remetidos do período: tampão (quantidade), trilho novo (m) e sucata (t). */
export async function carregamentoCarretaDoPeriodo(inicio: string, fim: string) {
  const grupos = await prisma.grupo.findMany({
    where: {
      movimentacao: {
        tipo: 'REMETIDO',
        dataMovimentacao: { gte: dataBanco(inicio), lte: dataBanco(fim) },
      },
    },
    select: { tampao: true, tipoMaterial: true, metrosTotal: true, pesoInformado: true, pesoCalculado: true },
  });
  let tampoes = 0;
  let trilhoNovoM = 0;
  let sucataT = 0;
  for (const g of grupos) {
    if (g.tampao) tampoes++;
    if (g.tipoMaterial === 'NOVO') trilhoNovoM += Number(g.metrosTotal);
    if (g.tipoMaterial === 'SUCATA') sucataT += Number(g.pesoInformado ?? g.pesoCalculado ?? 0);
  }
  return { tampoes, trilhoNovoM: round2(trilhoNovoM), sucataT: round2(sucataT) };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function salvarEstaleiroDia(data: string, soldas: number | null, cortes: number | null) {
  await prisma.estaleiroDia.upsert({
    where: { data: dataBanco(data) },
    update: { soldas, cortes },
    create: { data: dataBanco(data), soldas, cortes },
  });
}

export async function salvarEstoqueTls(data: string, valores: Partial<Record<TipoTlsValor, number | null>>) {
  for (const tipo of TIPOS_TLS) {
    const q = valores[tipo];
    if (q == null) continue;
    await prisma.estoqueTlsDia.upsert({
      where: { data_tipo: { data: dataBanco(data), tipo } },
      update: { quantidade: q },
      create: { data: dataBanco(data), tipo, quantidade: q },
    });
  }
}

export async function salvarManutencaoSemana(semana: string, diaManutencao: string) {
  const dia = dataBanco(diaManutencao);
  await prisma.manutencaoSemana.upsert({
    where: { semanaInicio: dataBanco(inicioDaSemana(semana)) },
    update: { diaManutencao: dia },
    create: { semanaInicio: dataBanco(inicioDaSemana(semana)), diaManutencao: dia },
  });
}

export async function salvarEscalaSemana(semana: string, conteudo: string) {
  await prisma.escalaSemana.upsert({
    where: { semanaInicio: dataBanco(inicioDaSemana(semana)) },
    update: { conteudo },
    create: { semanaInicio: dataBanco(inicioDaSemana(semana)), conteudo },
  });
}
