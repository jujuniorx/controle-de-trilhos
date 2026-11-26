import Link from 'next/link';
import { type Lancamento } from '@/lib/estoque/trilhos';
import { dataBr, fmt, fmtM } from './formato';

export interface MovimentoAgrupado {
  chave: string;
  origemTipo: Lancamento['origemTipo'];
  origemId: string | null;
  data: string;
  descricao: string;
  partes: string[];
  alerta: string | null;
  sinal: number;
}

const LETRA: Record<Lancamento['origemTipo'], string> = {
  SALDO_INICIAL: 'S',
  AJUSTE: 'A',
  RECEBIMENTO: 'R',
  REMETIDO: 'E',
  PRODUCAO: 'P',
  TRILHEIRO: 'T',
};

const NOME_TIPO: Record<string, string> = { TLS: 'TLS', LISA: 'lisa', TALA: 'tala', CURTA12: 'curta 12 m', MENOR12: 'menor de 12 m', BARRA: '' };

/** Um texto curto de cada lançamento: "+1 TLS TR68", "−264 m lisa TR68", "+312,4 m G2 TR60". */
function parte(l: Lancamento): string {
  const sinal = l.metros < 0 || (l.unidades ?? 0) < 0 ? '−' : '+';
  if (l.tipo === 'TLS') return `${sinal}${fmt(Math.abs(l.unidades ?? 0))} TLS ${l.perfil}`;
  const classe = l.secao === 'NOVO' ? NOME_TIPO[l.tipo] : l.classe.replace('SC', 'SC-');
  return `${sinal}${fmtM(Math.abs(l.metros))} m ${classe} ${l.perfil}`.replace(/\s+/g, ' ');
}

/** Junta os lançamentos do mesmo fato (ex.: um TLS da Produção mexe em TLS, lisa e tala). Mais recentes primeiro. */
export function agruparMovimentos(lancamentos: Lancamento[], de?: string, ate?: string): MovimentoAgrupado[] {
  const grupos = new Map<string, MovimentoAgrupado>();
  for (const l of lancamentos) {
    if (l.origemTipo === 'SALDO_INICIAL') continue;
    if ((de && l.data < de) || (ate && l.data > ate)) continue;
    const chave = `${l.origemTipo}|${l.origemId ?? ''}|${l.data}|${l.origemTipo === 'AJUSTE' ? l.descricao : ''}`;
    const g = grupos.get(chave) ?? { chave, origemTipo: l.origemTipo, origemId: l.origemId, data: l.data, descricao: l.descricao, partes: [], alerta: null, sinal: 0 };
    if (l.metros !== 0 || l.unidades) g.partes.push(parte(l));
    if (l.alerta) g.alerta = l.alerta;
    g.sinal += Math.sign(l.unidades ?? l.metros);
    grupos.set(chave, g);
  }
  return [...grupos.values()].sort((a, b) => b.data.localeCompare(a.data));
}

/** Endereço do fato que mexeu no estoque, para conferir. */
export function linkDaOrigem(m: Pick<MovimentoAgrupado, 'origemTipo' | 'origemId' | 'data'>): string | null {
  if (!m.origemId) return null;
  if (m.origemTipo === 'RECEBIMENTO') return `/admin/recebimentos/${m.origemId}`;
  if (m.origemTipo === 'REMETIDO') return `/admin/remetidos/${m.origemId}`;
  if (m.origemTipo === 'PRODUCAO') return `/admin/producao?data=${m.data}`;
  if (m.origemTipo === 'TRILHEIRO') return `/admin/usina?setor=trilheiros&data=${m.data}`;
  return null;
}

export function UltimasMovimentacoes({ lancamentos, limite, de, ate }: { lancamentos: Lancamento[]; limite?: number; de?: string; ate?: string }) {
  const lista = agruparMovimentos(lancamentos, de, ate).slice(0, limite ?? Infinity);
  if (lista.length === 0) return <p className="text-sm text-ink-muted">Nenhuma movimentação depois do saldo inicial ainda.</p>;
  return (
    <ul className="etr-feed">
      {lista.map((m) => {
        const href = linkDaOrigem(m);
        const titulo = href ? (
          <Link href={href} className="hover:underline">
            {m.descricao}
          </Link>
        ) : (
          m.descricao
        );
        return (
          <li key={m.chave}>
            <span className={`etr-ic etr-ic-${m.origemTipo}`} aria-hidden="true">
              {LETRA[m.origemTipo]}
            </span>
            <div>
              <b>{titulo}</b>
              <span>
                {dataBr(m.data)}
                {m.partes.map((p) => (
                  <span key={p} className={p.startsWith('−') ? 'etr-menos' : 'etr-mais'}>
                    {' · '}
                    {p}
                  </span>
                ))}
                {m.alerta && <span className="etr-alerta"> · {m.alerta}</span>}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
