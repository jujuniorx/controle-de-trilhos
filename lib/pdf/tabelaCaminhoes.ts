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
// Solda reprovada no mês: vermelho de perda, só quando há reprovação.
const PERDA: Cor = hex('#dc2626');
const CINZA: Cor = [0.42, 0.45, 0.5];
const NAVY: Cor = hex('#0b1b31');
const ZEBRA: Cor = [0.955, 0.965, 0.975];
const SOMBRA: Cor = [0.9, 0.92, 0.945];

type Grupo = 'solda' | 'corte';
type Numero = `${Grupo}-${Coluna}`;
const NOME: Record<Coluna, string> = { dia: 'DIA', semana: 'SEMANA', mes: 'NO MÊS' };
const PASSO = 68;

const INICIO = 200;
// Altura de cada linha de caminhão: cabe a observação em até 3 linhas.
const ALT_LINHA = 32;

/** Altura do cartão para `n` caminhões: cabeçalho, as linhas e a mesma folga embaixo dos trilheiros. */
export function alturaCaminhoes(n: number): number {
  return Math.max(90, 86 + Math.max(0, n - 1) * ALT_LINHA);
}

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
  rotuloDia = 'DIA',
) {
  const base = topo - h;
  const corSetor = hex(cor);
  // Texto centralizado em xc (coordenada absoluta da página).
  const textoCentroLocal = (texto: string, xc: number, yy: number, tamanho: number, fonte: 'normal' | 'negrito', c: Cor) =>
    p.texto(texto, xc, yy, tamanho, fonte, c, 'meio');
  // Observação no mesmo estilo do trilheiro: aparece no semanal e no diário (não no mensal).
  const comObservacao = modo !== 'mensal';
  p.arredondado(x + 1.2, base - 1.4, w, h, 9, SOMBRA);
  p.arredondado(x, base, w, h, 9, BRANCO, LINHA);
  p.arredondado(x, topo - 22, w, 22, 9, corSetor);
  p.retangulo(x, topo - 22, w, 8, corSetor);
  p.texto('Caminhão de solda', x + 10, topo - 14, 8, 'negrito', BRANCO);

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
  // Números e cabeçalhos centralizados na própria coluna (cada coluna tem PASSO de largura, terminando em posicao).
  const centro = (texto: string, colunaDireita: number, y: number, tamanho: number, fonte: 'normal' | 'negrito', c: Cor) =>
    p.texto(texto, x + colunaDireita - PASSO / 2, y, tamanho, fonte, c, 'meio');
  // Título do grupo (SOLDA, SOLDA REPROVADA) centrado sobre as colunas dele.
  const centroGrupo = (texto: string, g: Grupo) => {
    const cols = ordem.filter((n) => n.startsWith(`${g}-`));
    if (cols.length === 0) return;
    const a = posicao(cols[0]!) - PASSO / 2;
    const b = posicao(cols[cols.length - 1]!) - PASSO / 2;
    p.texto(texto, x + (a + b) / 2, yGrupo, 7, 'negrito', TINTA, 'meio');
  };
  centroGrupo('SOLDA (UND)', 'solda');
  centroGrupo('SOLDA REPROVADA (UND)', 'corte');
  p.texto('CAMINHÃO', x + 10, yCabecalho, 6.5, 'negrito', CINZA);
  ordem.forEach((n) => { const k = n.split('-')[1] as Coluna; centro(k === 'dia' ? rotuloDia : NOME[k], posicao(n), yCabecalho, 6.5, 'negrito', CINZA); });
  // LOCAL centralizado na coluna (entre xLocal e xObs).
  textoCentroLocal('LOCAL', x + xLocal + 45, yCabecalho, 6.5, 'negrito', CINZA);
  if (comObservacao) p.texto('OBSERVAÇÃO', x + xObs, yCabecalho, 6.5, 'negrito', CINZA);
  p.linha(x + 8, yCabecalho - 6, x + w - 8, yCabecalho - 6, LINHA, 0.6);

  const altLinha = ALT_LINHA;
  const primeiraBase = yCabecalho - 22;
  caminhoes.forEach((c, i) => {
    const y = primeiraBase - i * altLinha;
    // Meio da linha = meio das maiúsculas dos números (10pt). A faixa zebrada fica centrada nele.
    const meioLinha = y + 3.6;
    if (i % 2 === 1) p.retangulo(x + 4, meioLinha - (altLinha - 2) / 2, w - 8, altLinha - 2, ZEBRA);
    p.texto(c.nome, x + 10, y, 10, 'negrito', TINTA);
    // Horário do dia (macro 1 → macro 9) embaixo do nome, fora do mensal.
    if (modo !== 'mensal' && c.horario) p.texto(c.horario, x + 10, y - 9, 7, 'normal', CINZA);
    ordem.forEach((n) => {
      const [g, k] = n.split('-') as [Grupo, Coluna];
      const valor = c[g][k];
      // No mês: solda na cor do setor; reprovada em vermelho quando houver alguma.
      const corValor = k !== 'mes' ? TINTA : g === 'corte' ? (valor > 0 ? PERDA : TINTA) : corSetor;
      centro(String(valor), posicao(n), y, 10, 'negrito', corValor);
    });
    // Local em etiqueta escura, como no trilheiro.
    if (c.local) {
      const tamanho = 8;
      const largura = Math.max(larguraTexto(c.local, tamanho, 'negrito') + 12, 34);
      const alturaEtiqueta = 13;
      const xEtiqueta = x + xLocal + 45 - largura / 2;
      // Etiqueta e texto centrados no meio da linha.
      const yEtiqueta = meioLinha - alturaEtiqueta / 2;
      p.arredondado(xEtiqueta, yEtiqueta, largura, alturaEtiqueta, 6, NAVY);
      p.texto(c.local, xEtiqueta + largura / 2, meioLinha - tamanho * 0.36, tamanho, 'negrito', BRANCO, 'meio');
    } else {
      textoCentroLocal('—', x + xLocal + 45, y, 9, 'normal', CINZA);
    }
    if (comObservacao) {
      // Até 3 linhas, com o bloco centrado no meio da linha (uma linha só fica na altura dos números).
      const todas = c.observacao ? quebrarLinhas(c.observacao, 7.5, w - xObs - 16) : [];
      const linhas = todas.length > 3 ? [...todas.slice(0, 2), `${todas[2]!.replace(/\s+\S*$/, '')}…`] : todas;
      const primeira = meioLinha - 7.5 * 0.36 + ((linhas.length - 1) * 8.5) / 2;
      linhas.forEach((linha, k) => p.texto(linha, x + xObs, primeira - k * 8.5, 7.5, 'normal', CINZA));
    }
  });
}
