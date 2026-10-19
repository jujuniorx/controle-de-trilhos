// Séries diárias do mês para os gráficos da one page da usina. Datas 'AAAA-MM-DD', sem fuso.
import { prisma } from '@/lib/db';
import { intervaloDoPeriodo } from '@/lib/usina/periodo';

const dataBanco = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function seriesDoMes(data: string) {
  const { inicio, fim } = intervaloDoPeriodo('mes', data);
  const dias = Number(fim.slice(8, 10));
  const rotulos = Array.from({ length: dias }, (_, i) => String(i + 1).padStart(2, '0'));
  const indice = (d: Date) => Number(iso(d).slice(8, 10)) - 1;
  const zeros = () => new Array<number>(dias).fill(0);

  const [geracao, estaleiro, caminhao, composicao] = await Promise.all([
    prisma.geracaoDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } } }),
    prisma.estaleiroDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } } }),
    prisma.caminhaoSoldaDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } } }),
    prisma.composicaoDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } } }),
  ]);

  const geraCorte = zeros();
  const geraCarregado = zeros();
  const geraDeixado = zeros();
  for (const g of geracao) {
    const i = indice(g.data);
    geraCorte[i] += num(g.corteM);
    geraCarregado[i] += num(g.carregamentoM);
    geraDeixado[i] += num(g.deixadaViaM);
  }

  const estSoldas = zeros();
  const estCortes = zeros();
  for (const e of estaleiro) {
    const i = indice(e.data);
    estSoldas[i] += e.soldas ?? 0;
    estCortes[i] += e.cortes ?? 0;
  }

  const camProducao: Record<string, number[]> = { CW01: zeros(), CW02: zeros() };
  for (const c of caminhao) {
    const k = String(c.caminhao);
    if (!camProducao[k]) camProducao[k] = zeros();
    camProducao[k][indice(c.data)] += c.producaoDiaria ?? 0;
  }

  const compBarras: Record<string, number[]> = { W61: zeros(), W62: zeros() };
  for (const c of composicao) {
    const k = String(c.ativo);
    if (!compBarras[k]) compBarras[k] = zeros();
    compBarras[k][indice(c.data)] += c.barras ?? 0;
  }

  return {
    rotulos,
    geracao: { corte: geraCorte, carregado: geraCarregado, deixado: geraDeixado },
    estaleiro: { soldas: estSoldas, cortes: estCortes },
    caminhao: camProducao,
    composicoes: compBarras,
  };
}
