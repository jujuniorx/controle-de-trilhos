// Séries diárias do mês para os gráficos da one page da usina. Datas 'AAAA-MM-DD', sem fuso.
import { prisma } from '@/lib/db';
import { inicioDaSemana, intervaloDoPeriodo } from '@/lib/usina/periodo';
import { somarDias } from '@/lib/usina/diasUteis';

const dataBanco = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => (v == null ? 0 : Number(v));

const NOMES_DIA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Série de segunda a domingo da semana da data. */
export async function seriesDaSemana(data: string) {
  const inicio = inicioDaSemana(data);
  const fim = somarDias(inicio, 6);
  const dias = NOMES_DIA.length;
  const rotulos = NOMES_DIA.map((n, i) => `${n} ${somarDias(inicio, i).slice(8, 10)}`);
  const indice = (d: Date) => {
    const i = Math.round((Date.parse(`${iso(d)}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000);
    return i >= 0 && i < dias ? i : -1;
  };
  const zeros = () => new Array<number>(dias).fill(0);

  const [geracao, estaleiro, caminhao, composicao] = await Promise.all([
    prisma.geracaoDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } }, include: { carretas: true } }),
    prisma.estaleiroDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } } }),
    prisma.caminhaoSoldaDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } } }),
    prisma.composicaoDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } } }),
  ]);

  const geraCorte = zeros();
  const geraCarregado = zeros();
  const geraDeixado = zeros();
  for (const g of geracao) {
    const i = indice(g.data);
    if (i < 0) continue;
    geraCorte[i] += num(g.corteM);
    for (const c of g.carretas) {
      geraCarregado[i] += num(c.carregamentoM);
      geraDeixado[i] += num(c.deixadaViaM);
    }
  }

  const estSoldas = zeros();
  const estCortes = zeros();
  for (const e of estaleiro) {
    const i = indice(e.data);
    if (i < 0) continue;
    estSoldas[i] += e.soldas ?? 0;
    estCortes[i] += e.cortes ?? 0;
  }

  const camProducao: Record<string, number[]> = { CW01: zeros(), CW02: zeros() };
  for (const c of caminhao) {
    const k = String(c.caminhao);
    if (!camProducao[k]) camProducao[k] = zeros();
    if (indice(c.data) >= 0) camProducao[k][indice(c.data)] += c.producaoDiaria ?? 0;
  }

  const compBarras: Record<string, number[]> = { W61: zeros(), W62: zeros() };
  for (const c of composicao) {
    const k = String(c.ativo);
    if (!compBarras[k]) compBarras[k] = zeros();
    if (indice(c.data) >= 0) compBarras[k][indice(c.data)] += c.barras ?? 0;
  }

  return {
    rotulos,
    geracao: { corte: geraCorte, carregado: geraCarregado, deixado: geraDeixado },
    estaleiro: { soldas: estSoldas, cortes: estCortes },
    caminhao: camProducao,
    composicoes: compBarras,
  };
}
