/**
 * Números prontos para as telas do estoque de trilhos (resumo e detalhado). Funções puras sobre os saldos.
 */
import {
  ORDEM_PERFIS,
  ROTULO_FABRICANTE,
  fatorPerfil,
  tlsPossiveisPorFabricante,
  toneladas,
  type Fabricante,
  type Saldo,
  type Secao,
  type TlsPossiveis,
} from '@/lib/estoque/trilhos';
import type { ItemSap } from '@/lib/services/estoqueTrilhos';

const arred = (n: number, casas = 3) => Math.round(n * 10 ** casas) / 10 ** casas;

/** "no A", "no A e no B", "no A, no B e no C". */
function listaNo(nomes: string[]): string {
  const comNo = nomes.map((n) => `no ${n}`);
  return comNo.length <= 1 ? comNo.join('') : `${comNo.slice(0, -1).join(', ')} e ${comNo[comNo.length - 1]}`;
}

export interface CartaoPerfil {
  perfil: string;
  tlsProntos: number;
  /** Todo o novo do perfil (TLS + barras soltas), em metros. */
  metros: number;
  toneladas: number;
  possiveis: TlsPossiveis[];
  totalPossiveis: number;
  /** O que trava a formação de TLS, em texto ("lisa no Nippon; tala no Pangang e no Evraz"). */
  trava: string | null;
  /** Nota de cada fabricante: o que falta e o que sobra parado. */
  notas: Partial<Record<Fabricante, string>>;
}

const n = (v: number) => v.toLocaleString('pt-BR');

function notaFabricante(p: TlsPossiveis): string | null {
  if (p.tls === 0 && p.lisasBarras === 0 && p.talasBarras > 0) return `Sem barra lisa. ${n(p.talasBarras)} talas paradas.`;
  if (p.tls === 0 && p.talasBarras === 0 && p.lisasBarras > 0) return `Sem tala. ${n(p.lisasBarras)} lisas paradas.`;
  if (p.trava === 'LISA' && p.sobraTalas > 0) return `Falta lisa: sobram ${n(p.sobraTalas)} talas.`;
  if (p.trava === 'TALA' && p.sobraLisas > 0) return `Falta tala: sobram ${n(p.sobraLisas)} lisas.`;
  return null;
}

export function cartaoPerfil(saldos: Saldo[], perfil: string): CartaoPerfil {
  const doPerfil = saldos.filter((s) => s.secao === 'NOVO' && s.perfil === perfil);
  const tlsProntos = doPerfil.filter((s) => s.tipo === 'TLS').reduce((t, s) => t + (s.unidades ?? 0), 0);
  const metros = arred(doPerfil.reduce((t, s) => t + s.metros, 0));
  const possiveis = tlsPossiveisPorFabricante(saldos, perfil);
  const lisa = possiveis.filter((p) => p.trava === 'LISA').map((p) => ROTULO_FABRICANTE[p.fabricante]);
  const tala = possiveis.filter((p) => p.trava === 'TALA').map((p) => ROTULO_FABRICANTE[p.fabricante]);
  const partes = [lisa.length ? `lisa ${listaNo(lisa)}` : '', tala.length ? `tala ${listaNo(tala)}` : ''].filter(Boolean);
  const notas: Partial<Record<Fabricante, string>> = {};
  for (const p of possiveis) {
    const n = notaFabricante(p);
    if (n) notas[p.fabricante] = n;
  }
  return {
    perfil,
    tlsProntos,
    metros,
    toneladas: arred(metros * fatorPerfil(perfil), 1),
    possiveis,
    totalPossiveis: possiveis.reduce((t, p) => t + p.tls, 0),
    trava: partes.length ? partes.join('; ') : null,
    notas,
  };
}

/** Perfis que ganham cartão de solda no resumo: os que têm TLS, lisa ou tala do novo. */
export function perfisDeSolda(saldos: Saldo[]): string[] {
  const com = new Set(
    saldos.filter((s) => s.secao === 'NOVO' && (s.tipo === 'TLS' || s.tipo === 'LISA' || s.tipo === 'TALA') && (s.metros > 0 || (s.unidades ?? 0) > 0)).map((s) => s.perfil),
  );
  // TR68 primeiro (é o que mais se solda), depois a ordem da planilha.
  return ['TR68', ...ORDEM_PERFIS.filter((p) => p !== 'TR68')].filter((p) => com.has(p));
}

export interface ItemOutro {
  rotulo: string;
  metros: number;
}

/** O que está no novo mas não aparece nos cartões de solda: perfis sem cartão, 21 m, torcido, curtas e menores de 12 m. */
export function outrosNovo(saldos: Saldo[], perfisComCartao: string[]): ItemOutro[] {
  const novo = saldos.filter((s) => s.secao === 'NOVO');
  const soma = (f: (s: Saldo) => boolean) => arred(novo.filter(f).reduce((t, s) => t + s.metros, 0));
  const itens: ItemOutro[] = [];
  for (const p of ORDEM_PERFIS) {
    if (perfisComCartao.includes(p)) continue;
    const m = soma((s) => s.perfil === p);
    if (m) itens.push({ rotulo: p, metros: m });
  }
  const dentro = (s: Saldo) => perfisComCartao.includes(s.perfil);
  const extras: [string, (s: Saldo) => boolean][] = [
    ['Barras de 21 m', (s) => dentro(s) && s.classe === '21M'],
    ['Torcido', (s) => dentro(s) && s.classe === 'TORCIDO'],
    ['Curtas 12 m', (s) => dentro(s) && s.tipo === 'CURTA12'],
    ['Menores de 12 m', (s) => dentro(s) && s.tipo === 'MENOR12'],
  ];
  for (const [rotulo, f] of extras) {
    const m = soma(f);
    if (m) itens.push({ rotulo, metros: m });
  }
  return itens;
}

export interface LinhaClasses {
  perfil: string;
  metros: number;
  toneladas: number;
  partes: { classe: string; metros: number }[];
  /** Só no reemprego: TLS de reemprego prontos. */
  tls: number;
}

/** Reemprego (G1, G2, G3) ou sucata (SC1, SC2, SC3) por perfil, do maior para o menor. */
export function barrasPorClasse(saldos: Saldo[], secao: Exclude<Secao, 'NOVO'>): LinhaClasses[] {
  const classes = secao === 'REEMPREGO' ? ['G1', 'G2', 'G3'] : ['SC1', 'SC2', 'SC3'];
  const linhas: LinhaClasses[] = [];
  for (const perfil of ORDEM_PERFIS) {
    const doPerfil = saldos.filter((s) => s.secao === secao && s.perfil === perfil);
    if (!doPerfil.length) continue;
    const partes = classes.map((classe) => ({ classe, metros: arred(doPerfil.filter((s) => s.classe === classe && s.tipo === 'BARRA').reduce((t, s) => t + s.metros, 0)) })).filter((p) => p.metros !== 0);
    const tls = doPerfil.filter((s) => s.tipo === 'TLS').reduce((t, s) => t + (s.unidades ?? 0), 0);
    const metros = arred(partes.reduce((t, p) => t + p.metros, 0));
    if (!partes.length && !tls) continue;
    linhas.push({ perfil, metros, toneladas: arred(toneladas({ secao, perfil }, metros), 3), partes, tls });
  }
  return linhas.sort((a, b) => (secao === 'SUCATA' ? b.toneladas - a.toneladas : b.metros - a.metros));
}

export interface LinhaSap {
  item: ItemSap;
  rotulo: string;
  perfil: string;
  tipo: 'TLS' | 'BARRAS';
  sap: number | null;
  /** TLS: quantidade de TLS; barras: metros. */
  equivalente: number | null;
  sistemaToneladas: number;
  sistemaUnidades: number | null;
  sistemaMetros: number;
  /** Sistema − SAP, em toneladas. */
  diferenca: number | null;
  situacao: 'bate' | 'diferenca' | 'sem-sap';
}

const ITENS: { item: ItemSap; perfil: string; tipo: 'TLS' | 'BARRAS' }[] = [
  { item: 'TLS_TR60', perfil: 'TR60', tipo: 'TLS' },
  { item: 'TLS_TR68', perfil: 'TR68', tipo: 'TLS' },
  { item: 'BARRAS_TR60', perfil: 'TR60', tipo: 'BARRAS' },
  { item: 'BARRAS_TR68', perfil: 'TR68', tipo: 'BARRAS' },
];

/** Como na planilha, as barras do UIC60 entram no total de barras do TR60 (linha "Total TR60"). */
const PERFIS_NAS_BARRAS: Record<string, string[]> = { TR60: ['TR60', 'UIC60'] };

/** Conferência com o SAP, como as linhas 22 a 26 da planilha (total das malhas). */
export function conferenciaSap(saldos: Saldo[], sap: Partial<Record<ItemSap, number>>): LinhaSap[] {
  return ITENS.map(({ item, perfil, tipo }) => {
    const perfis = tipo === 'BARRAS' ? (PERFIS_NAS_BARRAS[perfil] ?? [perfil]) : [perfil];
    const novo = saldos.filter((s) => s.secao === 'NOVO' && perfis.includes(s.perfil) && (tipo === 'TLS' ? s.tipo === 'TLS' : s.tipo !== 'TLS'));
    const metros = arred(novo.reduce((t, s) => t + s.metros, 0));
    const unidades = tipo === 'TLS' ? novo.reduce((t, s) => t + (s.unidades ?? 0), 0) : null;
    const fator = fatorPerfil(perfil);
    const sistemaToneladas = arred(metros * fator, 3);
    const valor = sap[item];
    if (valor == null) {
      return { item, rotulo: `${tipo === 'TLS' ? 'TLS' : 'Barras'} ${perfil}`, perfil, tipo, sap: null, equivalente: null, sistemaToneladas, sistemaUnidades: unidades, sistemaMetros: metros, diferenca: null, situacao: 'sem-sap' as const };
    }
    const equivalente = tipo === 'TLS' ? Math.round(valor / fator / 312) : Math.round(valor / fator);
    const diferenca = arred(sistemaToneladas - valor, 3);
    const bate = tipo === 'TLS' ? Math.abs(valor / fator / 312 - (unidades ?? 0)) < 0.5 : Math.abs(diferenca) < 0.5;
    return { item, rotulo: `${tipo === 'TLS' ? 'TLS' : 'Barras'} ${perfil}`, perfil, tipo, sap: valor, equivalente, sistemaToneladas, sistemaUnidades: unidades, sistemaMetros: metros, diferenca, situacao: bate ? ('bate' as const) : ('diferenca' as const) };
  });
}

export interface ColunasNovo {
  tlsUn: number;
  tlsM: number;
  lisa: number;
  tala: number;
  curta12: number;
  menor12: number;
  /** Lisas + talas + curtas 12 m + menores de 12 m (coluna L da planilha). */
  curtos: number;
  /** TLS em metros + curtos. */
  geral: number;
  toneladas: number;
}

export interface LinhaNovo extends ColunasNovo {
  fabricante: Fabricante | null;
  classe: string;
}

export interface GrupoNovo {
  perfil: string;
  linhas: LinhaNovo[];
  total: ColunasNovo;
}

function colunas(lista: Saldo[], perfil: string): ColunasNovo {
  const m = (tipo: string) => arred(lista.filter((s) => s.tipo === tipo).reduce((t, s) => t + s.metros, 0));
  const tlsUn = lista.filter((s) => s.tipo === 'TLS').reduce((t, s) => t + (s.unidades ?? 0), 0);
  const tlsM = m('TLS');
  const lisa = m('LISA');
  const tala = m('TALA');
  const curta12 = m('CURTA12');
  const menor12 = m('MENOR12');
  const curtos = arred(lisa + tala + curta12 + menor12);
  const geral = arred(tlsM + curtos);
  return { tlsUn, tlsM, lisa, tala, curta12, menor12, curtos, geral, toneladas: arred(geral * fatorPerfil(perfil), 1) };
}

/** Tabela do novo como as linhas 3 a 19 da aba "Estoque Novo e Reemprego": por perfil, uma linha por fabricante e classe. */
export function tabelaNovo(saldos: Saldo[]): GrupoNovo[] {
  const grupos: GrupoNovo[] = [];
  for (const perfil of ORDEM_PERFIS) {
    const doPerfil = saldos.filter((s) => s.secao === 'NOVO' && s.perfil === perfil);
    if (!doPerfil.length) continue;
    const chaves = [...new Set(doPerfil.map((s) => `${s.fabricante ?? ''}|${s.classe}`))];
    const linhas: LinhaNovo[] = chaves.map((k) => {
      const [fab, classe] = k.split('|');
      const lista = doPerfil.filter((s) => (s.fabricante ?? '') === fab && s.classe === classe);
      return { fabricante: (fab || null) as Fabricante | null, classe: classe!, ...colunas(lista, perfil) };
    });
    // Novo normal primeiro (com TLS no topo), depois 21 m, teste e torcido.
    const ordemClasse = ['NORMAL', 'TESTE', '21M', 'TORCIDO'];
    linhas.sort((a, b) => ordemClasse.indexOf(a.classe) - ordemClasse.indexOf(b.classe) || b.geral - a.geral);
    grupos.push({ perfil, linhas, total: colunas(doPerfil, perfil) });
  }
  return grupos;
}

/** Resumo da sucata como na aba "Estoque sucata": longas, curtas e tocos, em metros e toneladas. */
export function resumoSucata(saldos: Saldo[]): { classe: 'SC1' | 'SC2' | 'SC3' | 'TOTAL'; metros: number; toneladas: number }[] {
  const suc = saldos.filter((s) => s.secao === 'SUCATA');
  const por = (f: (s: Saldo) => boolean) => {
    const l = suc.filter(f);
    return { metros: arred(l.reduce((t, s) => t + s.metros, 0)), toneladas: arred(l.reduce((t, s) => t + toneladas(s, s.metros), 0), 3) };
  };
  return [
    { classe: 'SC1', ...por((s) => s.classe === 'SC1') },
    { classe: 'SC2', ...por((s) => s.classe === 'SC2') },
    { classe: 'SC3', ...por((s) => s.classe === 'SC3') },
    { classe: 'TOTAL', ...por(() => true) },
  ];
}

export interface ItemParado {
  fabricante: Fabricante;
  barras: number;
}

/** Lisas e talas que sobram em cada marca depois de formar todos os TLS possíveis (não fecham TLS sozinhas). */
export function materialParado(possiveis: TlsPossiveis[]): { lisas: ItemParado[]; talas: ItemParado[] } {
  const lista = (f: (p: TlsPossiveis) => number) =>
    possiveis
      .map((p) => ({ fabricante: p.fabricante, barras: f(p) }))
      .filter((i) => i.barras > 0)
      .sort((a, b) => b.barras - a.barras);
  return { lisas: lista((p) => p.sobraLisas), talas: lista((p) => p.sobraTalas) };
}

/** O essencial do pátio para o Resumo geral do Estoque: TLS por perfil de solda, reemprego e sucata. */
export function resumoPatio(saldos: Saldo[]): { perfis: { perfil: string; prontos: number; formar: number }[]; reempregoMetros: number; sucataToneladas: number } {
  const perfis = perfisDeSolda(saldos).map((perfil) => {
    const c = cartaoPerfil(saldos, perfil);
    return { perfil, prontos: c.tlsProntos, formar: c.totalPossiveis };
  });
  const reempregoMetros = arred(barrasPorClasse(saldos, 'REEMPREGO').reduce((t, l) => t + l.metros, 0));
  const sucataToneladas = resumoSucata(saldos).find((r) => r.classe === 'TOTAL')?.toneladas ?? 0;
  return { perfis, reempregoMetros, sucataToneladas };
}
