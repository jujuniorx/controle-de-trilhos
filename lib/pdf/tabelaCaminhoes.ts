import { PaginaPdf, larguraTexto, quebrarLinhas } from '@/lib/pdf/simples';
import type { CaminhaoTabelaRelatorio } from '@/lib/services/onePageUsina';
import type { Coluna } from '@/lib/usina/periodo';

type Cor = [number, number, number];
const hex = (h: string): Cor => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const BRANCO: Cor = [1, 1, 1];
const LINHA: Cor = [0.86, 0.88, 0.91];
const TINTA: Cor = [0.1, 0.12, 0.16];
const CINZA: Cor = [0.42, 0.45, 0.5];
const NAVY: Cor = hex('#0b1b31');
const ZEBRA: Cor = [0.955, 0.965, 0.975];
const SOMBRA: Cor = [0.9, 0.92, 0.945];

type Grupo = 'solda' | 'corte';
type Numero = `${Grupo}-${Coluna}`;
const NOME: Record<Coluna, string> = { dia: 'DIA', semana: 'SEMANA', mes: 'NO MÊS' };
const PASSO = 68;
const INICIO = 200;

/**
 * Tabela do caminhão de solda, no mesmo formato da tabela de trilheiros: uma linha por caminhão.
 * As colunas são as escolhidas (Dia, Semana, No mês). Observação só no diário.
 */
export function desenharCaminhoes(
  p: PaginaPdf,
  caminhoes: CaminhaoTabelaRelatorio[],
  cor: string,
  x: number,
  topo: number,
  w: number,
  h: number,
  modo: 'semanal' | 'diario' | 'mensal' = 'semanal',
  colunas: Coluna[] = ['dia', 'semana', 'mes'],
) {
  const base = topo - h;
  const corSetor = hex(cor);
  // Observação no mesmo estilo do trilheiro: aparece no semanal e no diário (não no mensal).
  const comObservacao = modo !== 'mensal';
  p.arredondado(x + 1.2, base - 1.4, w, h, 9, SOMBRA);
  p.arredondado(x, base, w, h, 9, BRANCO, LINHA);
  p.arredondado(x, topo - 22, w, 22, 9, corSetor);
  p.retangulo(x, topo - 22, w, 8, corSetor);
  p.texto('CAMINHÃO DE SOLDA', x + 10, topo - 14, 8, 'negrito', BRANCO);

  // Colunas numéricas ativas, na ordem Solda (Dia, Semana, No mês) e depois Corte (Dia, Semana, No mês).
  const ordem: Numero[] = [];
  for (const g of ['solda', 'corte'] as Grupo[]) {
    for (const c of ['dia', 'semana', 'mes'] as Coluna[]) {
      if (colunas.includes(c)) ordem.push(`${g}-${c}`);
    }
  }
  const posicao = (n: Numero) => INICIO + ordem.indexOf(n) * PASSO;
  const xLocal = INICIO + ordem.length * PASSO - 10;
  const xObs = xLocal + 90;

  const yGrupo = topo - 34;
  const yCabecalho = topo - 44;
  const dir = (texto: string, xDireita: number, y: number, tamanho: number, fonte: 'normal' | 'negrito', c: Cor) =>
    p.texto(texto, x + xDireita - larguraTexto(texto, tamanho, fonte), y, tamanho, fonte, c);
  const centroGrupo = (texto: string, g: Grupo) => {
    const cols = ordem.filter((n) => n.startsWith(`${g}-`));
    if (cols.length === 0) return;
    const a = posicao(cols[0]!);
    const b = posicao(cols[cols.length - 1]!);
    const meio = x + (a + b) / 2;
    p.texto(texto, meio - larguraTexto(texto, 7, 'negrito') / 2, yGrupo, 7, 'negrito', TINTA);
  };
  centroGrupo('SOLDA (UND)', 'solda');
  centroGrupo('CORTE (UND)', 'corte');
  p.texto('CAMINHÃO', x + 10, yCabecalho, 6.5, 'negrito', CINZA);
  ordem.forEach((n) => dir(NOME[n.split('-')[1] as Coluna], posicao(n), yCabecalho, 6.5, 'negrito', CINZA));
  p.texto('LOCAL', x + xLocal, yCabecalho, 6.5, 'negrito', CINZA);
  if (comObservacao) p.texto('OBSERVAÇÃO', x + xObs, yCabecalho, 6.5, 'negrito', CINZA);
  p.linha(x + 8, yCabecalho - 6, x + w - 8, yCabecalho - 6, LINHA, 0.6);

  // Linhas mais altas para a observação caber em até 4 linhas.
  const altLinha = 40;
  const primeiraBase = yCabecalho - 22;
  caminhoes.forEach((c, i) => {
    const y = primeiraBase - i * altLinha;
    if (i % 2 === 1) p.retangulo(x + 4, y - 10, w - 8, altLinha - 2, ZEBRA);
    p.texto(c.nome, x + 10, y, 10, 'negrito', TINTA);
    ordem.forEach((n) => {
      const [g, k] = n.split('-') as [Grupo, Coluna];
      const valor = c[g][k];
      const destaque = k === 'mes';
      dir(String(valor), posicao(n), y, 10, 'negrito', destaque ? corSetor : TINTA);
    });
    // Local em etiqueta escura, como no trilheiro.
    if (c.local) {
      const tamanho = 8;
      const largura = Math.max(larguraTexto(c.local, tamanho, 'negrito') + 12, 34);
      const alturaEtiqueta = 13;
      const yEtiqueta = y - 3;
      p.arredondado(x + xLocal, yEtiqueta, largura, alturaEtiqueta, 6, NAVY);
      const xTexto = x + xLocal + (largura - larguraTexto(c.local, tamanho, 'negrito')) / 2;
      const yTexto = yEtiqueta + (alturaEtiqueta - tamanho * 0.7) / 2;
      p.texto(c.local, xTexto, yTexto, tamanho, 'negrito', BRANCO);
    } else {
      p.texto('—', x + xLocal, y, 9, 'normal', CINZA);
    }
    if (comObservacao) {
      const linhas = c.observacao ? quebrarLinhas(c.observacao, 7.5, w - xObs - 16) : [];
      // A primeira linha começa mais abaixo: sem isso o topo do texto encostava na linha do cabeçalho.
      linhas.slice(0, 4).forEach((linha, k) => p.texto(linha, x + xObs, y + 5 - k * 8.5, 7.5, 'normal', CINZA));
    }
  });
}
