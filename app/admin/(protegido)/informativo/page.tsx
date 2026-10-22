import { informativoDoAno } from '@/lib/services/informativo';
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

      <section className="card space-y-2" aria-label="Gráfico mensal">
        <p className="text-sm text-ink-muted">Trilho por mês em {ano}: o que chegou na usina e o que ainda não chegou</p>
        <style>{`
  .inf-barra { transform-box: fill-box; transform-origin: 50% 100%; animation: inf-cresce 0.9s cubic-bezier(.2,.8,.2,1) both; }
  .inf-barra-falta { transform-box: fill-box; transform-origin: 50% 100%; animation: inf-cresce 0.9s cubic-bezier(.2,.8,.2,1) both; }
  .inf-valor { opacity: 0; animation: inf-surge 0.5s ease forwards; }
  .inf-meta { stroke-dasharray: 900; stroke-dashoffset: 900; animation: inf-desenha 1.2s ease 0.9s forwards; }
  .inf-meta-texto { opacity: 0; animation: inf-surge 0.5s ease 1.6s forwards; }
  @keyframes inf-cresce { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  @keyframes inf-surge { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes inf-desenha { to { stroke-dashoffset: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .inf-barra, .inf-barra-falta, .inf-valor, .inf-meta, .inf-meta-texto { animation: none; opacity: 1; transform: none; stroke-dashoffset: 0; }
  }
`}</style>
        <svg viewBox={`0 0 ${W} ${H + 30}`} className="h-auto w-full" role="img" aria-label="Chegou na usina, ainda não chegou e meta por mês">
          {(() => {
            const topo = Math.max(r.metaM, ...r.meses.map((m) => m.recebido + m.naoChegou), 1);
            const y = (v: number) => base - (v / topo) * (H - 30);
            return (
              <>
                <line className="inf-meta" pathLength={900} x1="0" x2={W} y1={y(r.metaM)} y2={y(r.metaM)} stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" strokeOpacity="0.7" />
                <text className="inf-meta-texto" x={W - 4} y={y(r.metaM) - 6} textAnchor="end" fontSize="12" fill="currentColor">Meta {fmtMetros(r.metaM)}</text>
                {r.meses.map((m, i) => {
                  const x = barra(i);
                  const larg = W / 12 - 14;
                  const hChegou = base - y(m.recebido);
                  const alturaFalta = y(m.recebido) - y(m.recebido + m.naoChegou);
                  const total = m.recebido + m.naoChegou;
                  return (
                    <g key={MESES[i]}>
                      <rect className="inf-barra" style={{ animationDelay: `${i * 70}ms` }} x={x} y={y(m.recebido)} width={larg} height={hChegou} rx="3" fill={CORES.recebido} />
                      <rect className="inf-barra-falta" style={{ animationDelay: `${i * 70 + 150}ms` }} x={x} y={y(m.recebido + m.naoChegou)} width={larg} height={alturaFalta} rx="3" fill="#e0a526" />
                      {total > 0 && <text className="inf-valor" style={{ animationDelay: `${i * 70 + 700}ms` }} x={x + larg / 2} y={y(total) - 4} textAnchor="middle" fontSize="11" fill="currentColor">{Math.round(total).toLocaleString('pt-BR')}</text>}
                      <text x={x + larg / 2} y={H + 18} textAnchor="middle" fontSize="11" fill="currentColor">{MESES[i]}</text>
                    </g>
                  );
                })}
              </>
            );
          })()}
        </svg>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: CORES.recebido }} />Chegou na usina</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#e0a526' }} />Ainda não chegou</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0 w-5 border-t-2 border-dashed" />Meta</span>
        </div>
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
