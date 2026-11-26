import { PaginaPdf, A4_PAISAGEM, montarPdfVarias } from '@/lib/pdf/simples';
import { ROTULO_CLASSE_NOVO, ROTULO_FABRICANTE, type ClasseNovo, type Saldo } from '@/lib/estoque/trilhos';
import { barrasPorClasse, conferenciaSap, resumoSucata, tabelaNovo, type ColunasNovo } from '@/lib/estoque/visao';
import type { ItemSap } from '@/lib/services/estoqueTrilhos';

type Cor = [number, number, number];
const TINTA: Cor = [0.07, 0.09, 0.13];
const CINZA: Cor = [0.42, 0.46, 0.52];
const FAIXA: Cor = [0.93, 0.94, 0.96];
const MARGEM = 32;
const LARG = A4_PAISAGEM.largura - MARGEM * 2;

const n = (v: number, casas = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const m = (v: number) => (Math.abs(v - Math.round(v)) < 0.005 ? n(v) : n(v, 2));
const z = (v: number, f: (x: number) => string = m) => (v === 0 ? '0' : f(v));

function dataHora(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}, ${d.slice(11, 16)}`;
}

/** Cursor de escrita que abre página nova quando acaba o espaço. */
class Folhas {
  paginas: PaginaPdf[] = [];
  p!: PaginaPdf;
  y = 0;
  constructor(private cabecalho: string) {
    this.nova();
  }
  nova() {
    this.p = new PaginaPdf();
    this.paginas.push(this.p);
    this.p.texto('Estoque de trilhos', MARGEM, A4_PAISAGEM.altura - 40, 16, 'negrito', TINTA);
    this.p.texto(this.cabecalho, A4_PAISAGEM.largura - MARGEM, A4_PAISAGEM.altura - 40, 9, 'normal', CINZA, 'fim');
    this.p.linha(MARGEM, A4_PAISAGEM.altura - 50, A4_PAISAGEM.largura - MARGEM, A4_PAISAGEM.altura - 50, [0.8, 0.82, 0.85], 0.8);
    this.y = A4_PAISAGEM.altura - 72;
  }
  garantir(altura: number) {
    if (this.y - altura < 36) this.nova();
  }
}

interface Coluna {
  titulo: string;
  largura: number;
  direita?: boolean;
}

function tabela(f: Folhas, titulo: string, nota: string, cols: Coluna[], linhas: { celulas: string[]; destaque?: boolean }[]) {
  const ALT = 15;
  f.garantir(40 + ALT * 2);
  f.p.texto(titulo, MARGEM, f.y, 11.5, 'negrito', TINTA);
  if (nota) f.p.texto(nota, A4_PAISAGEM.largura - MARGEM, f.y, 8, 'normal', CINZA, 'fim');
  f.y -= 16;
  const escala = LARG / cols.reduce((t, c) => t + c.largura, 0);
  const cab = () => {
    let x = MARGEM;
    for (const c of cols) {
      const w = c.largura * escala;
      f.p.texto(c.titulo.toUpperCase(), c.direita ? x + w - 4 : x + 4, f.y, 7, 'negrito', CINZA, c.direita ? 'fim' : 'inicio');
      x += w;
    }
    f.p.linha(MARGEM, f.y - 5, MARGEM + LARG, f.y - 5, [0.75, 0.77, 0.8], 0.6);
    f.y -= ALT;
  };
  cab();
  for (const l of linhas) {
    if (f.y - ALT < 36) {
      f.nova();
      cab();
    }
    if (l.destaque) f.p.retangulo(MARGEM, f.y - 4.5, LARG, ALT, FAIXA);
    let x = MARGEM;
    l.celulas.forEach((t, i) => {
      const c = cols[i]!;
      const w = c.largura * escala;
      f.p.texto(t, c.direita ? x + w - 4 : x + 4, f.y, 8.5, l.destaque ? 'negrito' : 'normal', TINTA, c.direita ? 'fim' : 'inicio');
      x += w;
    });
    f.y -= ALT;
  }
  f.y -= 14;
}

function celulasNovo(c: ColunasNovo): string[] {
  return [z(c.tlsUn, (v) => n(v)), z(c.tlsM), z(c.lisa), z(c.tala), z(c.curta12), z(c.menor12), z(c.curtos), z(c.geral), n(c.toneladas, 1)];
}

export interface DadosPdfEstoqueTrilhos {
  saldos: Saldo[];
  sap: Partial<Record<ItemSap, number>>;
  atualizadoEm: string | null;
  /** yyyy-mm-dd quando o PDF é do estoque num dia passado. */
  ate?: string | null;
}

/** PDF do detalhado (A4 paisagem): novo, reemprego, sucata e conferência com o SAP, como a planilha. */
export function gerarEstoqueTrilhosPdf({ saldos, sap, atualizadoEm, ate }: DadosPdfEstoqueTrilhos): Buffer {
  const f = new Folhas(ate ? `Estoque no fim de ${ate.split('-').reverse().join('/')}` : atualizadoEm ? `Atualizado em ${dataHora(atualizadoEm)}` : '');

  tabela(
    f,
    'Trilhos longos soldados (TLS) e barras curtas · novo',
    'Metros. 1 TLS = 312 m.',
    [
      { titulo: 'Perfil / fabricante', largura: 110 },
      { titulo: 'Classificação', largura: 90 },
      { titulo: 'Qtd. TLS', largura: 52, direita: true },
      { titulo: 'TLS (m)', largura: 66, direita: true },
      { titulo: 'Barras lisas', largura: 72, direita: true },
      { titulo: 'Com furos', largura: 66, direita: true },
      { titulo: 'Curtas 12 m', largura: 62, direita: true },
      { titulo: 'Menores 12 m', largura: 66, direita: true },
      { titulo: 'Total curtos', largura: 76, direita: true },
      { titulo: 'Total geral', largura: 76, direita: true },
      { titulo: 'Toneladas', largura: 62, direita: true },
    ],
    tabelaNovo(saldos).flatMap((g) => [
      { celulas: [g.perfil, 'Total', ...celulasNovo(g.total)], destaque: true },
      ...g.linhas.map((l) => ({
        celulas: [l.fabricante ? ROTULO_FABRICANTE[l.fabricante] : 'Diversos', ROTULO_CLASSE_NOVO[l.classe as ClasseNovo] ?? l.classe, ...celulasNovo(l)],
      })),
    ]),
  );

  const reemprego = barrasPorClasse(saldos, 'REEMPREGO');
  const parte = (l: { partes: { classe: string; metros: number }[] }, c: string) => z(l.partes.find((p) => p.classe === c)?.metros ?? 0);
  tabela(
    f,
    'Reemprego',
    'Metros. O TLS de reemprego usa 312 m do G1.',
    [
      { titulo: 'Perfil', largura: 90 },
      { titulo: 'G1', largura: 90, direita: true },
      { titulo: 'G2', largura: 90, direita: true },
      { titulo: 'G3', largura: 90, direita: true },
      { titulo: 'Total', largura: 100, direita: true },
      { titulo: 'TLS de reemprego', largura: 90, direita: true },
      { titulo: 'Toneladas', largura: 80, direita: true },
    ],
    reemprego.map((l) => ({ celulas: [l.perfil, parte(l, 'G1'), parte(l, 'G2'), parte(l, 'G3'), m(l.metros), z(l.tls, (v) => n(v)), n(l.toneladas, 1)] })),
  );

  const resumo = resumoSucata(saldos);
  const total = resumo.find((r) => r.classe === 'TOTAL')!;
  tabela(
    f,
    'Sucata',
    `Total ${m(total.metros)} m · ${n(total.toneladas, 1)} t (já com 5% de desgaste)`,
    [
      { titulo: 'Perfil', largura: 90 },
      { titulo: 'SC-1 longas', largura: 100, direita: true },
      { titulo: 'SC-2 curtas', largura: 100, direita: true },
      { titulo: 'SC-3 tocos', largura: 100, direita: true },
      { titulo: 'Total', largura: 100, direita: true },
      { titulo: 'Toneladas', largura: 90, direita: true },
    ],
    [
      ...barrasPorClasse(saldos, 'SUCATA').map((l) => ({ celulas: [l.perfil, parte(l, 'SC1'), parte(l, 'SC2'), parte(l, 'SC3'), m(l.metros), n(l.toneladas, 1)] })),
      { celulas: ['Total', ...(['SC1', 'SC2', 'SC3'] as const).map((c) => m(resumo.find((r) => r.classe === c)!.metros)), m(total.metros), n(total.toneladas, 1)], destaque: true },
    ],
  );

  tabela(
    f,
    'Conferir com o SAP',
    'Toneladas (MP + MN + FIPS).',
    [
      { titulo: 'Item', largura: 120 },
      { titulo: 'SAP (t)', largura: 90, direita: true },
      { titulo: 'Equivale a', largura: 100, direita: true },
      { titulo: 'Sistema', largura: 140, direita: true },
      { titulo: 'Diferença (t)', largura: 100, direita: true },
    ],
    conferenciaSap(saldos, sap).map((l) => ({
      celulas: [
        l.rotulo,
        l.sap == null ? '—' : n(l.sap, 3),
        l.equivalente == null ? '—' : l.tipo === 'TLS' ? `${n(l.equivalente)} TLS` : `${m(l.equivalente)} m`,
        l.tipo === 'TLS' ? `${n(l.sistemaUnidades ?? 0)} TLS · ${n(l.sistemaToneladas, 1)} t` : `${n(l.sistemaToneladas, 1)} t · ${m(l.sistemaMetros)} m`,
        l.situacao === 'sem-sap' ? 'sem SAP' : l.situacao === 'bate' ? 'bate' : `${(l.diferenca ?? 0) > 0 ? '+' : '-'}${n(Math.abs(l.diferenca ?? 0), 1)}`,
      ],
    })),
  );

  f.paginas.forEach((p, i) => p.texto(`Página ${i + 1} de ${f.paginas.length}`, A4_PAISAGEM.largura - MARGEM, 20, 7.5, 'normal', CINZA, 'fim'));
  return montarPdfVarias(f.paginas, 'Estoque de trilhos', A4_PAISAGEM);
}
