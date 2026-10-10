import { arredondar3 } from '@/lib/domain/regras';
import { pesoConhecidoDoGrupo, pesoMovimentacao, type MovimentacaoRelatorio } from '@/lib/services/relatorio';

export interface PontoSerie {
  rotulo: string;
  recebido: number;
  enviado: number;
}
export interface ItemRanking {
  rotulo: string;
  valor: number;
}
export interface DadosGraficos {
  serie: PontoSerie[];
  granularidade: 'semana' | 'mes';
  /** Havia mais períodos do que cabem no gráfico (mostramos só os mais recentes). */
  serieTruncada: boolean;
  origens: ItemRanking[];
  destinos: ItemRanking[];
  perfis: ItemRanking[];
}

const MAX_PERIODOS = 12;
const MAX_RANKING = 8;
const DIA = 24 * 60 * 60 * 1000;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function dataDe(mov: MovimentacaoRelatorio): Date {
  return mov.dataMovimentacao ?? mov.createdAt;
}

/** Início (UTC) da semana de segunda-feira que contém `d`. */
function inicioSemana(d: Date): number {
  const dia = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = (new Date(dia).getUTCDay() + 6) % 7; // segunda = 0
  return dia - dow * DIA;
}

function rankear(mapa: Map<string, number>): ItemRanking[] {
  return [...mapa.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor: arredondar3(valor) }))
    .filter((i) => i.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo))
    .slice(0, MAX_RANKING);
}

/**
 * Peso de cada grupo de uma movimentação, com a MESMA regra de pesoMovimentacao:
 * em SUCATA de recebimento o peso real (pesoSucataReal) substitui a estimativa e é repartido
 * entre os grupos de sucata na proporção dos metros. Sobra (sem grupo de sucata) vai em "Outros".
 */
function pesosPorPerfil(mov: MovimentacaoRelatorio): Map<string, number> {
  const out = new Map<string, number>();
  const soma = (k: string, v: number) => out.set(k, (out.get(k) ?? 0) + v);
  const sucataComPesoReal = mov.tipo === 'RECEBIMENTO' && mov.pesoSucataReal != null;
  const gruposSucata = mov.grupos.filter((g) => g.tipoMaterial === 'SUCATA');

  for (const g of mov.grupos) {
    if (mov.tipo === 'RECEBIMENTO' && g.tipoMaterial === 'SUCATA') {
      if (!sucataComPesoReal) soma(g.perfil, pesoConhecidoDoGrupo(g));
      continue;
    }
    soma(g.perfil, pesoConhecidoDoGrupo(g));
  }
  if (sucataComPesoReal) {
    const real = Number(mov.pesoSucataReal);
    if (gruposSucata.length === 0) soma('Outros', real);
    else {
      const totalM = gruposSucata.reduce((s, g) => s + Number(g.metrosTotal), 0);
      for (const g of gruposSucata) {
        const parte = totalM > 0 ? Number(g.metrosTotal) / totalM : 1 / gruposSucata.length;
        soma(g.perfil, real * parte);
      }
    }
  }
  return out;
}

export function montarDadosGraficos(movs: MovimentacaoRelatorio[]): DadosGraficos {
  const origens = new Map<string, number>();
  const destinos = new Map<string, number>();
  const perfis = new Map<string, number>();

  let min = Infinity;
  let max = -Infinity;
  for (const m of movs) {
    const t = dataDe(m).getTime();
    min = Math.min(min, t);
    max = Math.max(max, t);
  }
  const granularidade: 'semana' | 'mes' = movs.length > 0 && (max - min) / DIA <= 60 ? 'semana' : 'mes';

  const buckets = new Map<number, PontoSerie>();
  for (const m of movs) {
    const peso = pesoMovimentacao(m);
    const d = dataDe(m);
    const chave =
      granularidade === 'semana' ? inicioSemana(d) : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const ref = new Date(chave);
    const rotulo =
      granularidade === 'semana'
        ? `${String(ref.getUTCDate()).padStart(2, '0')}/${String(ref.getUTCMonth() + 1).padStart(2, '0')}`
        : `${MESES[ref.getUTCMonth()]}/${String(ref.getUTCFullYear()).slice(2)}`;
    const ponto = buckets.get(chave) ?? { rotulo, recebido: 0, enviado: 0 };
    if (m.tipo === 'RECEBIMENTO') ponto.recebido += peso;
    else ponto.enviado += peso;
    buckets.set(chave, ponto);

    const local = (m.tipo === 'RECEBIMENTO' ? m.origem : m.destino)?.trim();
    const alvo = m.tipo === 'RECEBIMENTO' ? origens : destinos;
    if (local) alvo.set(local, (alvo.get(local) ?? 0) + peso);

    for (const [perfil, v] of pesosPorPerfil(m)) perfis.set(perfil, (perfis.get(perfil) ?? 0) + v);
  }

  const todos = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => ({
    ...p,
    recebido: arredondar3(p.recebido),
    enviado: arredondar3(p.enviado),
  }));
  return {
    serie: todos.slice(-MAX_PERIODOS),
    granularidade,
    serieTruncada: todos.length > MAX_PERIODOS,
    origens: rankear(origens),
    destinos: rankear(destinos),
    perfis: rankear(perfis),
  };
}
