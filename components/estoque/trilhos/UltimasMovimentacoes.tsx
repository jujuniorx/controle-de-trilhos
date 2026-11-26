import Link from 'next/link';
import { ROTULO_FABRICANTE, type Lancamento } from '@/lib/estoque/trilhos';
import { dataBr, fmt, fmtM } from './formato';

export interface Quantidade {
  texto: string;
  sinal: number;
}

export interface MovimentoLinha {
  chave: string;
  origemTipo: Lancamento['origemTipo'];
  titulo: string;
  /** O que entrou ou saiu (TLS da Produção, material do envio, do recebimento…). */
  principal: Quantidade[];
  /** Só na Produção: lisas e talas consumidas. */
  consumo: Quantidade[];
  nota: string | null;
  alerta: string | null;
  href: string | null;
}

export interface DiaMovimentos {
  data: string;
  itens: MovimentoLinha[];
}

const ROTULO_ORIGEM: Record<Lancamento['origemTipo'], string> = {
  SALDO_INICIAL: 'Saldo inicial',
  AJUSTE: 'Ajuste',
  RECEBIMENTO: 'Recebimento',
  REMETIDO: 'Envio',
  PRODUCAO: 'Produção',
  TRILHEIRO: 'Trilheiro',
};

const NOME_TIPO: Record<string, string> = { LISA: 'lisa', TALA: 'tala', CURTA12: 'curta 12 m', MENOR12: 'menor de 12 m' };
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function diaSemana(iso: string): string {
  return DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()]!;
}

/** Endereço do fato que mexeu no estoque, para conferir. */
export function linkDaOrigem(m: { origemTipo: Lancamento['origemTipo']; origemId: string | null; data: string }): string | null {
  if (m.origemTipo === 'PRODUCAO') return `/admin/producao?data=${m.data}`;
  if (!m.origemId) return null;
  if (m.origemTipo === 'RECEBIMENTO') return `/admin/recebimentos/${m.origemId}`;
  if (m.origemTipo === 'REMETIDO') return `/admin/remetidos/${m.origemId}`;
  if (m.origemTipo === 'TRILHEIRO') return `/admin/usina?setor=trilheiros&data=${m.data}`;
  return null;
}

/** Soma por linha do estoque e escreve "+4 TLS TR68 Pangang", "−121,10 m TR60 G2", "−1.056 m lisa". */
function somar(lista: Lancamento[], curto: boolean): Quantidade[] {
  const porChave = new Map<string, { l: Lancamento; metros: number; unidades: number }>();
  for (const l of lista) {
    const k = `${l.secao}|${l.perfil}|${l.tipo}|${l.fabricante ?? ''}|${l.classe}`;
    const s = porChave.get(k) ?? { l, metros: 0, unidades: 0 };
    s.metros += l.metros;
    s.unidades += l.unidades ?? 0;
    porChave.set(k, s);
  }
  const saida: Quantidade[] = [];
  for (const { l, metros, unidades } of porChave.values()) {
    const valor = l.tipo === 'TLS' ? unidades : metros;
    if (Math.abs(valor) < 0.005) continue;
    const s = valor < 0 ? '−' : '+';
    const marca = l.fabricante ? ` ${ROTULO_FABRICANTE[l.fabricante]}` : '';
    let texto: string;
    if (l.tipo === 'TLS') texto = `${s}${fmt(Math.abs(unidades))} TLS ${l.perfil}${l.secao === 'REEMPREGO' ? ' reemprego' : marca}`;
    else if (curto) texto = `${s}${fmtM(Math.abs(metros))} m ${l.secao === 'REEMPREGO' ? `${l.classe} ${l.perfil}` : NOME_TIPO[l.tipo] ?? l.tipo}`;
    else if (l.secao === 'NOVO') texto = `${s}${fmtM(Math.abs(metros))} m ${NOME_TIPO[l.tipo] ?? l.tipo} ${l.perfil}${marca}`;
    else texto = `${s}${fmtM(Math.abs(metros))} m ${l.perfil} ${l.classe.replace('SC', 'SC-')}`;
    saida.push({ texto, sinal: Math.sign(valor) });
  }
  return saida;
}

/**
 * Movimentos por dia, do mais novo para o mais antigo. Cada fato é uma linha: a Produção do dia vira
 * uma linha só (TLS formados e o consumo de lisa e tala somados). `limite` conta linhas.
 */
export function agruparMovimentos(lancamentos: Lancamento[], de?: string, ate?: string, limite?: number): DiaMovimentos[] {
  const fatos = new Map<string, { data: string; origemTipo: Lancamento['origemTipo']; lista: Lancamento[] }>();
  for (const l of lancamentos) {
    if (l.origemTipo === 'SALDO_INICIAL') continue;
    if ((de && l.data < de) || (ate && l.data > ate)) continue;
    const id = l.origemTipo === 'PRODUCAO' ? '' : l.origemTipo === 'AJUSTE' ? `${l.origemId}` : (l.origemId ?? '');
    const chave = `${l.data}|${l.origemTipo}|${id}`;
    const f = fatos.get(chave) ?? { data: l.data, origemTipo: l.origemTipo, lista: [] };
    f.lista.push(l);
    fatos.set(chave, f);
  }

  const ordem: Lancamento['origemTipo'][] = ['PRODUCAO', 'RECEBIMENTO', 'REMETIDO', 'TRILHEIRO', 'AJUSTE'];
  const linhas = [...fatos.entries()]
    .map(([chave, f]): MovimentoLinha & { data: string } => {
      const primeiro = f.lista[0]!;
      const alerta = f.lista.find((l) => l.alerta)?.alerta ?? null;
      if (f.origemTipo === 'PRODUCAO') {
        const formados = f.lista.filter((l) => l.tipo === 'TLS');
        const deOutroDia = new Map<string, number>();
        for (const l of formados) if (l.origemId && l.origemId !== f.data) deOutroDia.set(l.origemId, (deOutroDia.get(l.origemId) ?? 0) + (l.unidades ?? 0));
        const nota = [...deOutroDia.entries()].map(([dia, n]) => `${fmt(n)} ${n === 1 ? 'deles fechou' : 'deles fecharam'} em ${dataBr(dia).slice(0, 5)}`).join(' · ') || null;
        return {
          chave,
          data: f.data,
          origemTipo: 'PRODUCAO',
          titulo: 'Produção',
          principal: somar(formados, false),
          consumo: somar(f.lista.filter((l) => l.tipo !== 'TLS' && !(l.secao === 'REEMPREGO' && l.classe === 'TLS')), true),
          nota,
          alerta,
          href: linkDaOrigem({ origemTipo: 'PRODUCAO', origemId: null, data: f.data }),
        };
      }
      return {
        chave,
        data: f.data,
        origemTipo: f.origemTipo,
        titulo: primeiro.descricao || ROTULO_ORIGEM[f.origemTipo],
        principal: somar(f.lista, false),
        consumo: [],
        nota: null,
        alerta,
        href: linkDaOrigem({ origemTipo: f.origemTipo, origemId: primeiro.origemId, data: f.data }),
      };
    })
    .sort((a, b) => b.data.localeCompare(a.data) || ordem.indexOf(a.origemTipo) - ordem.indexOf(b.origemTipo))
    .slice(0, limite ?? Infinity);

  const dias: DiaMovimentos[] = [];
  for (const { data, ...item } of linhas) {
    const ultimo = dias[dias.length - 1];
    if (ultimo?.data === data) ultimo.itens.push(item);
    else dias.push({ data, itens: [item] });
  }
  return dias;
}

function Valores({ lista, discreto }: { lista: Quantidade[]; discreto?: boolean }) {
  return (
    <>
      {lista.map((q, i) => (
        <span key={q.texto} className={`${q.sinal < 0 ? 'etr-menos' : 'etr-mais'} ${discreto ? 'etr-mv-discreto' : ''}`}>
          {i > 0 ? ' · ' : ''}
          {q.texto}
        </span>
      ))}
    </>
  );
}

export function UltimasMovimentacoes({ lancamentos, limite, de, ate }: { lancamentos: Lancamento[]; limite?: number; de?: string; ate?: string }) {
  const dias = agruparMovimentos(lancamentos, de, ate, limite);
  if (dias.length === 0) return <p className="text-sm text-ink-muted">Nenhuma movimentação depois do saldo inicial ainda.</p>;
  return (
    <div className="etr-mv">
      {dias.map((d) => (
        <section key={d.data} className="etr-mv-dia" aria-label={`${diaSemana(d.data)}, ${dataBr(d.data)}`}>
          <h3>
            {diaSemana(d.data)}, {dataBr(d.data).slice(0, 5)}
          </h3>
          <ul>
            {d.itens.map((m) => {
              const corpo = (
                <>
                  <span className={`etr-mv-tipo etr-ic-${m.origemTipo}`}>{m.titulo}</span>
                  <span className="etr-mv-principal">
                    <Valores lista={m.principal} />
                    {m.nota && <small>{m.nota}</small>}
                    {m.alerta && <small className="etr-alerta">{m.alerta}</small>}
                  </span>
                  <span className="etr-mv-consumo">
                    <Valores lista={m.consumo} discreto />
                  </span>
                  <span className="etr-mv-seta" aria-hidden="true">
                    {m.href ? '›' : ''}
                  </span>
                </>
              );
              return <li key={m.chave}>{m.href ? <Link href={m.href}>{corpo}</Link> : <div>{corpo}</div>}</li>;
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
