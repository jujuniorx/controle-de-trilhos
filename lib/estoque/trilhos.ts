/**
 * Estoque de trilhos: posições, saldos e contas da planilha "Controle de Estoque - 2026"
 * (abas "Estoque Novo e Reemprego" e "Estoque sucata"). Funções puras, sem banco.
 */

/** Data do saldo inicial (planilha). Só fatos depois desta data mexem no saldo. */
export const CORTE_SALDO_INICIAL = '2026-11-24';
export const METROS_BARRA = 24;
export const METROS_TLS = 312;
/** 1 TLS novo = 11 barras lisas + 2 talas (barras com furos), todas de 24 m. */
export const LISAS_POR_TLS = 11;
export const TALAS_POR_TLS = 2;
/** Sucata: toneladas com 5% de desgaste. */
export const FATOR_DESGASTE_SUCATA = 0.95;

export type Secao = 'NOVO' | 'REEMPREGO' | 'SUCATA';
export type TipoNovo = 'TLS' | 'LISA' | 'TALA' | 'CURTA12' | 'MENOR12';
export type ClasseNovo = 'NORMAL' | '21M' | 'TORCIDO' | 'TESTE';
export type Fabricante = 'NIPPON' | 'EVRAZ' | 'PANGANG' | 'ARCELORMITTAL' | 'UHCX' | 'DIVERSOS';

/**
 * Uma linha do estoque.
 * classe: NOVO → ClasseNovo; REEMPREGO → G1 | G2 | G3 (ou TLS, para TLS de reemprego); SUCATA → SC1 | SC2 | SC3.
 */
export interface Posicao {
  secao: Secao;
  perfil: string;
  tipo: TipoNovo | 'BARRA';
  fabricante: Fabricante | null;
  classe: string;
}

export type OrigemTipo = 'SALDO_INICIAL' | 'AJUSTE' | 'RECEBIMENTO' | 'REMETIDO' | 'PRODUCAO' | 'TRILHEIRO';

export interface Lancamento extends Posicao {
  /** yyyy-mm-dd */
  data: string;
  /** Positivo entra, negativo sai. TLS também tem metros (unidades × 312). */
  metros: number;
  /** Só para TLS. */
  unidades: number | null;
  origemTipo: OrigemTipo;
  origemId: string | null;
  descricao: string;
  /** Algo para o escritório conferir (ex.: envio de novo sem Lisa/Tala). */
  alerta?: string;
}

export interface Saldo extends Posicao {
  metros: number;
  unidades: number | null;
}

export const ROTULO_FABRICANTE: Record<Fabricante, string> = {
  NIPPON: 'Nippon',
  EVRAZ: 'Evraz',
  PANGANG: 'Pangang',
  ARCELORMITTAL: 'Arcelormittal',
  UHCX: 'UHCX',
  DIVERSOS: 'Diversos',
};

export const ROTULO_CLASSE_NOVO: Record<ClasseNovo, string> = {
  NORMAL: 'Novo',
  '21M': 'Novo 21 metros',
  TORCIDO: 'Torcido',
  TESTE: 'Trilho teste',
};

const FATORES: Record<string, number> = {
  TR22: 0.022,
  TR32: 0.032,
  TR37: 0.037,
  TR40: 0.04,
  TR45: 0.045,
  TR50: 0.05,
  TR54: 0.054,
  TR55: 0.055,
  TR57: 0.057,
  TR60: 0.06,
  UIC60: 0.06,
  TR68: 0.068,
};

/** Ordem dos perfis nas tabelas (como na planilha). */
export const ORDEM_PERFIS = ['TR22', 'TR32', 'TR37', 'TR40', 'TR45', 'TR50', 'TR54', 'TR55', 'TR57', 'TR60', 'UIC60', 'TR68'];
const ORDEM_SECAO: Secao[] = ['NOVO', 'REEMPREGO', 'SUCATA'];
const ORDEM_TIPO = ['TLS', 'LISA', 'TALA', 'CURTA12', 'MENOR12', 'BARRA'];

export function chavePosicao(p: Posicao): string {
  return [p.secao, p.perfil, p.tipo, p.fabricante ?? '', p.classe].join('|');
}

/** "Pangang 4", "Pangang 5" e "PANGANG" são o mesmo Pangang no estoque (a separação é só física). */
export function normalizarFabricante(nome: string | null | undefined): Fabricante | null {
  const n = (nome ?? '').trim().toUpperCase();
  if (!n) return null;
  if (n.startsWith('PANGANG')) return 'PANGANG';
  if (n.startsWith('ARCELOR')) return 'ARCELORMITTAL';
  if (n.startsWith('NIPPON')) return 'NIPPON';
  if (n.startsWith('EVRAZ')) return 'EVRAZ';
  if (n.startsWith('UHCX')) return 'UHCX';
  return 'DIVERSOS';
}

export function fatorPerfil(perfil: string): number {
  return FATORES[perfil] ?? 0;
}

export function toneladas(p: Pick<Posicao, 'secao' | 'perfil'>, metros: number): number {
  const t = metros * fatorPerfil(p.perfil);
  return p.secao === 'SUCATA' ? t * FATOR_DESGASTE_SUCATA : t;
}

function indice<T>(lista: readonly T[], v: T): number {
  const i = lista.indexOf(v);
  return i < 0 ? lista.length : i;
}

function compararPosicao(a: Posicao, b: Posicao): number {
  return (
    indice(ORDEM_SECAO, a.secao) - indice(ORDEM_SECAO, b.secao) ||
    indice(ORDEM_PERFIS, a.perfil) - indice(ORDEM_PERFIS, b.perfil) ||
    (a.fabricante ?? '').localeCompare(b.fabricante ?? '') ||
    a.classe.localeCompare(b.classe) ||
    indice(ORDEM_TIPO, a.tipo) - indice(ORDEM_TIPO, b.tipo)
  );
}

const arred = (n: number) => Math.round(n * 1000) / 1000;

/** Saldo de cada linha no fim do dia `ate` (yyyy-mm-dd). */
export function saldosAte(lancamentos: Lancamento[], ate: string): Saldo[] {
  return somarSaldos(lancamentos.filter((l) => l.data <= ate));
}

export function somarSaldos(lancamentos: Lancamento[]): Saldo[] {
  const porChave = new Map<string, Saldo>();
  for (const l of lancamentos) {
    const k = chavePosicao(l);
    const atual = porChave.get(k);
    if (atual) {
      atual.metros = arred(atual.metros + l.metros);
      if (l.unidades != null) atual.unidades = (atual.unidades ?? 0) + l.unidades;
    } else {
      porChave.set(k, {
        secao: l.secao,
        perfil: l.perfil,
        tipo: l.tipo,
        fabricante: l.fabricante,
        classe: l.classe,
        metros: arred(l.metros),
        unidades: l.unidades,
      });
    }
  }
  return [...porChave.values()].sort(compararPosicao);
}

export interface MovimentoPeriodo {
  anterior: number;
  entradas: number;
  saidas: number;
  saldo: number;
}

/** Saldo anterior, entradas e saídas de uma posição no período (como as colunas de conta da planilha). TLS em unidades. */
export function movimentoDoPeriodo(lancamentos: Lancamento[], chave: string, de: string, ate: string): MovimentoPeriodo {
  let anterior = 0;
  let entradas = 0;
  let saidas = 0;
  for (const l of lancamentos) {
    if (chavePosicao(l) !== chave || l.data > ate) continue;
    const v = l.tipo === 'TLS' ? l.unidades ?? 0 : l.metros;
    if (l.data < de || l.origemTipo === 'SALDO_INICIAL') anterior += v;
    else if (v >= 0) entradas += v;
    else saidas += -v;
  }
  return { anterior: arred(anterior), entradas: arred(entradas), saidas: arred(saidas), saldo: arred(anterior + entradas - saidas) };
}

export interface TlsPossiveis {
  fabricante: Fabricante;
  tls: number;
  /** O material que acaba primeiro (null quando os dois dão o mesmo número). */
  trava: 'LISA' | 'TALA' | null;
  lisasBarras: number;
  talasBarras: number;
  sobraLisas: number;
  sobraTalas: number;
}

/** Barras inteiras de 24 m num saldo em metros (saldo negativo conta como zero). */
export function barrasDe(metros: number): number {
  return Math.floor(Math.max(0, metros) / METROS_BARRA + 1e-9);
}

/**
 * Quantos TLS dá para formar com as lisas e talas de cada fabricante do perfil.
 * Conta só o novo normal e o trilho teste (barras de 21 m e torcido não entram na solda).
 */
export function tlsPossiveisPorFabricante(saldos: Saldo[], perfil: string): TlsPossiveis[] {
  const porFab = new Map<Fabricante, { lisas: number; talas: number }>();
  for (const s of saldos) {
    if (s.secao !== 'NOVO' || s.perfil !== perfil || !s.fabricante) continue;
    if (s.classe !== 'NORMAL' && s.classe !== 'TESTE') continue;
    if (s.tipo !== 'LISA' && s.tipo !== 'TALA') continue;
    const atual = porFab.get(s.fabricante) ?? { lisas: 0, talas: 0 };
    if (s.tipo === 'LISA') atual.lisas += s.metros;
    else atual.talas += s.metros;
    porFab.set(s.fabricante, atual);
  }
  const lista: TlsPossiveis[] = [];
  for (const [fabricante, m] of porFab) {
    const lisasBarras = barrasDe(m.lisas);
    const talasBarras = barrasDe(m.talas);
    const porLisa = Math.floor(lisasBarras / LISAS_POR_TLS);
    const porTala = Math.floor(talasBarras / TALAS_POR_TLS);
    const tls = Math.min(porLisa, porTala);
    const trava = porLisa === porTala ? null : porLisa < porTala ? 'LISA' : 'TALA';
    lista.push({
      fabricante,
      tls,
      trava,
      lisasBarras,
      talasBarras,
      sobraLisas: lisasBarras - tls * LISAS_POR_TLS,
      sobraTalas: talasBarras - tls * TALAS_POR_TLS,
    });
  }
  return lista.sort((a, b) => b.tls - a.tls || a.fabricante.localeCompare(b.fabricante));
}
