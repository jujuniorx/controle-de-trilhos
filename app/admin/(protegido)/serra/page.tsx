import { resumoSerra } from '@/lib/services/serra';
import { fmtMetros } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Gráfico da serra: o que foi recolhido em Evangelista e Paratinga, o que já chegou à usina e o que falta. */
export default async function SerraPage() {
  const r = await resumoSerra();
  const maximo = Math.max(r.metaM, r.recolhidoM, 1);
  const pct = (v: number) => `${Math.min((v / maximo) * 100, 100).toFixed(2)}%`;
  const progresso = Math.min((r.naUsinaM / r.metaM) * 100, 100);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="page-title">Trilho da serra</h1>
        <p className="text-sm text-ink-muted">Evangelista e Paratinga. Atualiza sozinho conforme os recebimentos são lançados. 1 unidade ≈ 10 m.</p>
      </header>

      <section className="card space-y-4" aria-label="Resumo da serra">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-xs text-ink-muted">Recolhido</p><p className="text-lg font-semibold">{fmtMetros(r.recolhidoM)}</p></div>
          <div><p className="text-xs text-ink-muted">Na usina</p><p className="text-lg font-semibold text-ok">{fmtMetros(r.naUsinaM)}</p></div>
          <div><p className="text-xs text-ink-muted">Ainda não chegou</p><p className="text-lg font-semibold text-warn">{fmtMetros(r.aChegarM)}</p></div>
        </div>

        <div>
          <p className="mb-1 text-sm text-ink-muted">Meta estimada: {fmtMetros(r.metaM)} — já na usina: {progresso.toFixed(1)}%</p>
          <div className="h-4 w-full overflow-hidden rounded bg-surface-2" role="img" aria-label={`${progresso.toFixed(1)}% da meta na usina`}>
            <div className="h-full bg-ok" style={{ width: `${progresso}%` }} />
          </div>
        </div>

        <svg viewBox="0 0 600 40" className="h-auto w-full" role="img" aria-label="Recolhido, na usina e ainda não chegou">
          <rect x="0" y="0" width={`${(r.naUsinaM / maximo) * 600}`} height="40" className="fill-ok" />
          <rect x={`${(r.naUsinaM / maximo) * 600}`} y="0" width={`${(r.aChegarM / maximo) * 600}`} height="40" className="fill-warn" />
          <line x1={`${(r.metaM / maximo) * 600}`} x2={`${(r.metaM / maximo) * 600}`} y1="0" y2="40" stroke="currentColor" strokeDasharray="4 3" />
        </svg>
        <p className="text-xs text-ink-muted">Barra: verde = na usina, laranja = ainda não chegou. Linha tracejada = meta de {fmtMetros(r.metaM)}.</p>
      </section>

      <section className="card space-y-2" aria-label="Por cidade">
        {r.cidades.map((c) => (
          <div key={c.cidade} className="flex items-center justify-between gap-2 border-b border-surface-2 py-2 last:border-0">
            <p className="font-medium">{c.rotulo}</p>
            <p className="text-sm text-ink-muted">
              recolhido {fmtMetros(c.recolhidoM)} · na usina {fmtMetros(c.naUsinaM)} · falta {fmtMetros(c.aChegarM)}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
