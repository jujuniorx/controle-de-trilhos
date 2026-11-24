import { prisma } from '@/lib/db';
import type { RelatorioSetor, SetorSlug } from '@/lib/services/relatorioSetor';

/** Pontos para conferir antes de gerar a imagem do setor. Só lê dados; não muda nada. */
export interface AlertaSetor {
  nivel: 'forte' | 'atencao';
  titulo: string;
  detalhe: string;
}

const MESES_NOME = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Quantos lançamentos do setor estão com data depois de hoje (no sistema inteiro). */
async function contarDataFutura(slug: SetorSlug, hoje: string): Promise<number> {
  const depois = { gt: new Date(`${hoje}T00:00:00Z`) };
  switch (slug) {
    case 'patio':
      return prisma.movimentacao.count({ where: { dataMovimentacao: depois } });
    case 'serra':
      return prisma.composicaoDia.count({ where: { data: depois } });
    case 'geracao':
      return prisma.geracaoDia.count({ where: { data: depois } });
    case 'estaleiro':
      return prisma.estaleiroDia.count({ where: { data: depois } });
    case 'caminhoes':
      return prisma.caminhaoSoldaDia.count({ where: { data: depois } });
    case 'trilheiros':
      return prisma.trilheiroGiro.count({ where: { boEm: depois } });
    default:
      return 0;
  }
}

function nomeDoBalde(r: RelatorioSetor, chave: string): string {
  if (r.periodo.mes) return `dia ${chave} de ${MESES_NOME[r.periodo.mes - 1]}`;
  return MESES_NOME[Number(chave) - 1];
}

export async function alertasDoSetor(r: RelatorioSetor, hoje: string): Promise<AlertaSetor[]> {
  const alertas: AlertaSetor[] = [];
  const fmt = (n: number, casas: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

  const futuros = await contarDataFutura(r.slug, hoje);
  if (futuros > 0) {
    alertas.push({
      nivel: 'atencao',
      titulo: `${futuros} ${futuros === 1 ? 'lançamento' : 'lançamentos'} com data depois de hoje`,
      detalhe: 'Podem ser lançamentos adiantados ou data digitada errada. Confira antes de divulgar.',
    });
  }

  if ((r.totais[0] ?? 0) === 0) {
    alertas.push({
      nivel: 'forte',
      titulo: 'Nenhum lançamento neste período',
      detalhe: 'Confira se os dados deste setor estão sendo lançados no sistema.',
    });
  }

  // Valor muito acima da média dos meses (ou dias) com lançamento. Caminhões: total e cada CW.
  const colunasChecadas = r.slug === 'caminhoes' ? [0, 1, 2, 3] : [0];
  for (const c of colunasChecadas) {
    const coluna = r.colunas[c];
    const serie = r.linhas.map((l) => ({ l, v: l.valores[c] ?? 0 })).filter((x) => x.v > 0);
    if (serie.length < 3) continue;
    const media = serie.reduce((t, x) => t + x.v, 0) / serie.length;
    const maior = serie.reduce((a, b) => (b.v > a.v ? b : a));
    if (maior.v > 3 * media) {
      alertas.push({
        nivel: 'forte',
        titulo: `${coluna.rotulo}: ${nomeDoBalde(r, maior.l.chave)} com ${fmt(maior.v, coluna.casas)} ${coluna.unidade}`,
        detalhe: `Média dos períodos com lançamento: ${fmt(media, coluna.casas)} ${coluna.unidade}. Mais de três vezes a média, vale conferir o lançamento.`,
      });
    }
  }

  return alertas;
}
