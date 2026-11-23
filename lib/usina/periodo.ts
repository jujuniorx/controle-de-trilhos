// Períodos do Relatório da usina: dia, semana (segunda a domingo) e mês. Datas 'AAAA-MM-DD', sem fuso.
// A sexta não entra: o que foi feito na sexta só se sabe na segunda seguinte.
import { somarDias } from '@/lib/usina/diasUteis';

export type Periodo = 'dia' | 'semana' | 'mes';

export const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 'dia', rotulo: 'Dia' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
];

export function ehIsoValido(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

/** Segunda-feira da semana que contém a data. */
export function inicioDaSemana(iso: string): string {
  const dia = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = domingo
  const deslocamento = dia === 0 ? -6 : 1 - dia;
  return somarDias(iso, deslocamento);
}

/** Faixa de dias escolhida à mão (ex.: sexta a domingo, para o relatório de segunda). */
export interface Faixa { inicio: string; fim: string }

export function intervaloDoPeriodo(periodo: Periodo | Faixa, data: string): { inicio: string; fim: string } {
  if (typeof periodo === 'object') return { inicio: periodo.inicio, fim: periodo.fim };
  if (periodo === 'dia') return { inicio: data, fim: data };
  if (periodo === 'semana') {
    const inicio = inicioDaSemana(data);
    return { inicio, fim: somarDias(inicio, 6) };
  }
  const [ano, mes] = data.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${String(ultimo).padStart(2, '0')}` };
}

/** Faixa da semana da data, segunda a domingo, no formato dd/mm a dd/mm/aaaa. */
export function faixaSemanaSegSex(iso: string): string {
  const inicio = inicioDaSemana(iso);
  const fim = somarDias(inicio, 6);
  const br = (x: string) => x.split('-').reverse().join('/');
  return `${br(inicio).slice(0, 5)} a ${br(fim)}`;
}

/** Formato do relatório: semanal (uma tabela com a semana) ou diário (um número por dia). */
export type ModoRelatorio = 'semanal' | 'diario' | 'mensal';

/** Colunas de número que o relatório mostra: qualquer combinação de Dia, Semana e No mês. */
export type Coluna = 'dia' | 'semana' | 'mes';
export const TODAS_COLUNAS: Coluna[] = ['dia', 'semana', 'mes'];

/** Lê ?col=dia&col=mes (ou col=dia,mes). Sem valor válido, mostra as três. */
export function colunasValidas(v: string | string[] | undefined): Coluna[] {
  const lista = (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(','));
  const escolhidas = TODAS_COLUNAS.filter((c) => lista.includes(c));
  return escolhidas.length > 0 ? escolhidas : TODAS_COLUNAS;
}

export function modoValido(v: string | undefined): ModoRelatorio {
  return v === 'diario' ? 'diario' : v === 'mensal' ? 'mensal' : 'semanal';
}

/** Mês da data até o próprio dia (mesmo critério da coluna No mês), no formato dd/mm/aaaa. */
export function mesAte(data: string): string {
  const [ano, mes] = data.split('-');
  return `01/${mes}/${ano} a ${data.split('-').reverse().join('/')}`;
}

/** Rótulo do período no topo do relatório: a semana, ou o dia escolhido quando o formato é diário. */
/** Rótulo da coluna "do dia" com o dia da semana escolhido, ex.: "Do dia (sexta-feira, 23/10)". */
export function rotuloDoDia(data: string): string {
  const nome = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${data}T12:00:00Z`).getUTCDay()];
  return `Do dia (${nome}, ${data.split('-').reverse().slice(0, 2).join('/')})`;
}

export function rotuloPeriodo(data: string, modo: ModoRelatorio, desde: string = data): { titulo: string; valor: string } {
  if (modo === 'mensal') return { titulo: 'Mês', valor: mesAte(data) };
  if (modo === 'diario' && desde < data) return { titulo: 'Período', valor: rotuloFaixaLonga(desde, data) };
  if (modo === 'diario') {
    const nome = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date(`${data}T12:00:00Z`).getUTCDay()];
    return { titulo: 'Dia', valor: `${nome}, ${data.split('-').reverse().join('/')}` };
  }
  return { titulo: 'Semana (segunda a domingo)', valor: faixaSemanaSegSex(data) };
}

/** Seletor semanal/diário: dois links que trocam o formato mantendo o dia e o setor. */
export function linksModo(base: string, modoAtual: ModoRelatorio, params: Record<string, string>, comMensal = false): { modo: ModoRelatorio; rotulo: string; href: string; ativo: boolean }[] {
  const modos: ModoRelatorio[] = comMensal ? ['diario', 'semanal', 'mensal'] : ['diario', 'semanal'];
  const rotulos: Record<ModoRelatorio, string> = { semanal: 'Semanal', diario: 'Diário', mensal: 'Mensal' };
  return modos.map((modo) => {
    const qs = new URLSearchParams({ ...params, modo }).toString();
    return { modo, rotulo: rotulos[modo], href: `${base}?${qs}`, ativo: modo === modoAtual };
  });
}

// ─── Relatório de vários dias (ex.: segunda-feira mostrando sexta, sábado e domingo) ───────────────

/** No máximo uma semana de dias num relatório diário. */
export const MAX_DIAS_FAIXA = 7;

/** Primeiro dia do relatório: o "desde" pedido, se for válido e anterior à data; senão a própria data (um dia só). */
export function desdeValido(desde: string | undefined | null, data: string): string {
  if (!ehIsoValido(desde ?? undefined) || desde! >= data) return data;
  const limite = somarDias(data, -(MAX_DIAS_FAIXA - 1));
  return desde! < limite ? limite : desde!;
}

/** Todos os dias de inicio a fim, inclusive. */
export function diasDaFaixa(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  for (let d = inicio; d <= fim && dias.length < 62; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

const NOME_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const NOME_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "Sex 20/11". */
export function rotuloDiaCurto(iso: string): string {
  return `${NOME_CURTO[diaSemana(iso)]} ${ddmm(iso)}`;
}

/** "Sex 20/11" (um dia), "Sex 20 a Dom 22/11" (mesmo mês) ou "Sex 30/10 a Dom 01/11". */
export function rotuloFaixaCurta(inicio: string, fim: string): string {
  if (inicio === fim) return rotuloDiaCurto(inicio);
  const mesmoMes = inicio.slice(0, 7) === fim.slice(0, 7);
  const ini = mesmoMes ? `${NOME_CURTO[diaSemana(inicio)]} ${inicio.slice(8, 10)}` : rotuloDiaCurto(inicio);
  return `${ini} a ${rotuloDiaCurto(fim)}`;
}

/** "Sexta, 20/11 a domingo, 22/11/2026", para o topo e o rodapé do relatório. */
export function rotuloFaixaLonga(inicio: string, fim: string): string {
  const nome = NOME_LONGO[diaSemana(inicio)]!;
  return `${nome[0]!.toUpperCase()}${nome.slice(1)}, ${ddmm(inicio)} a ${NOME_LONGO[diaSemana(fim)]}, ${fim.split('-').reverse().join('/')}`;
}

/** Sexta a domingo do último fim de semana antes de hoje (na segunda, é o que acabou ontem). */
export function ultimoFimDeSemana(hoje: string): { desde: string; data: string } {
  const domingo = somarDias(hoje, -(diaSemana(hoje) || 7));
  return { desde: somarDias(domingo, -2), data: domingo };
}

/**
 * Observações de vários dias numa lista curta: cada linha começa pelo dia ("Sex 20/11 · texto"). Quando o mesmo item
 * (a mesma equipe, composição ou caminhão) repete o mesmo texto em dias seguidos, os dias viram uma faixa só
 * ("Sex 20 a Dom 22/11 · texto"), para a caixa de observação não encher com a mesma frase três vezes.
 */
export function linhasPorDia(entradas: { data: string; chave: string; texto: string }[], dias: string[]): string[] {
  const posicao = new Map(dias.map((d, i) => [d, i]));
  const grupos: { chave: string; texto: string; ini: string; fim: string; ultimo: number }[] = [];
  const ordenadas = entradas
    .filter((e) => posicao.has(e.data) && e.texto.trim())
    .sort((a, b) => (a.data === b.data ? 0 : a.data < b.data ? -1 : 1));
  for (const e of ordenadas) {
    const i = posicao.get(e.data)!;
    const texto = e.texto.trim();
    const g = grupos.find((x) => x.chave === e.chave && x.texto === texto && x.ultimo === i - 1);
    if (g) {
      g.fim = e.data;
      g.ultimo = i;
    } else {
      grupos.push({ chave: e.chave, texto, ini: e.data, fim: e.data, ultimo: i });
    }
  }
  return grupos.map((g) => `${rotuloFaixaCurta(g.ini, g.fim)} · ${g.texto}`);
}

/**
 * Motivo de um dia sem produção, quando a observação é só isso ("Feriado", "sábado", "Folga."). Sábado, domingo e
 * fim de semana viram "Folga": o nome do dia já aparece no gráfico. Qualquer texto além da palavra não é motivo.
 */
const MOTIVOS: Record<string, string> = {
  feriado: 'Feriado',
  folga: 'Folga',
  sabado: 'Folga',
  domingo: 'Folga',
  'fim de semana': 'Folga',
  parado: 'Parado',
  recesso: 'Recesso',
};
export function motivoDoDia(texto: string): string | null {
  const t = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[.!;,]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return MOTIVOS[t] ?? null;
}

/** "Equipe 2" e "Equipe 3" viram "Equipes 2 e 3"; nomes diferentes ficam como estão ("W61 e W62"). */
function juntarRotulos(rotulos: string[]): string {
  if (rotulos.length <= 1) return rotulos[0] ?? '';
  const e = (lista: string[]) => `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`;
  const partes = rotulos.map((r) => /^(Equipe) (\S.*)$/.exec(r));
  if (partes.every((p) => p)) return `Equipes ${e(partes.map((p) => p![2]!))}`;
  return e(rotulos);
}

/** Uma observação de um dia, de uma equipe, composição ou do setor (sem rótulo). */
export interface EntradaObservacao { data: string; rotulo?: string; texto: string }

/**
 * Observações de vários dias separadas em duas partes:
 * - `motivos`: o motivo de cada dia sem produção ("Feriado", "Folga"), para aparecer no próprio gráfico, embaixo do dia;
 * - `linhas`: o resto, que é informação de verdade, com o dia na frente. O mesmo texto em dias seguidos vira uma faixa
 *   ("Sáb 21 a Dom 22/11 · ...") e o mesmo texto de várias equipes no mesmo dia vira uma linha ("Equipes 2 e 3: ...").
 * Um motivo só sai da lista quando o dia não teve produção e bate com o motivo escolhido para o dia; o resto continua na
 * lista, para nada sumir.
 */
export function separarObservacoes(
  entradas: EntradaObservacao[],
  dias: string[],
  semProducao: (dia: string) => boolean,
): { motivos: Record<string, string>; linhas: string[] } {
  const posicao = new Map(dias.map((d, i) => [d, i]));
  const validas = entradas
    .filter((e) => posicao.has(e.data) && e.texto.trim())
    .map((e) => ({ data: e.data, rotulo: e.rotulo?.trim() ?? '', texto: e.texto.trim() }));

  const motivos: Record<string, string> = {};
  for (const d of dias) {
    if (!semProducao(d)) continue;
    const contagem = new Map<string, number>();
    for (const e of validas) {
      if (e.data !== d) continue;
      const m = motivoDoDia(e.texto);
      if (m) contagem.set(m, (contagem.get(m) ?? 0) + 1);
    }
    let melhor: string | null = null;
    for (const [m, n] of contagem) if (melhor === null || n > contagem.get(melhor)!) melhor = m;
    if (melhor) motivos[d] = melhor;
  }

  const resto = validas
    .filter((e) => !(motivos[e.data] && motivoDoDia(e.texto) === motivos[e.data]))
    .sort((a, b) => (a.data === b.data ? 0 : a.data < b.data ? -1 : 1));

  // 1) Mesmo rótulo e mesmo texto em dias seguidos: uma faixa de dias.
  const faixas: { rotulo: string; texto: string; ini: string; fim: string; ultimo: number }[] = [];
  for (const e of resto) {
    const i = posicao.get(e.data)!;
    const f = faixas.find((x) => x.rotulo === e.rotulo && x.texto === e.texto && x.ultimo === i - 1);
    if (f) {
      f.fim = e.data;
      f.ultimo = i;
    } else faixas.push({ rotulo: e.rotulo, texto: e.texto, ini: e.data, fim: e.data, ultimo: i });
  }
  // 2) Mesma faixa de dias e mesmo texto em rótulos diferentes: uma linha só.
  const grupos: { ini: string; fim: string; texto: string; rotulos: string[] }[] = [];
  for (const f of faixas) {
    const g = grupos.find((x) => x.ini === f.ini && x.fim === f.fim && x.texto === f.texto);
    if (g) {
      if (f.rotulo && !g.rotulos.includes(f.rotulo)) g.rotulos.push(f.rotulo);
    } else grupos.push({ ini: f.ini, fim: f.fim, texto: f.texto, rotulos: f.rotulo ? [f.rotulo] : [] });
  }
  grupos.sort((a, b) => (a.ini === b.ini ? 0 : a.ini < b.ini ? -1 : 1));
  const linhas = grupos.map((g) => `${rotuloFaixaCurta(g.ini, g.fim)} · ${g.rotulos.length ? `${juntarRotulos(g.rotulos)}: ` : ''}${g.texto}`);
  return { motivos, linhas };
}
