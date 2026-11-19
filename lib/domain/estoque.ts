/**
 * Regras do Estoque que não dependem do banco: situação em relação ao mínimo, calibração,
 * peso dos trilhos pela tabela de fatores, quantos dias ainda dá e o nome dos itens de Trilhos.
 */

export const AREA_TRILHOS = 'area-trilhos';
export const AREA_ALMOXARIFADO = 'area-almoxarifado';
export const AREA_METROLOGIA = 'area-metrologia';
export const AREA_OLEO = 'area-oleo';

export type CategoriaTrilho = 'PERFIL' | 'TALA' | 'LISA';
export const CATEGORIAS_TRILHO: CategoriaTrilho[] = ['PERFIL', 'TALA', 'LISA'];
export const ROTULO_CATEGORIA: Record<CategoriaTrilho, string> = { PERFIL: 'Perfil', TALA: 'Tala', LISA: 'Barra lisa' };
/** Unidade gravada de cada categoria: perfil em metros, tala em pares, barra lisa em unidades (barras). */
export const UNIDADE_CATEGORIA: Record<CategoriaTrilho, string> = { PERFIL: 'm', TALA: 'par', LISA: 'un' };

/** Perfis que aparecem para escolher no cadastro (TOCO é só do Remetido). */
export const PERFIS_ESTOQUE = ['TR22', 'TR32', 'TR37', 'TR40', 'TR45', 'TR50', 'TR54', 'TR55', 'TR57', 'TR60', 'TR68'] as const;
export type PerfilEstoque = (typeof PERFIS_ESTOQUE)[number];

export function ehCategoriaTrilho(v: unknown): v is CategoriaTrilho {
  return typeof v === 'string' && (CATEGORIAS_TRILHO as string[]).includes(v);
}
export function ehPerfilEstoque(v: unknown): v is PerfilEstoque {
  return typeof v === 'string' && (PERFIS_ESTOQUE as readonly string[]).includes(v);
}

/** Nome do item de Trilhos, montado a partir das escolhas (sem digitar). */
export function nomeItemTrilho(v: { categoria: CategoriaTrilho; perfil: string; furos?: number | null; comprimentoBarra?: number | null }): string {
  if (v.categoria === 'TALA') return `Tala ${v.perfil}${v.furos ? ` · ${v.furos} furos` : ''}`;
  if (v.categoria === 'LISA') return `Barra lisa ${v.perfil}${v.comprimentoBarra ? ` · ${fmtNum(v.comprimentoBarra)} m` : ''}`;
  return v.perfil;
}

/** Como a unidade aparece na tela: barra lisa é contada em "barras", tala em "pares". */
export function rotuloUnidade(unidade: string, categoria?: string | null, quantidade = 2): string {
  if (categoria === 'LISA') return quantidade === 1 ? 'barra' : 'barras';
  if (unidade === 'par') return quantidade === 1 ? 'par' : 'pares';
  return unidade;
}

/** Toneladas de um item de Trilhos. Tala não tem peso calculado (null). Fator em t/m (TR68 = 0,068). */
export function toneladasTrilho(v: { categoria: string | null; quantidade: number; fator: number | null; comprimentoBarra?: number | null }): number | null {
  if (v.fator == null) return null;
  if (v.categoria === 'PERFIL') return v.quantidade * v.fator;
  if (v.categoria === 'LISA' && v.comprimentoBarra) return v.quantidade * v.comprimentoBarra * v.fator;
  return null;
}

/** Metros de um item de Trilhos (perfil: o próprio saldo; barra lisa: barras x comprimento). */
export function metrosTrilho(v: { categoria: string | null; quantidade: number; comprimentoBarra?: number | null }): number | null {
  if (v.categoria === 'PERFIL') return v.quantidade;
  if (v.categoria === 'LISA' && v.comprimentoBarra) return v.quantidade * v.comprimentoBarra;
  return null;
}

export type SituacaoNivel = 'semMinimo' | 'ok' | 'baixo' | 'zerado';

export function situacaoNivel(quantidade: number, minimo: number | null): SituacaoNivel {
  if (quantidade <= 0) return 'zerado';
  if (minimo == null || minimo <= 0) return 'semMinimo';
  return quantidade < minimo ? 'baixo' : 'ok';
}

export function precisaRepor(s: SituacaoNivel): boolean {
  return s === 'baixo' || s === 'zerado';
}

/** Quantos dos 10 gomos acender: a barra vai até o dobro do mínimo (meio = mínimo). Sem mínimo: cheia se tem saldo. */
export function gomosAcesos(quantidade: number, minimo: number | null): number {
  if (quantidade <= 0) return 0;
  if (minimo == null || minimo <= 0) return 10;
  return Math.max(1, Math.min(10, Math.round((quantidade / (minimo * 2)) * 10)));
}

/** Percentual do saldo sobre o mínimo (100 = no mínimo), para a coluna "Nível". */
export function percentualDoMinimo(quantidade: number, minimo: number | null): number | null {
  if (minimo == null || minimo <= 0) return null;
  return Math.round((quantidade / minimo) * 100);
}

export type SituacaoCalibracao = 'nenhuma' | 'emDia' | 'vence' | 'vencida';

/** Datas em AAAA-MM-DD. "vence" = vence em até 30 dias. */
export function situacaoCalibracao(validade: string | null, hoje: string): SituacaoCalibracao {
  if (!validade) return 'nenhuma';
  if (validade < hoje) return 'vencida';
  const limite = new Date(`${hoje}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + 30);
  return validade <= limite.toISOString().slice(0, 10) ? 'vence' : 'emDia';
}

/** Dias que o saldo ainda dura pelo consumo dos últimos 30 dias. Sem consumo: null (não dá para prever). */
export function diasRestantes(quantidade: number, consumo30: number): number | null {
  if (consumo30 <= 0) return null;
  return Math.floor(quantidade / (consumo30 / 30));
}

/** Escala do Pátio de perfis: arredonda para cima em degraus de 500 m (mínimo 1.000 m). */
export function escalaMetros(valores: number[]): number {
  const maior = Math.max(0, ...valores);
  return Math.max(1000, Math.ceil(maior / 500) * 500);
}

/** Lê número digitado ("1.200", "12,5", "12.5"). Vazio = null; inválido ou negativo = NaN. */
export function lerNumero(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  // "1.200" ou "1.200,5": ponto é milhar. "12.5" sem vírgula e com 1-2 casas: ponto é decimal.
  const normal = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN;
}

export function fmtNum(n: number, casas = 3): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

/** Dia (AAAA-MM-DD) no fuso de São Paulo. */
export function diaSP(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
