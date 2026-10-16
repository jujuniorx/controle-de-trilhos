import { fmtMetros } from '@/lib/format';

export interface DadosVisaoGeral {
  primeiroNome: string;
  saudacao: string;
  hojeLabel: string;
  metaM: number;
  recolhidoAno: number;
  chegouAno: number;
  w61Ano: number;
  w62Ano: number;
  recolhidoMes: number;
  recolhidoHoje: number;
  chegouHoje: number;
  pendentes: number;
  remetidos: number;
  carretas: number;
  ultimas: { usuario: string; acao: string; descricao: string; quando: string }[];
}

const barras = (m: number) => Math.round(m / 10.5).toLocaleString('pt-BR');

function Tile({ rotulo, valor, unidade, cor }: { rotulo: string; valor: string; unidade: string; cor: string }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${cor}` }}>
      <p className="stat-label">{rotulo}</p>
      <p className="stat-value" style={{ color: cor }}>{valor}</p>
      <p className="stat-unit">{unidade}</p>
    </div>
  );
}

export function VisaoGeralDono(d: DadosVisaoGeral) {
  const pct = Math.min(100, Math.round((d.recolhidoAno / d.metaM) * 100));
  const faltam = Math.max(d.metaM - d.recolhidoAno, 0);
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.22em] text-ink-muted">{d.saudacao}</p>
        <h1 className="page-title mt-1">Visão geral, {d.primeiroNome}</h1>
        <p className="text-sm text-ink-muted">{d.hojeLabel}</p>
      </header>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="stat-label">Meta de recolhimento do ano</p>
            <p className="text-2xl font-bold">{fmtMetros(d.recolhidoAno)} m <span className="text-base font-normal text-ink-muted">de {fmtMetros(d.metaM)} m</span></p>
          </div>
          <p className="text-3xl font-bold text-accent">{pct}%</p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%`, transition: 'width .8s ease' }} />
        </div>
        <p className="text-sm text-ink-muted">Faltam {fmtMetros(faltam)} m para bater a meta.</p>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile rotulo="Recolhido no ano" valor={`${barras(d.recolhidoAno)}`} unidade="barras" cor="#60a5fa" />
        <Tile rotulo="Chegou na usina" valor={`${fmtMetros(d.chegouAno)} m`} unidade="no ano" cor="#4a6cd4" />
        <Tile rotulo="Recolhido no mês" valor={`${fmtMetros(d.recolhidoMes)} m`} unidade="até hoje" cor="#e8a33d" />
        <Tile rotulo="Recolhido hoje" valor={`${fmtMetros(d.recolhidoHoje)} m`} unidade={`chegou ${fmtMetros(d.chegouHoje)} m`} cor="#16a34a" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile rotulo="W61 no ano" valor={barras(d.w61Ano)} unidade="barras" cor="#e8a33d" />
        <Tile rotulo="W62 no ano" valor={barras(d.w62Ano)} unidade="barras" cor="#16a34a" />
        <Tile rotulo="Pendentes de conferência" valor={String(d.pendentes)} unidade="movimentações" cor="#f59e0b" />
        <Tile rotulo="Carretas na portaria" valor={String(d.carretas)} unidade={`${d.remetidos} remetidos aguardando`} cor="#4ade80" />
      </div>

      <section className="card">
        <h2 className="page-title text-base">Últimas ações no sistema</h2>
        {d.ultimas.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Nada registrado ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/10">
            {d.ultimas.map((u, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                <span>
                  <strong>{u.usuario}</strong> <span className="text-ink-muted">· {u.acao}</span>
                  <span className="block text-ink-muted">{u.descricao}</span>
                </span>
                <span className="font-mono text-xs text-ink-muted">{u.quando}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
