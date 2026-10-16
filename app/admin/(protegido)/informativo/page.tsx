import Link from 'next/link';
import { informativoDoAno, META_RECOLHIMENTO_M, METROS_POR_BARRA } from '@/lib/services/informativo';
import { seriesDoGrafico, niceEixo, ROTULO_SERIE, SERIES, UNIDADES, type Serie, type Unidade } from '@/lib/services/informativoGrafico';
import { fmtMetros } from '@/lib/format';

export const dynamic = 'force-dynamic';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const ANIMACAO = `
  .inf-barra { transform-box: fill-box; transform-origin: 50% 100%; animation: inf-cresce 0.9s cubic-bezier(.2,.8,.2,1) both; }
  .inf-valor { opacity: 0; animation: inf-surge 0.5s ease forwards; }
  .inf-meta { stroke-dasharray: 900; stroke-dashoffset: 900; animation: inf-desenha 1.2s ease 0.9s forwards; }
  @keyframes inf-cresce { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  @keyframes inf-surge { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes inf-desenha { to { stroke-dashoffset: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .inf-barra, .inf-valor, .inf-meta { animation: none; opacity: 1; transform: none; stroke-dashoffset: 0; }
  }
`;

export default async function InformativoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(primeiro(p.dia) ?? '') ? primeiro(p.dia)! : hojeSP();
  const serie: Serie = (SERIES as readonly string[]).includes(primeiro(p.serie) ?? '') ? (primeiro(p.serie) as Serie) : 'tudo';
  const unidade: Unidade = (UNIDADES as readonly string[]).includes(primeiro(p.unidade) ?? '') ? (primeiro(p.unidade) as Unidade) : 'barras';
  const ano = Number(dia.slice(0, 4));
  const r = await informativoDoAno(ano, dia);

  const series = seriesDoGrafico(r.meses, serie, unidade);
  const topo = Math.max(1, ...series.flatMap((s) => s.valores));
  const { max, passo } = niceEixo(topo);
  const W = 720, H = 300, yBase = 270, topoPlot = 30;
  const x0 = 56, plotW = W - x0 - 8;
  const ph = yBase - topoPlot;
  const y = (v: number) => yBase - (v / max) * ph;
  const gw = plotW / 12;
  const n = series.length;
  const bw = Math.min(26, (gw * 0.7) / n);
  const eixoRotulo = unidade === 'barras' ? 'barras' : 'metros';
  const pendente = Math.max(META_RECOLHIMENTO_M - r.acumAno.w61 - r.acumAno.w62, 0);
  const barras = (m: number) => Math.round(m / METROS_POR_BARRA).toLocaleString('pt-BR');

  const link = (novo: Partial<{ serie: Serie; unidade: Unidade }>) => {
    const q = new URLSearchParams({ dia, serie, unidade, ...novo });
    return `/admin/informativo?${q.toString()}`;
  };
  const botao = (ativo: boolean) => `btn btn-sm ${ativo ? 'btn-primary' : 'btn-ghost'}`;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4">
      <style>{ANIMACAO}</style>
      <header className="space-y-3">
        <h1 className="page-title">Informativo do trilho</h1>
        <form className="flex items-end gap-2" method="get">
          <input type="hidden" name="serie" value={serie} />
          <input type="hidden" name="unidade" value={unidade} />
          <div className="field">
            <label htmlFor="dia">Dia</label>
            <input id="dia" name="dia" type="date" defaultValue={dia} className="h-11" />
          </div>
          <button type="submit" className="btn btn-ghost h-11">Ver</button>
        </form>
      </header>

      <section className="card space-y-4" aria-label="Gráfico mensal">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-condensed text-lg font-semibold uppercase tracking-wide">Trilhos {ano}</p>
            <p className="text-sm text-ink-muted">Recolhido por mês, em {eixoRotulo}</p>
          </div>
          <a href={`/api/informativo/pdf?dia=${dia}&serie=${serie}&unidade=${unidade}`} className="btn btn-primary btn-sm">Baixar PDF</a>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Série">
          {SERIES.map((s) => (
            <Link key={s} href={link({ serie: s })} className={botao(serie === s)} aria-current={serie === s ? 'true' : undefined}>
              {ROTULO_SERIE[s]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Unidade">
          {UNIDADES.map((u) => (
            <Link key={u} href={link({ unidade: u })} className={botao(unidade === u)} aria-current={unidade === u ? 'true' : undefined}>
              {u === 'barras' ? 'Em barras' : 'Em metros'}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          {series.map((s) => (
            <span key={s.chave} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.cor }} />
              {s.rotulo}
            </span>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${ROTULO_SERIE[serie]} por mês, em ${eixoRotulo}`}>
          {Array.from({ length: Math.floor(max / passo) + 1 }, (_, k) => k * passo).map((v) => (
            <g key={v}>
              <line x1={x0} x2={W - 8} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={v === 0 ? 0.6 : 0.12} />
              <text x={x0 - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.7">{v.toLocaleString('pt-BR')}</text>
            </g>
          ))}
          <text x={4} y={topoPlot - 10} fontSize="10" fill="currentColor" fillOpacity="0.7">{eixoRotulo}</text>
          {MESES.map((mes, i) => {
            const gx = x0 + i * gw;
            return (
              <g key={mes}>
                {series.map((s, j) => {
                  const v = s.valores[i] ?? 0;
                  if (v <= 0) return null;
                  const bx = gx + (gw - bw * n) / 2 + j * bw;
                  const delay = i * 70 + j * 90;
                  return (
                    <g key={s.chave}>
                      <rect className="inf-barra" style={{ animationDelay: `${delay}ms` }} x={bx} y={y(v)} width={bw - 2} height={yBase - y(v)} rx="2" fill={s.cor} />
                      <text className="inf-valor" style={{ animationDelay: `${delay + 600}ms` }} x={bx + (bw - 2) / 2} y={y(v) - 4} textAnchor="middle" fontSize="10" fill="currentColor">{Math.round(v).toLocaleString('pt-BR')}</text>
                    </g>
                  );
                })}
                <text x={gx + gw / 2} y={yBase + 16} textAnchor="middle" fontSize="11" fill="currentColor">{mes}</text>
              </g>
            );
          })}
        </svg>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div><p className="text-xs uppercase text-ink-muted">Meta de recolhimento</p><p className="text-lg font-semibold">{fmtMetros(META_RECOLHIMENTO_M)} m</p></div>
          <div><p className="text-xs uppercase text-ink-muted">Chegou na usina</p><p className="text-lg font-semibold" style={{ color: '#4a6cd4' }}>{fmtMetros(r.acumAno.recebido)} m</p></div>
          <div><p className="text-xs uppercase text-ink-muted">Pendente (sobra)</p><p className="text-lg font-semibold text-warn">{fmtMetros(pendente)} m</p></div>
          <div><p className="text-xs uppercase text-ink-muted">Recolhido W61</p><p className="text-lg font-semibold" style={{ color: '#e8a33d' }}>{barras(r.acumAno.w61)} barras</p><p className="text-xs text-ink-muted">{fmtMetros(r.acumAno.w61)} m</p></div>
          <div><p className="text-xs uppercase text-ink-muted">Recolhido W62</p><p className="text-lg font-semibold" style={{ color: '#16a34a' }}>{barras(r.acumAno.w62)} barras</p><p className="text-xs text-ink-muted">{fmtMetros(r.acumAno.w62)} m</p></div>
        </div>
        <p className="text-xs text-ink-muted">W61 e W62: barras × {METROS_POR_BARRA.toLocaleString('pt-BR')} m. Chegou na usina: medidas reais, em metros. Pendente = meta - recolhido.</p>
      </section>

      <section className="card space-y-3" aria-label="Quadro do dia">
        <div className="grid grid-cols-2 gap-2">
          <p className="text-sm">Meta recolhimento: <b>{fmtMetros(META_RECOLHIMENTO_M)}</b></p>
          <p className="text-right text-sm">Saldo: <b className="text-warn">{fmtMetros(r.saldoM)}</b></p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-ink-muted"><th className="py-1">Item</th><th className="py-1 text-right">Dia {dia.slice(8)}/{dia.slice(5, 7)}</th><th className="py-1 text-right">Acumulado do mês</th></tr></thead>
            <tbody>
              <tr className="border-t border-surface-2"><td className="py-1">W61</td><td className="text-right">{fmtMetros(r.doDia.w61)}</td><td className="text-right">{fmtMetros(r.acumMes.w61)}</td></tr>
              <tr className="border-t border-surface-2"><td className="py-1">W62</td><td className="text-right">{fmtMetros(r.doDia.w62)}</td><td className="text-right">{fmtMetros(r.acumMes.w62)}</td></tr>
              <tr className="border-t border-surface-2"><td className="py-1">Geração</td><td className="text-right">{fmtMetros(r.doDia.geracao)}</td><td className="text-right">{fmtMetros(r.acumMes.geracao)}</td></tr>
              <tr className="border-t border-surface-2"><td className="py-1">Recebido estaleiro</td><td className="text-right">{fmtMetros(r.doDia.recebido)}</td><td className="text-right">{fmtMetros(r.acumMes.recebido)}</td></tr>
              <tr className="border-t border-surface-2"><td className="py-1">Recolhido</td><td className="text-right">{fmtMetros(r.doDia.recolhido)}</td><td className="text-right">{fmtMetros(r.acumMes.recolhido)}</td></tr>
              <tr className="border-t border-surface-2"><td className="py-1">Ainda não chegou</td><td className="text-right">{fmtMetros(r.doDia.naoChegou)}</td><td className="text-right">{fmtMetros(r.acumMes.naoChegou)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
