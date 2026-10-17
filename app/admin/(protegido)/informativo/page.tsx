import Link from 'next/link';
import { informativoDoAno, META_RECOLHIMENTO_M, METROS_POR_BARRA } from '@/lib/services/informativo';
import { cartoesDoFiltro, montarGrafico, niceEixo, parseSeries, rotuloFiltro, CHAVES_SERIE, ROTULO_CURTO, UNIDADES, type ChaveSerie, type Unidade } from '@/lib/services/informativoGrafico';
import { fmtMetros } from '@/lib/format';
import { RecolhimentoDiaForm } from './RecolhimentoDiaForm';
import { BotaoBaixarPdf } from './BotaoBaixarPdf';

export const dynamic = 'force-dynamic';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const ANIMACAO = `
  .inf-barra { transform-box: fill-box; transform-origin: 50% 100%; animation: inf-cresce 0.9s cubic-bezier(.2,.8,.2,1) both; }
  .inf-valor { opacity: 0; animation: inf-surge 0.5s ease forwards; }
  .inf-grade { transform-box: fill-box; transform-origin: 0% 50%; animation: inf-desliza 0.8s ease both; }
  .inf-eixo { opacity: 0; animation: inf-surge 0.5s ease forwards; }
  .inf-legenda { opacity: 0; animation: inf-sobe 0.5s ease forwards; }
  .inf-cartao { opacity: 0; animation: inf-sobe 0.6s cubic-bezier(.2,.8,.2,1) forwards; }
  .inf-barra:hover { filter: brightness(1.15); }
  @keyframes inf-cresce { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  @keyframes inf-surge { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes inf-sobe { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes inf-desliza { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  /* Impressão pelo navegador sai sempre em tema claro (fundo escuro gasta muita tinta). */
  @media print {
    :root { --bg: #ffffff; --surface: #ffffff; --surface-2: #f1f3f6; --ink: #111827; --ink-muted: #4b5563; color-scheme: light; }
    body { background: #ffffff !important; color: #111827 !important; }
    .card { box-shadow: none !important; border: 1px solid #d1d5db; }
    .inf-barra, .inf-valor, .inf-grade, .inf-eixo, .inf-legenda, .inf-cartao { animation: none !important; opacity: 1 !important; transform: none !important; }
  }
  /* Celular: gráfico com rolagem lateral (texto legível), cartões e entrada animados. PC não muda. */
  @media (max-width: 767px) {
    .inf-entrada { animation: inf-sobe 0.7s cubic-bezier(.2,.8,.2,1) both; }
    .inf-rolagem { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 -4px; padding: 0 4px 6px; scroll-snap-type: x proximity; }
    .inf-rolagem svg { min-width: 640px; display: block; }
    .inf-cartao { animation-duration: 0.7s; }
    .inf-cartao:active, .inf-segmento:active { transform: scale(.97); }
    .inf-segmento { min-height: 44px; display: inline-flex; align-items: center; }
    .inf-pulso { animation: inf-pulso 2.6s ease-in-out 1.2s infinite; }
  }
  @keyframes inf-pulso { 0%, 100% { box-shadow: 0 0 0 0 rgba(96,165,250,0); } 50% { box-shadow: 0 0 0 6px rgba(96,165,250,.18); } }
  @media (prefers-reduced-motion: reduce) {
    .inf-barra, .inf-valor, .inf-grade, .inf-eixo, .inf-legenda, .inf-cartao { animation: none; opacity: 1; transform: none; }
  }
`;

export default async function InformativoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(primeiro(p.dia) ?? '') ? primeiro(p.dia)! : hojeSP();
  const chaves = parseSeries(primeiro(p.s));
  const unidade: Unidade = (UNIDADES as readonly string[]).includes(primeiro(p.unidade) ?? '') ? (primeiro(p.unidade) as Unidade) : 'barras';
  const ano = Number(dia.slice(0, 4));
  const r = await informativoDoAno(ano, dia);

  const { indices, series } = montarGrafico(r.meses, chaves, unidade);
  const topo = Math.max(1, ...series.flatMap((s) => s.valores));
  const { max, passo } = niceEixo(topo);
  const W = 720, H = 300, yBase = 270, topoPlot = 30;
  const x0 = 56, plotW = W - x0 - 8;
  const ph = yBase - topoPlot;
  const y = (v: number) => yBase - (v / max) * ph;
  const gw = plotW / Math.max(indices.length, 1);
  const n = series.length;
  const bw = Math.min(26, (gw * 0.7) / n);
  const eixoRotulo = unidade === 'barras' ? 'barras' : 'metros';
  const pendente = Math.max(META_RECOLHIMENTO_M - r.acumAno.w61 - r.acumAno.w62, 0);
  const visiveis = cartoesDoFiltro(chaves);
  const barras = (m: number) => Math.round(m / METROS_POR_BARRA).toLocaleString('pt-BR');

  const saldoMeta = Math.max(META_RECOLHIMENTO_M - r.acumAno.recolhido, 0);
  const pctMeta = Math.min(100, (r.acumAno.recolhido / META_RECOLHIMENTO_M) * 100);
  const m = (v: number) => ({ principal: `${fmtMetros(v)} m`, secundario: null as string | null });
  const linhasQuadro = [
    { rotulo: 'W61', cor: '#e8a33d', destaque: false, dia: { principal: `${barras(r.doDia.w61)} barras`, secundario: `${fmtMetros(r.doDia.w61)} m` }, mes: { principal: `${barras(r.acumMes.w61)} barras`, secundario: `${fmtMetros(r.acumMes.w61)} m` } },
    { rotulo: 'W62', cor: '#16a34a', destaque: false, dia: { principal: `${barras(r.doDia.w62)} barras`, secundario: `${fmtMetros(r.doDia.w62)} m` }, mes: { principal: `${barras(r.acumMes.w62)} barras`, secundario: `${fmtMetros(r.acumMes.w62)} m` } },
    { rotulo: 'Geração', cor: '#8b93a7', destaque: false, dia: m(r.doDia.geracao), mes: m(r.acumMes.geracao) },
    { rotulo: 'Recebido estaleiro', cor: '#4a6cd4', destaque: false, dia: m(r.doDia.recebido), mes: m(r.acumMes.recebido) },
    { rotulo: 'Recolhido (W61 + W62)', cor: '#16a34a', destaque: true, dia: m(r.doDia.recolhido), mes: m(r.acumMes.recolhido) },
    { rotulo: 'Ainda não chegou', cor: '#e5484d', destaque: true, dia: m(r.doDia.naoChegou), mes: m(r.acumMes.naoChegou) },
  ];

  const link = (novo: Partial<{ chaves: ChaveSerie[]; unidade: Unidade }>) => {
    const q = new URLSearchParams({ dia, s: (novo.chaves ?? chaves).join(','), unidade: novo.unidade ?? unidade });
    return `/admin/informativo?${q.toString()}`;
  };
  const segmento = (ativo: boolean) =>
    `inf-segmento rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${ativo ? 'bg-primary text-on-primary shadow-sm' : 'text-ink-muted hover:text-ink'}`;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4">
      <style>{ANIMACAO}</style>
      <header className="space-y-3">
        <h1 className="page-title">Informativo de trilhos</h1>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <input type="hidden" name="s" value={chaves.join(',')} />
          <input type="hidden" name="unidade" value={unidade} />
          <div className="flex flex-col gap-1">
            <label htmlFor="dia" className="text-xs font-medium uppercase tracking-wide text-ink-muted">Data do informativo</label>
            <input id="dia" name="dia" type="date" defaultValue={dia} className="h-11 min-w-[11rem] rounded-lg px-3" />
          </div>
          <button type="submit" className="btn btn-primary h-11 px-5">Ver informativo</button>
        </form>
      </header>

      <section className="card space-y-4 inf-entrada" aria-label="Gráfico mensal">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-condensed text-lg font-semibold uppercase tracking-wide">Trilhos {ano}</p>
            <p className="text-sm text-ink-muted">Recolhido por mês, em {eixoRotulo}</p>
          </div>
          <BotaoBaixarPdf href={`/api/informativo/pdf?dia=${dia}&s=${chaves.join(',')}&unidade=${unidade}`} nomeArquivo={`trilhos-${ano}-${chaves.join('-')}-${unidade}.pdf`} />
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">Indicador</span>
            <div className="inline-flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1" role="group" aria-label="Indicadores">
              {CHAVES_SERIE.map((c) => {
                const marcada = chaves.includes(c);
                // Desmarcar a última série não esvazia o gráfico: mantém as demais.
                const proximas = marcada ? chaves.filter((x) => x !== c) : [...chaves, c];
                return (
                  <Link key={c} href={link({ chaves: proximas.length ? proximas : chaves })} className={segmento(marcada)} aria-pressed={marcada}>
                    {ROTULO_CURTO[c]}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">Medida</span>
            <div className="inline-flex gap-1 rounded-lg bg-surface-2 p-1" role="group" aria-label="Unidade">
              {UNIDADES.map((u) => (
                <Link key={u} href={link({ unidade: u })} className={segmento(unidade === u)} aria-current={unidade === u ? 'true' : undefined}>
                  {u === 'barras' ? 'Barras' : 'Metros'}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          {series.map((s, k) => (
            <span key={s.chave} className="inf-legenda flex items-center gap-1" style={{ animationDelay: `${k * 120}ms` }}>
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.cor }} />
              {s.rotulo}
            </span>
          ))}
        </div>

        <div className="inf-rolagem">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${rotuloFiltro(chaves)} por mês, em ${eixoRotulo}`}>
          {Array.from({ length: Math.floor(max / passo) + 1 }, (_, k) => k * passo).map((v, k) => (
            <g key={v}>
              <line className="inf-grade" style={{ animationDelay: `${k * 90}ms` }} x1={x0} x2={W - 8} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={v === 0 ? 0.6 : 0.12} />
              <text className="inf-eixo" style={{ animationDelay: `${k * 90 + 300}ms` }} x={x0 - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.7">{v.toLocaleString('pt-BR')}</text>
            </g>
          ))}
          <text x={4} y={topoPlot - 10} fontSize="10" fill="currentColor" fillOpacity="0.7">{eixoRotulo}</text>
          {indices.map((mi, k) => {
            const mes = MESES[mi];
            const gx = x0 + k * gw;
            return (
              <g key={mes}>
                {series.map((s, j) => {
                  const v = s.valores[k] ?? 0;
                  if (v <= 0) return null;
                  const bx = gx + (gw - bw * n) / 2 + j * bw;
                  const delay = k * 70 + j * 90;
                  return (
                    <g key={s.chave}>
                      <rect className="inf-barra" style={{ animationDelay: `${delay}ms` }} x={bx} y={y(v)} width={bw - 2} height={yBase - y(v)} rx="2" fill={s.cor}>
                        <title>{`${s.rotulo} · ${mes}: ${Math.round(v).toLocaleString('pt-BR')} ${eixoRotulo}`}</title>
                      </rect>
                      <text className="inf-valor" style={{ animationDelay: `${delay + 600}ms` }} x={bx + (bw - 2) / 2} y={y(v) - 4} textAnchor="middle" fontSize="10" fill="currentColor">{Math.round(v).toLocaleString('pt-BR')}</text>
                    </g>
                  );
                })}
                <text className="inf-eixo" style={{ animationDelay: `${k * 60 + 500}ms` }} x={gx + gw / 2} y={yBase + 16} textAnchor="middle" fontSize="11" fill="currentColor">{mes}</text>
              </g>
            );
          })}
        </svg>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {visiveis.meta && (<div className="inf-cartao" style={{ animationDelay: '0ms' }}><p className="text-xs uppercase text-ink-muted">Meta de recolhimento</p><p className="text-lg font-semibold">{fmtMetros(META_RECOLHIMENTO_M)} m</p></div>)}
          {visiveis.usina && (<div className="inf-cartao" style={{ animationDelay: '120ms' }}><p className="text-xs uppercase text-ink-muted">Chegou na usina</p><p className="text-lg font-semibold" style={{ color: '#4a6cd4' }}>{fmtMetros(r.acumAno.recebido)} m</p></div>)}
          {visiveis.pendente && (<div className="inf-cartao" style={{ animationDelay: '240ms' }}><p className="text-xs uppercase text-ink-muted">Pendente (sobra)</p><p className="text-lg font-semibold text-warn">{fmtMetros(pendente)} m</p></div>)}
          {visiveis.w61 && (<div className="inf-cartao" style={{ animationDelay: '360ms' }}><p className="text-xs uppercase text-ink-muted">Recolhido W61</p><p className="text-lg font-semibold" style={{ color: '#e8a33d' }}>{barras(r.acumAno.w61)} barras</p><p className="text-xs text-ink-muted">{fmtMetros(r.acumAno.w61)} m</p></div>)}
          {visiveis.w62 && (<div className="inf-cartao" style={{ animationDelay: '480ms' }}><p className="text-xs uppercase text-ink-muted">Recolhido W62</p><p className="text-lg font-semibold" style={{ color: '#16a34a' }}>{barras(r.acumAno.w62)} barras</p><p className="text-xs text-ink-muted">{fmtMetros(r.acumAno.w62)} m</p></div>)}
        </div>
        <p className="text-xs text-ink-muted">W61 e W62: barras × {METROS_POR_BARRA.toLocaleString('pt-BR')} m. Chegou na usina: medidas reais, em metros. Pendente = meta - recolhido.</p>
      </section>

      <section className="card" aria-label="Quadro do dia">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-xs uppercase text-ink-muted">Meta de recolhimento</p>
            <p className="text-lg font-semibold">{fmtMetros(META_RECOLHIMENTO_M)} m</p>
          </div>
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-xs uppercase text-ink-muted">Recolhido no ano</p>
            <p className="text-lg font-semibold" style={{ color: '#16a34a' }}>{fmtMetros(r.acumAno.recolhido)} m</p>
          </div>
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-xs uppercase text-ink-muted">Saldo para a meta</p>
            <p className="text-lg font-semibold text-warn">{fmtMetros(saldoMeta)} m</p>
          </div>
        </div>

        <div className="mb-5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pctMeta)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full" style={{ width: `${pctMeta}%`, background: 'linear-gradient(90deg,#16a34a,#4ade80)' }} />
          </div>
          <p className="mt-1 text-right text-xs text-ink-muted">{pctMeta.toFixed(1).replace('.', ',')}% da meta</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-2 text-left text-xs uppercase text-ink-muted">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 text-right font-medium">Dia {dia.slice(8)}/{dia.slice(5, 7)}</th>
                <th className="py-2 text-right font-medium">Acumulado do mês</th>
              </tr>
            </thead>
            <tbody>
              {linhasQuadro.map((l) => (
                <tr key={l.rotulo} className="border-b border-surface-2/60 last:border-0">
                  <td className="py-2.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: l.cor }} aria-hidden="true" />{' '}
                    <span className="align-middle">{l.rotulo}</span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    <span className={l.destaque ? 'font-semibold' : ''}>{l.dia.principal}</span>
                    {l.dia.secundario && <span className="block text-xs text-ink-muted">{l.dia.secundario}</span>}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    <span className={l.destaque ? 'font-semibold' : ''}>{l.mes.principal}</span>
                    {l.mes.secundario && <span className="block text-xs text-ink-muted">{l.mes.secundario}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-muted">Saldo para a meta usa o recolhido do ano (W61 + W62). W61 e W62 em barras; demais valores em metros.</p>
      </section>
      <section className="card space-y-3" aria-label="Lançar recolhido do dia">
        <div>
          <h2 className="font-condensed text-lg font-semibold uppercase tracking-wide">Recolhido do dia {dia.slice(8)}/{dia.slice(5, 7)}</h2>
          <p className="text-sm text-ink-muted">Quanto foi recolhido de W61 e W62 neste dia, em barras.</p>
        </div>
        <RecolhimentoDiaForm data={dia} w61={Math.round(r.doDia.w61 / METROS_POR_BARRA)} w62={Math.round(r.doDia.w62 / METROS_POR_BARRA)} />
      </section>
    </main>
  );
}
