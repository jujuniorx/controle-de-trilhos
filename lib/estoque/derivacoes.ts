/**
 * Como cada fato do sistema mexe no estoque de trilhos. Funções puras: o serviço busca os dados
 * e chama estas funções na hora de mostrar o estoque. Assim, corrigir, converter, excluir ou
 * restaurar uma movimentação muda o saldo sozinho, sem nada gravado à parte.
 */
import { descontarBarras, tlsFechadosPorHora, type HoraTls } from '@/lib/producaoTls';
import { LISAS_POR_TLS, METROS_BARRA, METROS_TLS, TALAS_POR_TLS, normalizarFabricante, type Lancamento, type Posicao } from '@/lib/estoque/trilhos';

export interface MedicaoFonte {
  metros: number;
  classificacaoSC: 'SC1' | 'SC2' | 'SC3' | 'DIVERSOS' | 'JACARE' | null;
}

export interface GrupoFonte {
  tipoMaterial: 'NOVO' | 'REEMPREGO' | 'SUCATA';
  perfil: string;
  classificacao: 'G1' | 'G2' | 'G3' | null;
  fabricante: string | null;
  formaNovo: 'LISA' | 'TALA' | null;
  metrosTotal: number;
  medicoes: MedicaoFonte[];
}

export interface MovFonte {
  id: string;
  tipo: 'RECEBIMENTO' | 'REMETIDO';
  status: string;
  /** yyyy-mm-dd: data da movimentação (chegada ou saída). */
  data: string;
  /** Texto curto para o histórico ("Vagão 123", "Recebimento NF 456"). */
  rotulo: string;
  grupos: GrupoFonte[];
}

const arred = (n: number) => Math.round(n * 1000) / 1000;

function lancamento(p: Posicao, base: { data: string; origemTipo: Lancamento['origemTipo']; origemId: string | null; descricao: string }, metros: number, unidades: number | null = null, alerta?: string): Lancamento {
  return { ...p, ...base, metros: arred(metros), unidades, ...(alerta ? { alerta } : {}) };
}

/** Recebimento conferido soma; remetido conferido subtrai. Não conferido não conta. */
export function lancamentosDeMovimentacao(m: MovFonte): Lancamento[] {
  if (m.status !== 'CONFERIDO') return [];
  const sinal = m.tipo === 'RECEBIMENTO' ? 1 : -1;
  const base = { data: m.data, origemTipo: m.tipo, origemId: m.id, descricao: m.rotulo } as const;
  const lista: Lancamento[] = [];
  for (const g of m.grupos) {
    if (g.tipoMaterial === 'NOVO') {
      const fabricante = normalizarFabricante(g.fabricante) ?? 'DIVERSOS';
      if (!g.formaNovo) {
        lista.push(lancamento({ secao: 'NOVO', perfil: g.perfil, tipo: 'LISA', fabricante, classe: 'NORMAL' }, base, 0, null, 'Novo sem Lisa/Tala'));
        continue;
      }
      lista.push(lancamento({ secao: 'NOVO', perfil: g.perfil, tipo: g.formaNovo, fabricante, classe: 'NORMAL' }, base, sinal * g.metrosTotal));
    } else if (g.tipoMaterial === 'REEMPREGO') {
      lista.push(lancamento({ secao: 'REEMPREGO', perfil: g.perfil, tipo: 'BARRA', fabricante: null, classe: g.classificacao ?? 'G1' }, base, sinal * g.metrosTotal));
    } else {
      // Sucata: cada medição na sua classe. Jacaré conta como tocos (SC3). Diversos não tem metros.
      const porClasse = new Map<string, number>();
      let temDiversos = false;
      for (const med of g.medicoes) {
        if (med.classificacaoSC === 'DIVERSOS') {
          temDiversos = true;
          continue;
        }
        const classe = med.classificacaoSC === 'JACARE' ? 'SC3' : med.classificacaoSC ?? 'SC1';
        porClasse.set(classe, (porClasse.get(classe) ?? 0) + med.metros);
      }
      for (const classe of ['SC1', 'SC2', 'SC3']) {
        const metros = porClasse.get(classe);
        if (metros) lista.push(lancamento({ secao: 'SUCATA', perfil: g.perfil, tipo: 'BARRA', fabricante: null, classe }, base, sinal * metros));
      }
      if (temDiversos) {
        lista.push(lancamento({ secao: 'SUCATA', perfil: g.perfil, tipo: 'BARRA', fabricante: null, classe: 'SC3' }, base, 0, null, 'Diversos sem metros'));
      }
    }
  }
  return lista;
}

export interface DiaProducaoFonte {
  /** yyyy-mm-dd */
  data: string;
  sobraEntrada: number;
  ajusteTls: number;
  horas: (HoraTls & { hora: string })[];
}

/**
 * TLS fechados no dia: o TLS novo entra no estoque e consome 11 lisas e 2 talas do perfil e da marca
 * escolhida pelo soldador; o TLS de reemprego entra e consome 312 m do G1 do perfil.
 */
export function lancamentosDeProducao(d: DiaProducaoFonte): Lancamento[] {
  const horas = descontarBarras(d.horas, d.ajusteTls) as (HoraTls & { hora: string })[];
  const lista: Lancamento[] = [];
  for (const f of tlsFechadosPorHora(d.sobraEntrada, horas)) {
    const base = { data: d.data, origemTipo: 'PRODUCAO' as const, origemId: d.data, descricao: `Produção ${f.hora} · ${f.quantidade} TLS ${f.perfil}` };
    const q = f.quantidade;
    if (f.reemprego) {
      lista.push(lancamento({ secao: 'REEMPREGO', perfil: f.perfil, tipo: 'TLS', fabricante: null, classe: 'TLS' }, base, q * METROS_TLS, q));
      lista.push(lancamento({ secao: 'REEMPREGO', perfil: f.perfil, tipo: 'BARRA', fabricante: null, classe: 'G1' }, base, -q * METROS_TLS));
      continue;
    }
    const fabricante = normalizarFabricante(f.fabricante) ?? 'DIVERSOS';
    const p = { secao: 'NOVO' as const, perfil: f.perfil, fabricante, classe: 'NORMAL' };
    lista.push(lancamento({ ...p, tipo: 'TLS' }, base, q * METROS_TLS, q));
    lista.push(lancamento({ ...p, tipo: 'LISA' }, base, -q * LISAS_POR_TLS * METROS_BARRA));
    lista.push(lancamento({ ...p, tipo: 'TALA' }, base, -q * TALAS_POR_TLS * METROS_BARRA));
  }
  return lista;
}

export interface CargaFonte {
  id: string;
  trilheiro: string;
  /** yyyy-mm-dd: data do B.O. */
  boEm: string;
  perfil: string;
  reemprego: boolean;
  fabricante: string | null;
  quantidade: number;
}

/** O trilheiro leva TLS: sai do estoque de TLS do perfil (e da marca, no novo). */
export function lancamentosDeCarga(c: CargaFonte): Lancamento[] {
  const base = { data: c.boEm, origemTipo: 'TRILHEIRO' as const, origemId: c.id, descricao: `Trilheiro ${c.trilheiro} · B.O. ${c.boEm.split('-').reverse().join('/')}` };
  const p: Posicao = c.reemprego
    ? { secao: 'REEMPREGO', perfil: c.perfil, tipo: 'TLS', fabricante: null, classe: 'TLS' }
    : { secao: 'NOVO', perfil: c.perfil, tipo: 'TLS', fabricante: normalizarFabricante(c.fabricante) ?? 'DIVERSOS', classe: 'NORMAL' };
  return [lancamento(p, base, -c.quantidade * METROS_TLS, -c.quantidade)];
}
