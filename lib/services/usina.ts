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

/** Segunda a quinta da semana, com soldas e cortes de cada dia (vazio quando ainda não lançado). */
export async function estaleiroDiasDaSemana(semana: string) {
  const fim = somarDias(semana, 3);
  const linhas = await prisma.estaleiroDia.findMany({ where: { data: { gte: dataBanco(semana), lte: dataBanco(fim) } } });
  return [0, 1, 2, 3].map((i) => {
    const d = somarDias(semana, i);
    const r = linhas.find((x) => iso(x.data) === d);
    return { data: d, soldas: r?.soldas ?? null, cortes: r?.cortes ?? null };
  });
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
    select: { classificacao: true, tipoMaterial: true, metrosTotal: true, pesoInformado: true, pesoCalculado: true },
  });
  let tampoes = 0;
  let trilhoNovoM = 0;
  let sucataT = 0;
  for (const g of grupos) {
    // Tampão = reemprego G1 ou G2.
    if (g.tipoMaterial === 'REEMPREGO' && (g.classificacao === 'G1' || g.classificacao === 'G2')) tampoes++;
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

/**
 * Geração da semana (segunda a quinta): por dia e por líder, o corte digitado e os totais
 * das carretas (carregado, deixado na via e barras). Os totais não são digitados.
 */
export async function geracaoDaSemana(semana: string) {
  const fim = somarDias(semana, 3);
  const linhas = await prisma.geracaoDia.findMany({
    where: { data: { gte: dataBanco(semana), lte: dataBanco(fim) } },
    include: { carretas: { orderBy: { ordem: 'asc' } } },
  });
  return [0, 1, 2, 3].map((i) => {
    const d = somarDias(semana, i);
    const lideres = Object.fromEntries(
      LIDERES.map((l) => {
        const r = linhas.find((x) => iso(x.data) === d && x.lider === l.valor);
        const carretas = r?.carretas ?? [];
        const soma = (f: (c: (typeof carretas)[number]) => unknown) => carretas.reduce((acc, c) => acc + Number(f(c) ?? 0), 0);
        // Valores vão para a tela como números simples (Decimal do Prisma não serializa).
        return [
          l.valor,
          {
            local: r?.local ?? null,
            corteM: r?.corteM != null ? Number(r.corteM) : null,
            observacao: r?.observacao ?? null,
            carretas: carretas.map((c) => ({
              perfis: c.perfis,
              quantidade: c.quantidade ?? null,
              carregamentoM: c.carregamentoM != null ? Number(c.carregamentoM) : null,
              deixadaViaM: c.deixadaViaM != null ? Number(c.deixadaViaM) : null,
            })),
            carregamentoM: round2(soma((c) => c.carregamentoM)),
            deixadaViaM: round2(soma((c) => c.deixadaViaM)),
            quantidade: soma((c) => c.quantidade),
          },
        ];
      }),
    );
    return { data: d, lideres };
  });
}

/**
 * Grava o dia do líder na semana: local, corte e a lista de carretas (com perfis), que substitui a anterior.
 */
export async function salvarGeracaoDia(
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
// Cada composição tem rota fixa: W61 sempre Evangelista, W62 sempre Paratinga.
export const ROTA_COMPOSICAO: Record<(typeof COMPOSICOES)[number], string> = { W61: 'Evangelista', W62: 'Paratinga' };
export function rotuloComposicao(ativo: string): string {
  const rota = ROTA_COMPOSICAO[ativo as (typeof COMPOSICOES)[number]];
  return rota ? `${ativo} · ${rota}` : ativo;
}

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

/** Serra da semana (segunda a quinta): barras, jacarés e observação de cada composição, por dia. */
export async function composicoesDaSemana(semana: string) {
  const fim = somarDias(semana, 3);
  const linhas = await prisma.composicaoDia.findMany({ where: { data: { gte: dataBanco(semana), lte: dataBanco(fim) } } });
  return [0, 1, 2, 3].map((i) => {
    const d = somarDias(semana, i);
    const ativos = Object.fromEntries(
      COMPOSICOES.map((a) => {
        const r = linhas.find((x) => iso(x.data) === d && x.ativo === a);
        return [a, { barras: r?.barras ?? null, jacares: r?.jacares ?? null, observacao: r?.observacao ?? null }];
      }),
    );
    return { data: d, ativos };
  });
}

/** Caminhões da semana (segunda a quinta): produção e perda de cada caminhão, por dia, com o resto do registro preservado. */
export async function caminhoesDaSemana(semana: string) {
  const fim = somarDias(semana, 3);
  const linhas = await prisma.caminhaoSoldaDia.findMany({ where: { data: { gte: dataBanco(semana), lte: dataBanco(fim) } } });
  return [0, 1, 2, 3].map((i) => {
    const d = somarDias(semana, i);
    const caminhoes = Object.fromEntries(
      CAMINHOES_ATIVOS.map((c) => {
        const r = linhas.find((x) => iso(x.data) === d && x.caminhao === c);
        return [c, { local: r?.local ?? null, producaoDiaria: r?.producaoDiaria ?? null, perdaDiaria: r?.perdaDiaria ?? null, inicioMacro1: r?.inicioMacro1 ?? null, terminoMacro9: r?.terminoMacro9 ?? null, observacao: r?.observacao ?? null }];
      }),
    );
    return { data: d, caminhoes };
  });
}

export async function salvarCaminhao(
  data: string,
  caminhao: (typeof CAMINHOES_ATIVOS)[number],
  v: { local: string | null; producaoDiaria: number | null; inicioMacro1: string | null; terminoMacro9: string | null; perdaDiaria: number | null; observacao?: string | null },
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

/** Apaga um giro (ciclo) lançado por engano ou de teste. */
export async function apagarGiroTrilheiro(id: string) {
  await prisma.trilheiroGiro.delete({ where: { id } });
}

/** Apaga uma manutenção do trilheiro. */
export async function apagarManutencaoTrilheiro(id: string) {
  await prisma.trilheiroManutencao.delete({ where: { id } });
}

/** Reinicia um trilheiro: apaga todos os giros e manutenções dele. Usado quando o lançamento foi teste. */
export async function zerarTrilheiro(trilheiro: (typeof TRILHEIROS)[number]) {
  await prisma.$transaction([
    prisma.trilheiroGiro.deleteMany({ where: { trilheiro } }),
    prisma.trilheiroManutencao.deleteMany({ where: { trilheiro } }),
  ]);
}

export async function salvarManutencaoTrilheiro(v: { data: string; trilheiro: (typeof TRILHEIROS)[number]; local: string | null; tipo: string | null; detalhamento: string | null }) {
  await prisma.trilheiroManutencao.create({ data: { ...v, data: dataBanco(v.data) } });
}

/** Texto salvo da escala da semana (JSON ou texto antigo). Vazio quando nao ha escala salva. */
export async function buscarEscalaSemana(semana: string): Promise<string> {
  const e = await prisma.escalaSemana.findUnique({ where: { semanaInicio: dataBanco(semana) } });
  return e?.conteudo ?? '';
}

/** Escala da semana pronta para exibir: salva, ou gerada pelo ciclo com os locais da semana anterior. */
export async function montarEscalaDaSemana(semana: string) {
  const { montarEscalaSemana, semanaAnterior } = await import('@/lib/usina/escala');
  const ant = semanaAnterior(semana);
  const [texto, textoAnt] = await Promise.all([buscarEscalaSemana(semana), buscarEscalaSemana(ant)]);
  return montarEscalaSemana(semana, texto, montarEscalaSemana(ant, textoAnt));
}
