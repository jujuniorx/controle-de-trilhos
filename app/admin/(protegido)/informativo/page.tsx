import { informativoDoAno } from '@/lib/services/informativo';
import { fmtMetros } from '@/lib/format';

export const dynamic = 'force-dynamic';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CORES = { geracao: '#2b2b2b', w61: '#2e8b57', w62: '#c2578f', recebido: '#4a6cd4' } as const;

function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export default async function InformativoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const dia = typeof p.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.dia) ? p.dia : hojeSP();
  const ano = Number(dia.slice(0, 4));
  const r = await informativoDoAno(ano, dia);
  const maximo = Math.max(...r.meses.map((m) => m.geracao + m.w61 + m.w62 + m.recebido), 1);
  const W = 640, H = 240, base = 200;
  const barra = (i: number) => (W / 12) * i + 10;
  const linhas: Array<{ chave: keyof typeof CORES; rotulo: string; campo: 'geracao' | 'w61' | 'w62' | 'recebido' }> = [
    { chave: 'geracao', rotulo: 'Geração', campo: 'geracao' },
    { chave: 'w61', rotulo: 'W61', campo: 'w61' },
    { chave: 'w62', rotulo: 'W62', campo: 'w62' },
    { chave: 'recebido', rotulo: 'Recebido estaleiro', campo: 'recebido' },
  ];

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
        <p className="text-sm text-ink-muted">Metros por mês em {ano}</p>
        <svg viewBox={`0 0 ${W} ${H + 30}`} className="h-auto w-full" role="img" aria-label="Gráfico mensal de geração, W61, W62 e recebido estaleiro">
          {r.meses.map((m, i) => {
            let y = base;
            return (
              <g key={MESES[i]}>
                {linhas.map((l) => {
                  const h = (m[l.campo] / maximo) * (H - 20);
                  y -= h;
                  return <rect key={l.chave} x={barra(i)} y={y} width={W / 12 - 14} height={h} fill={CORES[l.chave]} />;
                })}
                <text x={barra(i) + (W / 12 - 14) / 2} y={H + 18} textAnchor="middle" fontSize="11" fill="currentColor">{MESES[i]}</text>
              </g>
            );
          })}
        </svg>
        <div className="flex flex-wrap gap-3 text-sm">
          {linhas.map((l) => (
            <span key={l.chave} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: CORES[l.chave] }} />{l.rotulo}</span>
          ))}
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
