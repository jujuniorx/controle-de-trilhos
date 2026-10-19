// Relatório da usina — leitura e gravação dos lançamentos. Datas sempre como 'AAAA-MM-DD'.
import { prisma } from '@/lib/db';
import { intervaloDoPeriodo, inicioDaSemana, type Periodo } from '@/lib/usina/periodo';
import { somarDias, diasUteisNaUsina, conjuntoFeriados } from '@/lib/usina/diasUteis';

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

// ─── Geração de trilho ────────────────────────────────────────────────────────
export const LIDERES = [
  { valor: 'ALECIO', rotulo: 'Alécio' },
  { valor: 'BRUNO', rotulo: 'Bruno' },
  { valor: 'REGINALDO', rotulo: 'Reginaldo' },
] as const;
export type LiderValor = (typeof LIDERES)[number]['valor'];

export const META_GERACAO_MENSAL_M = 5000;

export async function geracaoDoPeriodo(periodo: Periodo, data: string) {
  const { inicio, fim } = intervaloDoPeriodo(periodo, data);
  const mes = intervaloDoPeriodo('mes', data);
  const [dias, doMes] = await Promise.all([
    prisma.geracaoDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } }, include: { carretas: { orderBy: { ordem: 'asc' } } } }),
    prisma.geracaoDia.findMany({ where: { data: { gte: dataBanco(mes.inicio), lte: dataBanco(mes.fim) } }, include: { carretas: { orderBy: { ordem: 'asc' } } } }),
  ]);
  // Corte vem da linha do dia; carregado, deixado e barras vêm das carretas (podem ser várias por dia).
  const soma = (lista: typeof dias, lider: LiderValor) => {
    const do_ = lista.filter((x) => x.lider === lider);
    const carretas = do_.flatMap((x) => x.carretas);
    const numC = (f: (c: (typeof carretas)[number]) => unknown) => carretas.reduce((acc, c) => acc + Number(f(c) ?? 0), 0);
    return {
      corteM: round2(do_.reduce((acc, x) => acc + Number(x.corteM ?? 0), 0)),
      carregamentoM: round2(numC((c) => c.carregamentoM)),
      deixadaViaM: round2(numC((c) => c.deixadaViaM)),
      quantidade: numC((c) => c.quantidade),
    };
  };
  return {
    inicio,
    fim,
    mesRotulo: mes,
    porLider: LIDERES.map((l) => {
      const periodoL = soma(dias, l.valor);
      const mesL = soma(doMes, l.valor);
      const totalMesM = mesL.carregamentoM + mesL.deixadaViaM;
      return {
        ...l,
        periodo: periodoL,
        mes: { ...mesL, totalM: round2(totalMesM), metaAlcancada: totalMesM >= META_GERACAO_MENSAL_M },
        lancamentoDia: dias.find((x) => x.lider === l.valor && iso(x.data) === data) ?? null,
      };
    }),
  };
}

export interface CarretaGeracaoValor {
  perfis: string[];
  quantidade: number | null;
  carregamentoM: number | null;
  deixadaViaM: number | null;
}

/** Grava o dia do líder: cabeçalho (local, corte, observação) e a lista de carretas, que substitui a anterior. */
export async function salvarGeracao(
  data: string,
  lider: LiderValor,
  v: { local: string | null; corteM: number | null; observacao: string | null; carretas: CarretaGeracaoValor[] },
) {
  const { carretas, ...cabecalho } = v;
  await prisma.$transaction(async (tx) => {
    const dia = await tx.geracaoDia.upsert({
      where: { data_lider: { data: dataBanco(data), lider } },
      update: cabecalho,
      create: { data: dataBanco(data), lider, ...cabecalho },
    });
    await tx.geracaoCarreta.deleteMany({ where: { geracaoDiaId: dia.id } });
    if (carretas.length > 0) {
      await tx.geracaoCarreta.createMany({
        data: carretas.map((c, i) => ({ geracaoDiaId: dia.id, ordem: i, ...c })),
      });
    }
  });
}

// ─── Composições ativas (W61 e W62) ───────────────────────────────────────────
export const COMPOSICOES = ['W61', 'W62'] as const;

export async function composicoesDoPeriodo(periodo: Periodo, data: string) {
  const { inicio, fim } = intervaloDoPeriodo(periodo, data);
  const linhas = await prisma.composicaoDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } } });
  return COMPOSICOES.map((c) => {
    const do_ = linhas.filter((x) => x.ativo === c);
    return {
      ativo: c,
      barras: do_.reduce((a, x) => a + (x.barras ?? 0), 0),
      jacares: do_.reduce((a, x) => a + (x.jacares ?? 0), 0),
      lancamentoDia: linhas.find((x) => x.ativo === c && iso(x.data) === data) ?? null,
    };
  });
}

export async function salvarComposicao(data: string, ativo: (typeof COMPOSICOES)[number], barras: number | null, jacares: number | null, observacao: string | null) {
  await prisma.composicaoDia.upsert({
    where: { data_ativo: { data: dataBanco(data), ativo } },
    update: { barras, jacares, observacao },
    create: { data: dataBanco(data), ativo, barras, jacares, observacao },
  });
}

// ─── Caminhão de solda (CW01 e CW02; CW03 entra depois) ───────────────────────
export const CAMINHOES_ATIVOS = ['CW01', 'CW02'] as const;

export async function caminhoesDoPeriodo(periodo: Periodo, data: string) {
  const { inicio, fim } = intervaloDoPeriodo(periodo, data);
  const ano = `${data.slice(0, 4)}-01-01`;
  const mes = intervaloDoPeriodo('mes', data);
  const [linhas, doMes, doAno] = await Promise.all([
    prisma.caminhaoSoldaDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } } }),
    prisma.caminhaoSoldaDia.findMany({ where: { data: { gte: dataBanco(mes.inicio), lte: dataBanco(mes.fim) } } }),
    prisma.caminhaoSoldaDia.findMany({ where: { data: { gte: dataBanco(ano), lte: dataBanco(`${data.slice(0, 4)}-12-31`) } } }),
  ]);
  const soma = (lista: typeof linhas, c: string) => {
    const do_ = lista.filter((x) => x.caminhao === c);
    return {
      producao: do_.reduce((a, x) => a + (x.producaoDiaria ?? 0), 0),
      perda: do_.reduce((a, x) => a + (x.perdaDiaria ?? 0), 0),
    };
  };
  return CAMINHOES_ATIVOS.map((c) => ({
    caminhao: c,
    periodo: soma(linhas, c),
    mes: soma(doMes, c),
    ano: soma(doAno, c),
    lancamentoDia: linhas.find((x) => x.caminhao === c && iso(x.data) === data) ?? null,
  }));
}

export async function salvarCaminhao(
  data: string,
  caminhao: (typeof CAMINHOES_ATIVOS)[number],
  v: { local: string | null; producaoDiaria: number | null; inicioMacro1: string | null; terminoMacro9: string | null; perdaDiaria: number | null },
) {
  await prisma.caminhaoSoldaDia.upsert({
    where: { data_caminhao: { data: dataBanco(data), caminhao } },
    update: v,
    create: { data: dataBanco(data), caminhao, ...v },
  });
}

// ─── Trilheiros (E40, E42, E46) ───────────────────────────────────────────────
export const TRILHEIROS = ['E40', 'E42', 'E46'] as const;

export async function trilheirosDoPeriodo(periodo: Periodo, data: string) {
  const { inicio, fim } = intervaloDoPeriodo(periodo, data);
  const [giros, manutencoes] = await Promise.all([
    prisma.trilheiroGiro.findMany({
      where: { OR: [{ boEm: { gte: dataBanco(inicio), lte: dataBanco(fim) } }, { partidaEm: { gte: dataBanco(inicio), lte: dataBanco(fim) } }] },
      orderBy: { boEm: 'desc' },
    }),
    prisma.trilheiroManutencao.findMany({
      where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } },
      orderBy: { data: 'desc' },
    }),
  ]);
  const feriados = conjuntoFeriados();
  const comTempo = giros
    .map((g) => ({ g, dias: diasUteisNaUsina(iso(g.chegadaUsinaEm), iso(g.partidaEm), feriados) }))
    .filter((x): x is { g: (typeof giros)[number]; dias: number } => x.dias !== null);
  const media = comTempo.length ? round2(comTempo.reduce((a, x) => a + x.dias, 0) / comTempo.length) : null;
  return { giros, manutencoes, mediaDiasUteisNaUsina: media, girosComTempo: comTempo.length };
}

export interface GiroValor {
  id?: string;
  trilheiro: (typeof TRILHEIROS)[number];
  boEm: string | null;
  chegadaUsinaEm: string | null;
  partidaEm: string | null;
  retornoEm: string | null;
  perfis: TipoTlsValor[];
  carregados: number;
  descarregados: number;
  local: string | null;
  observacao: string | null;
}

/** Ciclos ainda em aberto (sem retorno finalizado), de todos os trilheiros. */
export async function listarCiclosAbertos() {
  const abertos = await prisma.trilheiroGiro.findMany({
    where: { retornoEm: null },
    orderBy: { criadoEm: 'asc' },
  });
  // Um ciclo aberto por trilheiro: se houver mais de um por engano, vale o mais recente.
  const porTrilheiro = new Map<string, (typeof abertos)[number]>();
  for (const g of abertos) porTrilheiro.set(g.trilheiro, g);
  return TRILHEIROS.map((t) => porTrilheiro.get(t) ?? null);
}

/**
 * Salva um giro. Enquanto o trilheiro tem ciclo em aberto (retorno não finalizado),
 * os lançamentos caem nesse mesmo ciclo. Datas de B.O., chegada e partida só são
 * gravadas uma vez: depois de preenchidas, não mudam. Ao preencher o retorno, o ciclo
 * fecha e o próximo lançamento abre um novo.
 */
export async function salvarGiro(v: GiroValor) {
  const dataOuNull = (x: string | null) => (x ? dataBanco(x) : null);
  const aberto = v.id
    ? null
    : await prisma.trilheiroGiro.findFirst({ where: { trilheiro: v.trilheiro, retornoEm: null }, orderBy: { criadoEm: 'desc' } });
  const alvoId = v.id ?? aberto?.id;

  if (alvoId) {
    const atual = await prisma.trilheiroGiro.findUniqueOrThrow({ where: { id: alvoId } });
    await prisma.trilheiroGiro.update({
      where: { id: alvoId },
      data: {
        // Datas da primeira vez: se já estavam preenchidas, mantém.
        boEm: atual.boEm ?? dataOuNull(v.boEm),
        chegadaUsinaEm: atual.chegadaUsinaEm ?? dataOuNull(v.chegadaUsinaEm),
        partidaEm: atual.partidaEm ?? dataOuNull(v.partidaEm),
        retornoEm: dataOuNull(v.retornoEm),
        perfis: v.perfis,
        carregados: v.carregados,
        descarregados: v.descarregados,
        local: v.local,
        observacao: v.observacao,
      },
    });
    return;
  }

  await prisma.trilheiroGiro.create({
    data: {
      trilheiro: v.trilheiro,
      boEm: dataOuNull(v.boEm),
      chegadaUsinaEm: dataOuNull(v.chegadaUsinaEm),
      partidaEm: dataOuNull(v.partidaEm),
      retornoEm: dataOuNull(v.retornoEm),
      perfis: v.perfis,
      carregados: v.carregados,
      descarregados: v.descarregados,
      local: v.local,
      observacao: v.observacao,
    },
  });
}

export async function salvarManutencaoTrilheiro(v: { data: string; trilheiro: (typeof TRILHEIROS)[number]; local: string | null; tipo: string | null; detalhamento: string | null }) {
  await prisma.trilheiroManutencao.create({ data: { ...v, data: dataBanco(v.data) } });
}
