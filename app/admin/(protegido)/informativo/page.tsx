import { informativoDoAno, METROS_POR_BARRA } from '@/lib/services/informativo';
import { fmtMetros } from '@/lib/format';

export const dynamic = 'force-dynamic';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CORES = { recebido: '#4a6cd4' } as const;

function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export default async function InformativoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const dia = typeof p.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.dia) ? p.dia : hojeSP();
  const ano = Number(dia.slice(0, 4));
  const r = await informativoDoAno(ano, dia);
  const W = 640, H = 240, base = 200;
  const barra = (i: number) => (W / 12) * i + 10;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <header>
        <h1 className="page-title">Informativo do trilho</h1>
        <form className="flex items-end gap-2" method="get">
          <div className="field">
            <label htmlFor="dia">Dia</label>
            <input id="dia" name="dia" type="date" defaultValue={dia} className="h-11" />
          </div>
          <button type="submit" className="btn btn-ghost h-11">Ver</button>
        </form>
      </header>

      <section className="card space-y-4" aria-label="Gráfico mensal">
        <p className="text-sm text-ink-muted">Trilhos por mês em {ano}: chegou na usina e recolhido</p>
        <svg viewBox={`0 0 ${W} ${H + 30}`} className="h-auto w-full" role="img" aria-label="Chegou na usina e recolhido por mês">
          {(() => {
            const topo = Math.max(1, ...r.meses.map((m) => Math.max(m.recebido, m.w61, m.w62)));
            const y = (v: number) => base - (v / topo) * (H - 30);
            const cores = { chegou: CORES.recebido, w61: '#e8a33d', w62: '#16a34a' };
            return r.meses.map((m, i) => {
              const x0 = barra(i);
              const larg = (W / 12 - 14) / 3;
              const barras = [
                { v: m.recebido, cor: cores.chegou, dx: 0 },
                { v: m.w61, cor: cores.w61, dx: larg },
                { v: m.w62, cor: cores.w62, dx: larg * 2 },
              ];
              return (
                <g key={MESES[i]}>
                  {barras.map((b, k) => b.v > 0 && (
                    <g key={k}>
                      <rect x={x0 + b.dx} y={y(b.v)} width={larg - 2} height={base - y(b.v)} rx="2" fill={b.cor} />
                      <text x={x0 + b.dx + (larg - 2) / 2} y={y(b.v) - 4} textAnchor="middle" fontSize="9" fill="currentColor">{Math.round(b.v).toLocaleString('pt-BR')}</text>
                    </g>
                  ))}
                  <text x={x0 + (W / 12 - 14) / 2} y={H + 18} textAnchor="middle" fontSize="11" fill="currentColor">{MESES[i]}</text>
                </g>
              );
            });
          })()}
        </svg>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: CORES.recebido }} />Recebido (estaleiro de solda)</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#e8a33d' }} />Recolhido W61</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#16a34a' }} />Recolhido W62</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div><p className="text-xs uppercase text-ink-muted">Meta de recolhimento</p><p className="text-lg font-semibold">{fmtMetros(r.metaM)}</p></div>
          <div><p className="text-xs uppercase text-ink-muted">Pendente</p><p className="text-lg font-semibold text-warn">{fmtMetros(Math.max(r.metaM - r.acumAno.recebido, 0))}</p></div>
          <div><p className="text-xs uppercase text-ink-muted">Recebido (estaleiro de solda)</p><p className="text-lg font-semibold" style={{ color: CORES.recebido }}>{fmtMetros(r.acumAno.recebido)}</p></div>
          <div><p className="text-xs uppercase text-ink-muted">Recolhido W61</p><p className="text-lg font-semibold">{Math.round(r.acumAno.w61 / METROS_POR_BARRA).toLocaleString('pt-BR')} barras · {fmtMetros(r.acumAno.w61)}</p></div>
          <div><p className="text-xs uppercase text-ink-muted">Recolhido W62</p><p className="text-lg font-semibold">{Math.round(r.acumAno.w62 / METROS_POR_BARRA).toLocaleString('pt-BR')} barras · {fmtMetros(r.acumAno.w62)}</p></div>
        </div>
        <p className="text-xs text-ink-muted">Barras convertidas a {METROS_POR_BARRA.toLocaleString('pt-BR')} m por barra.</p>
      </section>

      <section className="card space-y-3" aria-label="Quadro do dia">
        <div className="grid grid-cols-2 gap-2">
          <p className="text-sm">Meta recolhimento: <b>{fmtMetros(r.metaM)}</b></p>
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
