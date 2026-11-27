/**
 * Como cada fato do sistema mexe no estoque de trilhos. Funções puras: o serviço busca os dados
 * e chama estas funções na hora de mostrar o estoque. Assim, corrigir, converter, excluir ou
 * restaurar uma movimentação muda o saldo sozinho, sem nada gravado à parte.
 */
import { descontarBarras, tlsFechadosPorHora, type HoraTls } from '@/lib/producaoTls';
import { CORTE_SALDO_INICIAL, LISAS_POR_TLS, METROS_BARRA, METROS_TLS, TALAS_POR_TLS, normalizarFabricante, type Lancamento, type Posicao } from '@/lib/estoque/trilhos';

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
  /** Remetido de vagão: quantos TLS (312 m) o grupo leva. Ausente ou null: grupo de barras comum. */
  tls?: number | null;
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
  /** false: remetido registrado só para controle (já estava na planilha); não mexe no estoque. */
  movimentaEstoque?: boolean;
}

const arred = (n: number) => Math.round(n * 1000) / 1000;

function lancamento(p: Posicao, base: { data: string; origemTipo: Lancamento['origemTipo']; origemId: string | null; descricao: string }, metros: number, unidades: number | null = null, alerta?: string): Lancamento {
  return { ...p, ...base, metros: arred(metros), unidades, ...(alerta ? { alerta } : {}) };
}

/** Recebimento conferido soma; remetido conferido subtrai. Não conferido não conta. */
export function lancamentosDeMovimentacao(m: MovFonte): Lancamento[] {
  if (m.status !== 'CONFERIDO' || m.movimentaEstoque === false) return [];
  const sinal = m.tipo === 'RECEBIMENTO' ? 1 : -1;
  const base = { data: m.data, origemTipo: m.tipo, origemId: m.id, descricao: m.rotulo } as const;
  const lista: Lancamento[] = [];
  for (const g of m.grupos) {
    if (g.tls != null && g.tls > 0) {
      // TLS (remetido de vagão): sai do TLS do perfil — o novo pela marca, o reemprego sem marca.
      const p: Posicao =
        g.tipoMaterial === 'NOVO'
          ? { secao: 'NOVO', perfil: g.perfil, tipo: 'TLS', fabricante: normalizarFabricante(g.fabricante) ?? 'DIVERSOS', classe: 'NORMAL' }
          : { secao: 'REEMPREGO', perfil: g.perfil, tipo: 'TLS', fabricante: null, classe: 'TLS' };
      lista.push(lancamento(p, base, sinal * g.tls * METROS_TLS, sinal * g.tls));
      continue;
    }
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
  /**
   * Dia em que começou o TLS que já vinha aberto (inicioSobra do dia de produção anterior).
   * O primeiro TLS fechado no dia conta nesse dia, como no relatório da Produção.
   */
  inicioTlsAberto?: string | null;
}

/**
 * TLS fechados no dia: o TLS novo entra no estoque e consome 11 lisas e 2 talas do perfil e da marca
 * escolhida pelo soldador; o TLS de reemprego entra e consome 312 m do G1 do perfil.
 */
export function lancamentosDeProducao(d: DiaProducaoFonte): Lancamento[] {
  const horas = descontarBarras(d.horas, d.ajusteTls) as (HoraTls & { hora: string })[];
  const lista: Lancamento[] = [];
  // O primeiro TLS fechado hoje, se já vinha aberto de antes, é do dia em que começou.
  const partes: (ReturnType<typeof tlsFechadosPorHora>[number] & { data: string })[] = [];
  let deAntes = d.sobraEntrada > 0 && !!d.inicioTlsAberto;
  for (const f of tlsFechadosPorHora(d.sobraEntrada, horas)) {
    if (deAntes && f.quantidade > 0) {
      partes.push({ ...f, quantidade: 1, data: d.inicioTlsAberto! });
      if (f.quantidade > 1) partes.push({ ...f, quantidade: f.quantidade - 1, data: d.data });
      deAntes = false;
    } else partes.push({ ...f, data: d.data });
  }
  for (const f of partes) {
    // Até o dia do saldo inicial, o TLS já está na planilha.
    if (f.data <= CORTE_SALDO_INICIAL) continue;
    const base = { data: f.data, origemTipo: 'PRODUCAO' as const, origemId: d.data, descricao: `Produção ${f.hora}${f.data !== d.data ? ` de ${d.data.split('-').reverse().join('/')}` : ''} · ${f.quantidade} TLS ${f.perfil}` };
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
