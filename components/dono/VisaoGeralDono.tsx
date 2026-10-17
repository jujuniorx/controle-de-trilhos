import type { ReactNode } from 'react';
import { fmtMetros } from '@/lib/format';
import { ContadorAnimado } from '@/components/ui/ContadorAnimado';
import { ValorAnimado } from '@/components/ui/ValorAnimado';

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

const barras = (m: number) => Math.round(m / 10.5);

const CSS = `
.vg { display: grid; gap: 20px; animation: vg-abre .4s ease-out backwards; }
.vg-saud { font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: var(--ink-muted, #7d8899); margin: 0; }
.vg-letras span { display: inline-block; opacity: 0; transform: translateY(8px); animation: vg-letra .5s cubic-bezier(.2,.7,.2,1) forwards; }
.vg-meta .vg-barra { position: relative; height: 12px; border-radius: 999px; overflow: hidden; background: rgba(125,136,153,.18); }
.vg-meta .vg-barra-fill { position: absolute; inset: 0 auto 0 0; width: var(--pct); border-radius: 999px;
  background: linear-gradient(90deg, #e8a33d, #f5c15c); box-shadow: 0 0 16px rgba(232,163,61,.45);
  transform-origin: left; animation: vg-enche 1.1s cubic-bezier(.2,.7,.2,1) .25s backwards; overflow: hidden; }
.vg-meta .vg-barra-fill::after { content: ''; position: absolute; top: 0; bottom: 0; width: 40%; left: -40%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); animation: vg-brilho 1.6s ease-in-out 1.4s 1 forwards; }
.vg-tile { border-top-width: 3px; border-top-style: solid; border-top-color: var(--cor);
  transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
  animation: vg-cascata .55s cubic-bezier(.2,.7,.2,1) backwards; }
.vg-tile:nth-child(1) { animation-delay: .05s } .vg-tile:nth-child(2) { animation-delay: .12s }
.vg-tile:nth-child(3) { animation-delay: .19s } .vg-tile:nth-child(4) { animation-delay: .26s }
.vg-tile { padding: 20px 20px 18px; position: relative; overflow: hidden; }
.vg-tile .stat-value { font-size: clamp(26px, 5.2vw, 34px); line-height: 1.05; margin-top: 8px; font-weight: 700; }
.vg-tile::after { content: ''; position: absolute; right: -30px; top: -30px; width: 90px; height: 90px; border-radius: 50%; background: var(--cor); opacity: .07; pointer-events: none; }
.vg-zero { opacity: .7; }
.vg-tile:hover { transform: translateY(-4px); box-shadow: 0 12px 26px -14px var(--cor); border-color: var(--cor); }
.vg-alerta { animation: vg-cascata .55s cubic-bezier(.2,.7,.2,1) .19s backwards, vg-pulso 2.4s ease-in-out 1s infinite; }
.vg-feed li { animation: vg-letra .45s ease-out backwards; }
.vg-feed li:nth-child(1){animation-delay:.1s} .vg-feed li:nth-child(2){animation-delay:.16s} .vg-feed li:nth-child(3){animation-delay:.22s}
.vg-feed li:nth-child(4){animation-delay:.28s} .vg-feed li:nth-child(5){animation-delay:.34s} .vg-feed li:nth-child(6){animation-delay:.4s}
.vg-feed li:nth-child(7){animation-delay:.46s} .vg-feed li:nth-child(8){animation-delay:.52s}
@keyframes vg-abre { from { opacity: 0 } to { opacity: 1 } }
@keyframes vg-letra { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
@keyframes vg-enche { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes vg-brilho { from { left: -40% } to { left: 120% } }
@keyframes vg-cascata { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes vg-pulso { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0) } 50% { box-shadow: 0 0 0 6px rgba(245,158,11,.18) } }
@media (prefers-reduced-motion: reduce) {
  .vg, .vg *, .vg *::after { animation: none !important; transition: none !important; }
  .vg-letras span { opacity: 1; transform: none; }
}
`;

function Saudacao({ texto }: { texto: string }) {
  return (
    <span className="vg-letras" aria-label={texto}>
      {Array.from(texto).map((c, i) => (
        <span key={i} aria-hidden="true" style={{ animationDelay: `${0.05 + i * 0.035}s` }}>
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </span>
  );
}

function Tile({ rotulo, cor, children, alerta = false, unidade, vazio = false }: { rotulo: string; cor: string; children: ReactNode; alerta?: boolean; unidade: string; vazio?: boolean }) {
  return (
    <div className={`card vg-tile ${alerta ? 'vg-alerta' : ''} ${vazio ? 'vg-zero' : ''}`} style={{ ['--cor' as string]: cor }}>
      <p className="stat-label">{rotulo}</p>
      <p className="stat-value" style={{ color: cor }}>{children}</p>
      <p className="stat-unit">{unidade}</p>
    </div>
  );
}

export function VisaoGeralDono(d: DadosVisaoGeral) {
  const pct = Math.min(100, Math.max(0, (d.recolhidoAno / d.metaM) * 100));
  const pctTexto = Math.round(pct);
  const faltam = Math.max(d.metaM - d.recolhidoAno, 0);
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <style>{CSS}</style>
      <div className="vg">
        <header>
          <p className="vg-saud">
            <Saudacao texto={d.saudacao} />
          </p>
          <h1 className="page-title mt-2">Visão geral, {d.primeiroNome}</h1>
          <p className="text-sm text-ink-muted">{d.hojeLabel}</p>
        </header>

        <section className="card vg-meta space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="stat-label">Meta de recolhimento do ano</p>
              <p className="text-2xl font-bold">
                {fmtMetros(d.recolhidoAno)} m <span className="text-base font-normal text-ink-muted">de {fmtMetros(d.metaM)} m</span>
              </p>
            </div>
            <p className="text-3xl font-bold" style={{ color: '#e8a33d' }}>
              <ContadorAnimado valor={pctTexto} />%
            </p>
          </div>
          <div className="vg-barra">
            <div className="vg-barra-fill" style={{ ['--pct' as string]: `${pct}%` }} />
          </div>
          <p className="text-sm text-ink-muted">Faltam {fmtMetros(faltam)} m para bater a meta.</p>
        </section>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile rotulo="Recolhido no ano" cor="#60a5fa" unidade="barras"><ContadorAnimado valor={barras(d.recolhidoAno)} /></Tile>
          <Tile rotulo="Chegou na usina" cor="#4a6cd4" unidade="no ano"><ValorAnimado valor={d.chegouAno} casas={2} sufixo=" m" /></Tile>
          <Tile rotulo="Recolhido no mês" cor="#e8a33d" unidade="até hoje"><ValorAnimado valor={d.recolhidoMes} casas={2} sufixo=" m" /></Tile>
          <Tile rotulo="Recolhido hoje" cor="#16a34a" unidade={d.recolhidoHoje > 0 ? `chegou ${fmtMetros(d.chegouHoje)} m` : 'nada recolhido ainda hoje'} vazio={d.recolhidoHoje <= 0}><ValorAnimado valor={d.recolhidoHoje} casas={2} sufixo=" m" /></Tile>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile rotulo="W61 no ano" cor="#e8a33d" unidade="barras"><ContadorAnimado valor={barras(d.w61Ano)} /></Tile>
          <Tile rotulo="W62 no ano" cor="#16a34a" unidade="barras"><ContadorAnimado valor={barras(d.w62Ano)} /></Tile>
          <Tile rotulo="Pendentes de conferência" cor="#f59e0b" unidade="movimentações" alerta={d.pendentes > 0}>
            <ContadorAnimado valor={d.pendentes} />
          </Tile>
          <Tile rotulo="Carretas na portaria" cor="#4ade80" unidade={`${d.remetidos} remetidos aguardando`}>
            <ContadorAnimado valor={d.carretas} />
          </Tile>
        </div>

        <section className="card">
          <h2 className="page-title text-base">Últimas ações no sistema</h2>
          {d.ultimas.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Nada registrado ainda.</p>
          ) : (
            <ul className="vg-feed mt-3 divide-y divide-black/10">
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
      </div>
    </main>
  );
}
