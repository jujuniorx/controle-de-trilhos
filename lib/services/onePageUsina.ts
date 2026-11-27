import {
  estaleiroDoPeriodo,
  geracaoDoPeriodo,
  caminhoesDoPeriodo,
  CAMINHOES_ATIVOS,
  TRILHEIROS,
  BARRAS_POR_TRILHEIRO,
  COMPOSICOES,
  LIDERES,
  rotuloComposicao,
  ROTULO_TLS,
} from '@/lib/services/usina';
import { seriesDaSemana } from '@/lib/services/usinaGraficos';
import { prisma } from '@/lib/db';
import { intervaloDoPeriodo, rotuloDoDia, desdeValido, diasDaFaixa, linhasPorDia, rotuloFaixaCurta, separarObservacoes, type EntradaObservacao } from '@/lib/usina/periodo';
import { observacoesDoPeriodo } from '@/lib/services/observacaoSetor';
import { somarDias } from '@/lib/usina/diasUteis';
import { METROS_POR_BARRA } from '@/lib/domain/informativo';
import { fmtMetros, fmtPeso } from '@/lib/format';

const soma = <T,>(lista: T[], f: (x: T) => number) => lista.reduce((a, x) => a + f(x), 0);
const metros = (v: number) => fmtMetros(v);
/** Estoque de TLS no dia: número, ou travessão quando ainda não foi lançado. */
const numeroTls = (v: number | null | undefined) => (v == null ? '—' : String(v));
// Paulista, Norte e FIPS do perfil no dia; sem lançamento aparece traço.
const malhasTls = (m: Record<string, number | null> | undefined): [string, string, string] => [numeroTls(m?.PAULISTA), numeroTls(m?.NORTE), numeroTls(m?.FIPS)];
// Total de barras curtas do perfil: soma das malhas (traço quando não há lançamento).
const somaTls = (m: Record<string, number | null> | undefined): string => {
  const valores = Object.values(m ?? {}).filter((v): v is number => v != null);
  return valores.length ? String(valores.reduce((a, b) => a + b, 0)) : '—';
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Valores de cada dia da semana (segunda a domingo), quando existem; usados no PDF diário. */
/** cores: uma cor por parte do valor separada por ' / ' (ex.: W61 e W62), para cada parte aparecer na cor da sua composição. */
/** Linha de um setor. `secao` marca o início de um bloco com título próprio (ex.: Estoque TLS). */
export interface LinhaRelatorio { rotulo: string; dia: string; semana: string; mes: string; porDia?: string[]; cores?: string[]; secao?: string; perfil?: string; malhas?: [string, string, string]; curtaMalhas?: [string, string, string]; curtaTotal?: string }
/** etiquetas: motivo de cada dia sem produção (segunda a domingo), escrito embaixo do dia no gráfico ("Feriado", "Folga"). */
export interface GraficoRelatorio { titulo: string; series: { nome: string; cor: string; valores: number[] }[]; etiquetas?: (string | null)[] }
/** Grade de produção por dia (um valor por dia da semana), para setores em que o número do dia importa mais que o gráfico. */
export interface GradeRelatorio { colunas: string[]; linhas: { rotulo: string; valores: number[] }[] }
/** Barras e metros de uma medida (dia, semana ou mês). */
export interface MedidaSerra { barras: number; metros: number }
/** Uma composição da serra (W61, W62): barras e metros em cada período. */
export interface LinhaSerra { ativo: string; cor: string; dia: MedidaSerra; semana: MedidaSerra; mes: MedidaSerra }
/** Tabela da serra: uma linha por composição e um total, com Dia, Semana e Mês (barras e metros). */
export interface SerraRelatorio { linhas: LinhaSerra[]; total: { dia: MedidaSerra; semana: MedidaSerra; mes: MedidaSerra } }
/** Um caminhão de solda: solda e corte do dia, da semana e do mês, no formato da tabela de trilheiros. */
/** "07:00 → 17:00", "Início 07:00" ou "Término 17:00"; null quando nenhum dos dois foi lançado. */
export function horarioMacros(inicio?: string | null, termino?: string | null): string | null {
  const i = inicio?.trim();
  const t = termino?.trim();
  if (i && t) return `${i} → ${t}`;
  if (i) return `Início ${i}`;
  if (t) return `Término ${t}`;
  return null;
}

type EnvioTrilho = { trilhoNovoM: number; tampoesM: number; trilheiroNovoM: number; trilheiroReempregoM: number };

/**
 * Envio de trilho numa seção só, com carreta e trilheiro no rótulo. Linha sem nada no período não aparece,
 * e zero vira "—" para o número que importa saltar aos olhos.
 */
function linhasEnvio(d: EnvioTrilho, s: EnvioTrilho, m: EnvioTrilho): LinhaRelatorio[] {
  const itens: { rotulo: string; campo: keyof EnvioTrilho }[] = [
    { rotulo: 'Trilho novo · carreta', campo: 'trilhoNovoM' },
    { rotulo: 'Trilho novo · trilheiro', campo: 'trilheiroNovoM' },
    { rotulo: 'Tampões · carreta', campo: 'tampoesM' },
    { rotulo: 'Reemprego · trilheiro', campo: 'trilheiroReempregoM' },
  ];
  const v = (n: number) => (n ? fmtMetros(n) : '—');
  return itens
    .filter((i) => d[i.campo] || s[i.campo] || m[i.campo])
    .map((i, k) => ({ ...(k === 0 ? { secao: 'Envio de trilho (m)' } : {}), rotulo: i.rotulo, dia: v(d[i.campo]), semana: v(s[i.campo]), mes: v(m[i.campo]) }));
}

export interface CaminhaoTabelaRelatorio {
  nome: string;
  local: string | null;
  observacao: string | null;
  /** Horário do dia (início na macro 1 e término na macro 9); só quando o relatório é de um dia. */
  horario: string | null;
  solda: { dia: number; semana: number; mes: number };
  corte: { dia: number; semana: number; mes: number };
}

export interface SetorRelatorio { titulo: string; cor: string; linhas: LinhaRelatorio[]; grafico: GraficoRelatorio | null; grade?: GradeRelatorio; serra?: SerraRelatorio; caminhoes?: CaminhaoTabelaRelatorio[]; /** Observação do setor no dia (só usada no PDF diário). */ observacao?: string; /** Nome da coluna do dia na tabela; "PERÍODO" quando o relatório junta vários dias. */ rotuloColunaDia?: string }

/** Produção de uma equipe de geração: o dia e a semana. */
export interface EquipeGeracaoRelatorio {
  rotulo: string;
  dia: { corteM: number; carregamentoM: number; deixadaViaM: number; quantidade: number };
  semana: { corteM: number; carregamentoM: number; deixadaViaM: number; quantidade: number };
}

export interface DadosRelatorio {
  data: string;
  /** Primeiro dia do relatório diário. Igual a `data` num dia só; antes dela quando junta vários dias (ex.: sexta a domingo). */
  desde: string;
  /** Rótulo do valor "do dia" no topo: "Do dia" ou "No período". */
  rotuloValorDia: string;
  /** Posição (0 = segunda) dos dias do relatório no gráfico da semana, para ficarem em destaque. */
  diasDestaque: number[];
  rotulosDias: string[];
  /** Nome da coluna "do dia" com o dia da semana, ex.: "Do dia (sexta-feira, 23/10)". */
  rotuloDia: string;
  /** Linhas do cartão de topo; quando existem (trilheiros), trocam Do dia / Da semana / No mês. */
  resumo: { rotulo: string; cor: string; dia: string; semana: string; mes: string; grupo: string; linhas?: { rotulo: string; valor: string }[]; legenda?: string }[];
  setores: SetorRelatorio[];
  equipesGeracao: EquipeGeracaoRelatorio[];
  /** Observação de cada setor por dia, da segunda a domingo da semana: chave "AAAA-MM-DD|setor". */
  observacoes: Record<string, string>;
}

/** Cores fixas por setor (cabeçalho) e uma cor distinta para cada série dentro do setor. */
export const CORES_SETOR = { estaleiro: '#2563eb', geracao: '#059669', serra: '#be123c', caminhao: '#ea580c', trilheiros: '#0891b2' };

/** Nome de cada caminhão de solda no relatório: equipe / caminhão, como na escala. */
export const ROTULO_CAMINHAO: Record<string, string> = { CW01: 'E17 / CW01', CW02: 'E18 / CW02', CW03: 'CW03' };

/** Cor de cada caminhão nos gráficos e nas linhas do relatório. */
export const COR_CAMINHAO: Record<string, string> = { CW01: '#ea580c', CW02: '#84cc16', CW03: '#0891b2' };

/** Mesmos números do relatório gerencial da usina, em forma simples para a tela e para o PDF. */
export async function montarDadosRelatorio(data: string, desdePedido?: string | null): Promise<DadosRelatorio> {
  const serie = await seriesDaSemana(data);
  // Relatório de vários dias (ex.: na segunda, sexta a domingo): a coluna do dia soma a faixa toda.
  const desde = desdeValido(desdePedido, data);
  const varios = desde < data;
  const faixa = { inicio: desde, fim: data };
  const diasFaixa = diasDaFaixa(desde, data);
  const naFaixa = (d: string) => d >= desde && d <= data;
  // Observação de cada equipe de geração no dia (Alécio, Bruno, Reginaldo); em vários dias, de cada dia da faixa.
  const equipesDia = await prisma.geracaoDia.findMany({
    where: { data: { gte: new Date(`${desde}T00:00:00Z`), lte: new Date(`${data}T00:00:00Z`) } },
    select: { data: true, lider: true, observacao: true, local: true },
  });
  const rotuloEquipe: Record<string, string> = { ALECIO: 'Equipe 1', BRUNO: 'Equipe 2', REGINALDO: 'Equipe 3' };
  // Ordem fixa do cadastro (Alécio, Bruno, Reginaldo). Cada equipe com lançamento no dia aparece com o local,
  // mesmo sem observação. Formato: "Nome (LOCAL): observação".
  const textoEquipe = (e: (typeof equipesDia)[number]) => {
    const local = e.local?.trim();
    const texto = e.observacao?.trim() || 'Sem observação.';
    return `${rotuloEquipe[e.lider] ?? e.lider}${local ? ` (${local})` : ''}: ${texto}`;
  };
  const temInfoEquipe = (e: (typeof equipesDia)[number]) => !!e.local?.trim() || !!e.observacao?.trim();
  const ordemLider = (lider: string) => LIDERES.findIndex((l) => l.valor === lider);
  // Vários dias: cada equipe com o local é o rótulo e a observação é o texto, para os motivos (Feriado, Folga) irem
  // para o gráfico e o mesmo texto de várias equipes virar uma linha só (separarObservacoes, mais abaixo).
  const entradasGeracao: EntradaObservacao[] = [...equipesDia]
    .filter(temInfoEquipe)
    .sort((a, b) => ordemLider(a.lider) - ordemLider(b.lider))
    .map((e) => {
      const local = e.local?.trim();
      return { data: iso(e.data), rotulo: `${rotuloEquipe[e.lider] ?? e.lider}${local ? ` (${local})` : ''}`, texto: e.observacao?.trim() || 'Sem observação.' };
    });
  const observacoesGeracao = varios
    ? []
    : LIDERES.map((l) => equipesDia.find((e) => e.lider === l.valor && iso(e.data) === data))
        .filter((e): e is NonNullable<typeof e> => !!e && temInfoEquipe(e))
        .map(textoEquipe);
  const { inicio, fim } = intervaloDoPeriodo('semana', data);
  const mes = intervaloDoPeriodo('mes', data);
  const dias = serie.rotulos.length;

  const trilRel = await montarTrilheirosRelatorio(data, desde);
  // Local e observação de cada caminhão: o local é o último lançado até a data do relatório (pode ser de outra semana);
  // a observação é a do próprio dia.
  const registrosCaminhao = await prisma.caminhaoSoldaDia.findMany({
    where: { data: { lte: new Date(`${data}T00:00:00Z`) } },
    orderBy: { data: 'asc' },
    select: { data: true, caminhao: true, local: true, observacao: true, inicioMacro1: true, terminoMacro9: true },
  });
  const infoCaminhao = (cw: string) => {
    const doCaminhao = registrosCaminhao.filter((r) => r.caminhao === cw);
    const comLocal = doCaminhao.filter((r) => r.local).slice(-1)[0];
    if (varios) {
      // Vários dias: a observação de cada dia, com o dia na frente.
      const linhas = linhasPorDia(
        doCaminhao.filter((r) => naFaixa(iso(r.data)) && r.observacao?.trim()).map((r) => ({ data: iso(r.data), chave: cw, texto: r.observacao!.trim() })),
        diasFaixa,
      );
      return { local: comLocal?.local ?? null, observacao: linhas.length ? linhas.join('; ') : null, horario: null };
    }
    const doDia = doCaminhao.find((r) => r.data.toISOString().slice(0, 10) === data);
    return { local: comLocal?.local ?? null, observacao: doDia?.observacao ?? null, horario: horarioMacros(doDia?.inicioMacro1, doDia?.terminoMacro9) };
  };
  const [estD, estS, estM, gerD, gerS, camD, camS, serraSem, serraMesRows] = await Promise.all([
    estaleiroDoPeriodo(faixa, data),
    estaleiroDoPeriodo('semana', data),
    estaleiroDoPeriodo('mes', data),
    geracaoDoPeriodo(faixa, data),
    geracaoDoPeriodo('semana', data),
    caminhoesDoPeriodo(faixa, data),
    caminhoesDoPeriodo('semana', data),
    // Da segunda da semana (ou do primeiro dia da faixa, se for antes) até o domingo.
    prisma.composicaoDia.findMany({
      where: { data: { gte: new Date(`${desde < inicio ? desde : inicio}T00:00:00Z`), lte: new Date(`${fim}T00:00:00Z`) } },
      select: { data: true, ativo: true, barras: true, observacao: true },
    }),
    prisma.composicaoDia.findMany({
      where: { data: { gte: new Date(`${mes.inicio}T00:00:00Z`), lte: new Date(`${data}T00:00:00Z`) } },
      select: { data: true, ativo: true, barras: true },
    }),
  ]);

  // Serra (modelo do informativo): barras de W61 e W62 × 10,5 m, estimativa em metros.
  // Observação de cada composição no dia (W61 e W62), digitada no formulário da serra.
  const obsSerraDoDia = serraSem.filter((r) => naFaixa(iso(r.data)) && r.observacao && r.observacao.trim());
  const entradasSerra: EntradaObservacao[] = obsSerraDoDia.map((r) => ({ data: iso(r.data), rotulo: r.ativo, texto: r.observacao!.trim() }));
  const observacoesSerra = varios
    ? []
    : obsSerraDoDia.map((r) => `${r.ativo}: ${r.observacao!.trim()}`);
  const barrasDia = (ativo: string) => serraSem.filter((r) => r.ativo === ativo && naFaixa(iso(r.data))).reduce((t, r) => t + (r.barras ?? 0), 0);
  const naSemana = (d: string) => d >= inicio && d <= fim;
  const barrasSemana = (ativo: string) => serraSem.filter((r) => r.ativo === ativo && naSemana(iso(r.data))).reduce((t, r) => t + (r.barras ?? 0), 0);
  const barrasMes = (ativo: string) => serraMesRows.filter((r) => r.ativo === ativo).reduce((t, r) => t + (r.barras ?? 0), 0);
  const metrosDeBarras = (b: number) => Math.round(b * METROS_POR_BARRA * 100) / 100;
  const serraDiaSerie = (ativo: string) => {
    const valores = new Array<number>(dias).fill(0);
    for (const r of serraSem) {
      const i = Math.round((Date.parse(`${iso(r.data)}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000);
      if (r.ativo === ativo && i >= 0 && i < dias) valores[i] += metrosDeBarras(r.barras ?? 0);
    }
    return valores;
  };
  // Cor de cada composição da serra: a mesma usada no gráfico (W61 roxo, W62 âmbar).
  const COR_COMPOSICAO = COMPOSICOES.map((_, i) => (i === 0 ? '#7c3aed' : '#0d9488'));
  const serraTotalDia = COMPOSICOES.reduce((t, a) => t + metrosDeBarras(barrasDia(a)), 0);
  const serraTotalSemana = COMPOSICOES.reduce((t, a) => t + metrosDeBarras(barrasSemana(a)), 0);
  const serraTotalMes = COMPOSICOES.reduce((t, a) => t + metrosDeBarras(barrasMes(a)), 0);

  const geraDia = (f: (l: (typeof gerD.porLider)[number]) => number) => soma(gerD.porLider, f);
  const geraSem = (f: (l: (typeof gerS.porLider)[number]) => number) => soma(gerS.porLider, f);

  const observacoes = await observacoesDoPeriodo(desde < inicio ? desde : inicio, somarDias(inicio, 6));
  // Estaleiro sem solda e sem corte (fim de semana, feriado): diz que ficou parado, em vez de só mostrar zeros.
  const estaleiroParado = estD.totais.soldas === 0 && estD.totais.cortes === 0;
  const avisoParado = estaleiroParado ? (varios ? `Sem produção no período (${rotuloFaixaCurta(desde, data)}).` : 'Sem produção no dia.') : null;
  // Vários dias: o motivo de cada dia sem produção (Feriado, Folga) vai para o gráfico, embaixo do dia; a caixa de
  // observação fica só com o que é informação. Sem observação própria (equipes, composições), vale a do setor.
  const posSemana = (d: string) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000);
  // Dia fora da semana do gráfico não tem barra para mostrar o motivo: fica como "com produção" e o motivo na lista.
  const zerado = (series: number[][]) => (d: string) => {
    const i = posSemana(d);
    return i >= 0 && i < dias && series.every((v) => !(v[i] ?? 0));
  };
  const doSetor = (setor: string): EntradaObservacao[] => diasFaixa.map((d) => ({ data: d, texto: observacoes[`${d}|${setor}`] ?? '' }));
  const etiquetasDe = (motivos: Record<string, string>) => {
    const lista = new Array<string | null>(dias).fill(null);
    for (const [d, m] of Object.entries(motivos)) if (posSemana(d) >= 0 && posSemana(d) < dias) lista[posSemana(d)] = m;
    return lista.some(Boolean) ? lista : undefined;
  };
  const sepEstaleiro = separarObservacoes(doSetor('estaleiro'), diasFaixa, zerado([serie.estaleiro.soldas, serie.estaleiro.cortes]));
  const sepGeracao = separarObservacoes(entradasGeracao.length ? entradasGeracao : doSetor('geracao'), diasFaixa, zerado([serie.geracao.carregado, serie.geracao.deixado]));
  const sepSerra = separarObservacoes(entradasSerra.length ? entradasSerra : doSetor('serra'), diasFaixa, zerado(COMPOSICOES.map((a) => serraDiaSerie(a))));
  const etiquetasEstaleiro = varios ? etiquetasDe(sepEstaleiro.motivos) : undefined;
  const etiquetasGeracao = varios ? etiquetasDe(sepGeracao.motivos) : undefined;
  const etiquetasSerra = varios ? etiquetasDe(sepSerra.motivos) : undefined;
  const temObsEstaleiroDia = !varios && !!observacoes[`${data}|estaleiro`]?.trim();
  // "Sem produção no período" só quando nenhum dia tem o motivo no gráfico: com as etiquetas, a frase repetiria o gráfico.
  const observacaoEstaleiro = varios
    ? [...(avisoParado && !Object.keys(sepEstaleiro.motivos).length ? [avisoParado] : []), ...sepEstaleiro.linhas].join('\n') || undefined
    : !temObsEstaleiroDia && avisoParado
      ? avisoParado
      : undefined;
  const obsGeracaoFinal = varios ? sepGeracao.linhas : observacoesGeracao;
  const obsSerraFinal = varios ? sepSerra.linhas : observacoesSerra;
  // Dias do relatório dentro da semana do gráfico (0 = segunda), para o destaque.
  const diasDestaque = diasFaixa
    .map((d) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000))
    .filter((i) => i >= 0 && i < 7);

  const dados: DadosRelatorio = {
    data,
    desde,
    rotuloValorDia: varios ? 'No período' : 'Do dia',
    diasDestaque,
    observacoes,
    rotuloDia: varios ? `No período (${rotuloFaixaCurta(desde, data)})` : rotuloDoDia(data),
    rotulosDias: serie.rotulos,
    equipesGeracao: gerS.porLider.map((l) => {
      const d = gerD.porLider.find((x) => x.valor === l.valor)?.periodo;
      return {
        rotulo: l.rotulo,
        dia: { corteM: d?.corteM ?? 0, carregamentoM: d?.carregamentoM ?? 0, deixadaViaM: d?.deixadaViaM ?? 0, quantidade: d?.quantidade ?? 0 },
        semana: { corteM: l.periodo.corteM, carregamentoM: l.periodo.carregamentoM, deixadaViaM: l.periodo.deixadaViaM, quantidade: l.periodo.quantidade },
      };
    }),
    resumo: [
      {
        rotulo: 'Estaleiro de solda (und)',
        cor: CORES_SETOR.estaleiro,
        dia: `${estD.totais.soldas}`,
        semana: `${estS.totais.soldas}`,
        mes: `${estM.totais.soldas}`,
        grupo: 'Estaleiro de solda',
      },
      {
        rotulo: 'Geração de trilho (m)',
        cor: CORES_SETOR.geracao,
        dia: fmtMetros(geraDia((l) => l.periodo.carregamentoM + l.periodo.deixadaViaM)),
        semana: fmtMetros(geraSem((l) => l.periodo.carregamentoM + l.periodo.deixadaViaM)),
        mes: fmtMetros(geraSem((l) => l.mes.carregamentoM + l.mes.deixadaViaM)),
        grupo: 'Geração de trilho',
      },
      {
        rotulo: 'Recolhimento serra (m)',
        cor: CORES_SETOR.serra,
        dia: fmtMetros(serraTotalDia),
        semana: fmtMetros(serraTotalSemana),
        mes: fmtMetros(serraTotalMes),
        grupo: 'Recolhimento serra',
      },
      ...CAMINHOES_ATIVOS.map((cw) => ({
        rotulo: `${ROTULO_CAMINHAO[cw] ?? cw} (und)`,
        cor: cw === 'CW01' ? CORES_SETOR.caminhao : COR_CAMINHAO[cw],
        dia: `${camD.find((c) => c.caminhao === cw)?.periodo.producao ?? 0}`,
        semana: `${camS.find((c) => c.caminhao === cw)?.periodo.producao ?? 0}`,
        mes: `${camS.find((c) => c.caminhao === cw)?.mes.producao ?? 0}`,
        grupo: 'Caminhão de solda',
      })),
      {
        rotulo: 'Trilheiros',
        cor: CORES_SETOR.trilheiros,
        dia: '',
        semana: '',
        mes: '',
        // Barras carregadas sobre o total que o trilheiro tem no giro (ex.: 10/40).
        linhas: trilRel.equipes.map((e) => ({ rotulo: e.trilheiro, valor: `${e.descarregadas}/${e.total}` })),
        legenda: 'Desc. / Env.',
        grupo: 'Trilheiros',
      },
    ],
    setores: [
      {
        titulo: 'Estaleiro de solda',
        cor: CORES_SETOR.estaleiro,
        observacao: observacaoEstaleiro,
        linhas: [
          { secao: 'Soldas e cortes', rotulo: 'Soldas (und)', dia: `${estD.totais.soldas}`, semana: `${estS.totais.soldas}`, mes: `${estM.totais.soldas}`, porDia: serie.estaleiro.soldas.map(String) },
          { rotulo: 'Cortes (und)', dia: `${estD.totais.cortes}`, semana: `${estS.totais.cortes}`, mes: `${estM.totais.cortes}`, porDia: serie.estaleiro.cortes.map(String) },
          ...linhasEnvio(estD.carreta, estS.carreta, estM.carreta),
          // Estoque é um retrato do dia: só a coluna do dia tem número.
          { secao: 'Estoque TLS (no dia)', rotulo: ROTULO_TLS.TR68_NOVO, dia: numeroTls(estD.estoqueDoDia.TR68_NOVO), perfil: 'TR68 NOVO', malhas: malhasTls(estD.malhasDoDia.TR68_NOVO), curtaMalhas: malhasTls(estD.barrasCurtasDoDia.TR68_NOVO), curtaTotal: somaTls(estD.barrasCurtasDoDia.TR68_NOVO), semana: '—', mes: '—' },
          { rotulo: ROTULO_TLS.UIC60_NOVO, dia: numeroTls(estD.estoqueDoDia.UIC60_NOVO), perfil: 'UIC60 NOVO', malhas: malhasTls(estD.malhasDoDia.UIC60_NOVO), curtaMalhas: malhasTls(estD.barrasCurtasDoDia.UIC60_NOVO), curtaTotal: somaTls(estD.barrasCurtasDoDia.UIC60_NOVO), semana: '—', mes: '—' },
          { rotulo: ROTULO_TLS.TR68_REEMPREGO, dia: numeroTls(estD.estoqueDoDia.TR68_REEMPREGO), perfil: 'TR68 REEMPREGO', malhas: malhasTls(estD.malhasDoDia.TR68_REEMPREGO), curtaMalhas: malhasTls(estD.barrasCurtasDoDia.TR68_REEMPREGO), curtaTotal: somaTls(estD.barrasCurtasDoDia.TR68_REEMPREGO), semana: '—', mes: '—' },
          { rotulo: ROTULO_TLS.UIC60_REEMPREGO, dia: numeroTls(estD.estoqueDoDia.UIC60_REEMPREGO), perfil: 'UIC60 REEMPREGO', malhas: malhasTls(estD.malhasDoDia.UIC60_REEMPREGO), curtaMalhas: malhasTls(estD.barrasCurtasDoDia.UIC60_REEMPREGO), curtaTotal: somaTls(estD.barrasCurtasDoDia.UIC60_REEMPREGO), semana: '—', mes: '—' },
        ],
        grafico: {
          titulo: 'Soldas e cortes por dia',
          etiquetas: etiquetasEstaleiro,
          series: [
            { nome: 'Soldas', cor: '#2563eb', valores: serie.estaleiro.soldas },
            { nome: 'Cortes', cor: '#f59e0b', valores: serie.estaleiro.cortes },
          ],
        },
      },
      {
        titulo: 'Geração de trilho',
        cor: CORES_SETOR.geracao,
        observacao: obsGeracaoFinal.length ? obsGeracaoFinal.join('\n') : undefined,
        linhas: [
          { rotulo: 'Carregado (m)', dia: fmtMetros(geraDia((l) => l.periodo.carregamentoM)), semana: fmtMetros(geraSem((l) => l.periodo.carregamentoM)), mes: fmtMetros(geraSem((l) => l.mes.carregamentoM)), porDia: serie.geracao.carregado.map((v) => fmtMetros(v)) },
          { rotulo: 'Na via (m)', dia: fmtMetros(geraDia((l) => l.periodo.deixadaViaM)), semana: fmtMetros(geraSem((l) => l.periodo.deixadaViaM)), mes: fmtMetros(geraSem((l) => l.mes.deixadaViaM)), porDia: serie.geracao.deixado.map((v) => fmtMetros(v)) },
          { rotulo: 'Barras (und)', dia: `${geraDia((l) => l.periodo.quantidade)}`, semana: `${geraSem((l) => l.periodo.quantidade)}`, mes: `${geraSem((l) => l.mes.quantidade)}` },
        ],
        grafico: {
          titulo: 'Metros por dia',
          etiquetas: etiquetasGeracao,
          series: [
            { nome: 'Carregado', cor: '#059669', valores: serie.geracao.carregado },
            { nome: 'Deixado na via', cor: '#db2777', valores: serie.geracao.deixado },
          ],
        },
      },
      {
        titulo: 'Recolhimento serra',
        cor: CORES_SETOR.serra,
        observacao: obsSerraFinal.length ? obsSerraFinal.join('\n') : undefined,
        serra: {
          linhas: COMPOSICOES.map((a, i) => ({
            ativo: a,
            cor: i === 0 ? '#7c3aed' : '#0d9488',
            dia: { barras: barrasDia(a), metros: metrosDeBarras(barrasDia(a)) },
            semana: { barras: barrasSemana(a), metros: metrosDeBarras(barrasSemana(a)) },
            mes: { barras: barrasMes(a), metros: metrosDeBarras(barrasMes(a)) },
          })),
          total: {
            dia: { barras: COMPOSICOES.reduce((t, a) => t + barrasDia(a), 0), metros: serraTotalDia },
            semana: { barras: COMPOSICOES.reduce((t, a) => t + barrasSemana(a), 0), metros: serraTotalSemana },
            mes: { barras: COMPOSICOES.reduce((t, a) => t + barrasMes(a), 0), metros: serraTotalMes },
          },
        },
        linhas: [
          // Uma linha por medida, com as composições na mesma célula (W61 / W62): a tabela não cresce com novas composições.
          { rotulo: `Barras (${COMPOSICOES.join(' e ')}), nessa ordem`, dia: COMPOSICOES.map((a) => barrasDia(a)).join(' / '), semana: COMPOSICOES.map((a) => barrasSemana(a)).join(' / '), mes: COMPOSICOES.map((a) => barrasMes(a)).join(' / '), porDia: Array.from({ length: dias }, (_, i) => COMPOSICOES.map((a) => serraDiaSerie(a)[i] ? Math.round(serraDiaSerie(a)[i]! / METROS_POR_BARRA) : 0).join(' / ')), cores: COR_COMPOSICAO },
          { rotulo: `Metros estimados (${COMPOSICOES.join(' e ')}), nessa ordem`, dia: COMPOSICOES.map((a) => fmtMetros(metrosDeBarras(barrasDia(a)))).join(' / '), semana: COMPOSICOES.map((a) => fmtMetros(metrosDeBarras(barrasSemana(a)))).join(' / '), mes: COMPOSICOES.map((a) => fmtMetros(metrosDeBarras(barrasMes(a)))).join(' / '), porDia: Array.from({ length: dias }, (_, i) => COMPOSICOES.map((a) => fmtMetros(serraDiaSerie(a)[i] ?? 0)).join(' / ')), cores: COR_COMPOSICAO },
          { rotulo: 'Total estimado (m)', dia: metros(serraTotalDia), semana: metros(serraTotalSemana), mes: metros(serraTotalMes) },
        ],
        grafico: {
          titulo: 'Metros por dia: W61 e W62 (barras × 10,5 m)',
          etiquetas: etiquetasSerra,
          series: COMPOSICOES.map((a, i) => ({
            nome: a,
            cor: i === 0 ? '#7c3aed' : '#0d9488',
            valores: serraDiaSerie(a),
          })),
        },
      },
      {
        titulo: 'Caminhão de solda',
        cor: CORES_SETOR.caminhao,
        caminhoes: camS.map((c) => {
          const d = camD.find((x) => x.caminhao === c.caminhao);
          return {
            nome: ROTULO_CAMINHAO[c.caminhao] ?? c.caminhao,
            local: infoCaminhao(c.caminhao).local,
            observacao: infoCaminhao(c.caminhao).observacao,
            horario: infoCaminhao(c.caminhao).horario,
            solda: { dia: d?.periodo.producao ?? 0, semana: c.periodo.producao, mes: c.mes.producao },
            corte: { dia: d?.periodo.perda ?? 0, semana: c.periodo.perda, mes: c.mes.perda },
          };
        }),
        // Mesmo formato do estaleiro: Solda (UND) e Corte (UND) por caminhão, com Dia, Semana e No mês.
        linhas: camS.flatMap((c) => {
          const d = camD.find((x) => x.caminhao === c.caminhao);
          const nome = ROTULO_CAMINHAO[c.caminhao] ?? c.caminhao;
          return [
            {
              rotulo: `${nome} · Solda (und)`,
              dia: `${d?.periodo.producao ?? 0}`,
              semana: `${c.periodo.producao}`,
              mes: `${c.mes.producao}`,
              porDia: ((serie.caminhao as Record<string, number[]>)[c.caminhao] ?? []).map(String),
            },
            {
              rotulo: `${nome} · Solda reprovada (und)`,
              dia: `${d?.periodo.perda ?? 0}`,
              semana: `${c.periodo.perda}`,
              mes: `${c.mes.perda}`,
            },
          ];
        }),
        grade: {
          colunas: serie.rotulos,
          linhas: CAMINHOES_ATIVOS.map((cw) => ({ rotulo: ROTULO_CAMINHAO[cw], valores: serie.caminhao[cw] ?? [] })),
        },
        grafico: {
          titulo: 'Solda por dia',
          series: CAMINHOES_ATIVOS.map((cw) => ({ nome: ROTULO_CAMINHAO[cw], cor: COR_CAMINHAO[cw], valores: serie.caminhao[cw] ?? [] })),
        },
      },
      {
        titulo: 'Trilheiros',
        cor: CORES_SETOR.trilheiros,
        linhas: trilRel.equipes.map((e) => ({
          rotulo: `${e.trilheiro} · B.O. ${brDaIso(e.bo)} (${e.giroDias ?? '—'} dias) · Partida ${brDaIso(e.partida)} (${e.diasDesdePartida ?? '—'} dias) · ${e.local ?? '—'}`,
          dia: `+${e.descarregadasDia}`,
          semana: `${e.descarregadas} / ${e.total}`,
          mes: '—',
        })),
        grafico: null,
      },
    ],
  };
  if (varios) dados.setores = dados.setores.map((st) => ({ ...st, rotuloColunaDia: 'PERÍODO' }));
  return dados;
}

export interface EquipeTrilheiro {
  trilheiro: string;
  /** Dias corridos desde o B.O. até a data do relatório. */
  giroDias: number | null;
  bo: string | null;
  /** Data em que o trilheiro saiu da usina. */
  partida: string | null;
  /** Dias corridos desde a partida até a data do relatório. */
  diasDesdePartida: number | null;
  local: string | null;
  observacao: string | null;
  total: number;
  descarregadas: number;
  descarregadasDia: number;
  status: string;
}

/** AAAA-MM-DD para DD/MM/AAAA (ou traço, se vazio). */
function brDaIso(iso: string | null): string {
  return iso ? iso.split('-').reverse().join('/') : '—';
}

export interface TrilheirosRelatorio {
  ativos: number;
  totalBarras: number;
  descarregadas: number;
  progresso: number | null;
  /** Barras descarregadas no mês corrente até a data do relatório (soma dos dias de cada giro). */
  descarregadasMes: number;
  equipes: EquipeTrilheiro[];
}

/** Barras descarregadas por trilheiro do dia 1 do mês até a data, somando o que saiu em cada dia do giro. */
async function descarregadasNoMes(data: string): Promise<number> {
  const inicioMes = `${data.slice(0, 8)}01`;
  const totais = await Promise.all(
    TRILHEIROS.map(async (t) => {
      const [antes, dias] = await Promise.all([
        prisma.trilheiroDia.findFirst({
          where: { trilheiro: t, data: { lt: new Date(`${inicioMes}T00:00:00Z`) }, descarregadas: { not: null } },
          orderBy: { data: 'desc' },
        }),
        prisma.trilheiroDia.findMany({
          where: { trilheiro: t, data: { gte: new Date(`${inicioMes}T00:00:00Z`), lte: new Date(`${data}T00:00:00Z`) }, descarregadas: { not: null } },
          orderBy: { data: 'asc' },
        }),
      ]);
      let anterior = antes;
      let soma = 0;
      for (const r of dias) {
        const base = anterior && anterior.boEm?.getTime() === r.boEm?.getTime() ? anterior.descarregadas ?? 0 : 0;
        soma += Math.max(0, (r.descarregadas ?? 0) - base);
        anterior = r;
      }
      return soma;
    }),
  );
  return totais.reduce((a, b) => a + b, 0);
}

/** Situacao de cada trilheiro no dia: ultimo lancamento da tabela diaria ate a data do relatorio. */
export async function montarTrilheirosRelatorio(data: string, desdePedido?: string | null): Promise<TrilheirosRelatorio> {
  const desde = desdeValido(desdePedido, data);
  const varios = desde < data;
  const diasFaixa = diasDaFaixa(desde, data);
  const diaMs = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const equipes: EquipeTrilheiro[] = await Promise.all(
    TRILHEIROS.map(async (t) => {
      const dataRel = new Date(`${data}T00:00:00Z`);
      // Ultimo dia lançado (com barras) ate a data do relatorio.
      const r = await prisma.trilheiroDia.findFirst({
        where: { trilheiro: t, data: { lte: dataRel }, descarregadas: { not: null } },
        orderBy: { data: 'desc' },
      });
      // A observação é a do próprio dia do relatório (não a do último dia com barras).
      const doDia = await prisma.trilheiroDia.findUnique({ where: { data_trilheiro: { data: dataRel, trilheiro: t } } });
      // Vários dias: observação de cada dia da faixa, com o dia na frente.
      const obsFaixa = varios
        ? linhasPorDia(
            (
              await prisma.trilheiroDia.findMany({
                where: { trilheiro: t, data: { gte: new Date(`${desde}T00:00:00Z`), lte: dataRel }, observacao: { not: null } },
                orderBy: { data: 'asc' },
              })
            ).map((x) => ({ data: iso(x.data), chave: t, texto: x.observacao ?? '' })),
            diasFaixa,
          ).join('; ') || null
        : null;
      // Último lançamento antes da faixa: a diferença até ele é o que foi descarregado nos dias do relatório.
      const antesDaFaixa = varios
        ? await prisma.trilheiroDia.findFirst({
            where: { trilheiro: t, data: { lt: new Date(`${desde}T00:00:00Z`) }, descarregadas: { not: null } },
            orderBy: { data: 'desc' },
          })
        : null;
      // Dia anterior do mesmo giro: a diferenca entre os dois e o que foi descarregado no dia.
      const anterior = r
        ? await prisma.trilheiroDia.findFirst({
            where: { trilheiro: t, data: { lt: r.data }, descarregadas: { not: null } },
            orderBy: { data: 'desc' },
          })
        : null;
      if (!r) {
        return {
          trilheiro: t,
          giroDias: null,
          bo: null,
          partida: null,
          diasDesdePartida: null,
          local: null,
          observacao: varios ? obsFaixa : doDia?.observacao ?? null,
          total: 0,
          descarregadas: 0,
          descarregadasDia: 0,
          status: 'Sem lançamento',
        };
      }
      const bo = r.boEm ? r.boEm.toISOString().slice(0, 10) : null;
      const giroDias = bo ? Math.round((diaMs(data) - diaMs(bo)) / 86400000) : null;
      const partida = r.partidaEm ? r.partidaEm.toISOString().slice(0, 10) : null;
      const diasDesdePartida = partida ? Math.round((diaMs(data) - diaMs(partida)) / 86400000) : null;
      const descarregadas = r.descarregadas ?? 0;
      const baseDoGiro = anterior && anterior.boEm?.getTime() === r.boEm?.getTime() ? anterior.descarregadas ?? 0 : 0;
      const total = r.total ?? BARRAS_POR_TRILHEIRO;
      return {
        trilheiro: t,
        giroDias,
        bo,
        partida,
        diasDesdePartida,
        local: r.local ?? null,
        observacao: varios ? obsFaixa : doDia?.observacao ?? null,
        total,
        descarregadas,
        // "Do dia" só vale se houve lançamento na própria data do relatório; senão mostra zero, e não o último dia lançado.
        descarregadasDia: varios
          ? iso(r.data) >= desde
            ? Math.max(0, descarregadas - (antesDaFaixa && antesDaFaixa.boEm?.getTime() === r.boEm?.getTime() ? antesDaFaixa.descarregadas ?? 0 : 0))
            : 0
          : r.data.toISOString().slice(0, 10) === data
            ? Math.max(0, descarregadas - baseDoGiro)
            : 0,
        status: 'Em execução',
      };
    }),
  );
  const ativos = equipes.filter((e) => e.status !== 'Sem lançamento');
  const totalBarras = soma(ativos, (e) => e.total);
  const descarregadas = soma(ativos, (e) => e.descarregadas);
  return {
    ativos: ativos.length,
    totalBarras,
    descarregadas,
    progresso: totalBarras > 0 ? Math.round((descarregadas / totalBarras) * 100) : null,
    descarregadasMes: await descarregadasNoMes(data),
    equipes,
  };
}
