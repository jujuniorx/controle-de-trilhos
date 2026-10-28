import type { ReactNode } from 'react';
import { fmtMetros } from '@/lib/format';
import { ContadorAnimado } from '@/components/ui/ContadorAnimado';
import { ValorAnimado } from '@/components/ui/ValorAnimado';
import { FundoTrilhos } from '@/components/ui/FundoTrilhos';

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

/** Cor e nome curto de cada tipo de ação, para o registro ficar fácil de ler de relance. */
function tomDaAcao(acao: string): { cor: string; rotulo: string } {
  if (/exclus/i.test(acao)) return { cor: '#f87171', rotulo: 'Exclusão' };
  if (/restaur/i.test(acao)) return { cor: '#4ade80', rotulo: 'Restauração' };
  if (/cri|conta/i.test(acao)) return { cor: '#60a5fa', rotulo: 'Cadastro' };
  if (/edi|alter|atualiz/i.test(acao)) return { cor: '#e8a33d', rotulo: 'Alteração' };
  return { cor: '#8ea3c7', rotulo: 'Registro' };
}

const CSS = `
.vg { display: grid; gap: 20px; animation: vg-abre .4s ease-out backwards; }
.vg-saud { font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: #8ea3c7; margin: 0 0 8px; font-weight: 600; }
.vg .saudacao-hero { padding: 30px 26px; }
.vg .saudacao-hero-saudacao { font-size: clamp(30px, 6vw, 44px); letter-spacing: .005em; text-shadow: 0 2px 18px rgba(96,165,250,.35); }
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
.vg-tile .stat-value { font-size: clamp(20px, 3.9vw, 30px); line-height: 1.05; margin-top: 8px; font-weight: 700; white-space: nowrap; max-width: 100%; }
.vg-tile::after { content: ''; position: absolute; right: -30px; top: -30px; width: 90px; height: 90px; border-radius: 50%; background: var(--cor); opacity: .07; pointer-events: none; }
.vg-zero { opacity: .7; }
.vg-tile:hover { transform: translateY(-4px); box-shadow: 0 12px 26px -14px var(--cor); border-color: var(--cor); }
.vg-alerta { animation: vg-cascata .55s cubic-bezier(.2,.7,.2,1) .19s backwards, vg-pulso 2.4s ease-in-out 1s infinite; }
.vg-acoes-cab { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 16px; }
.vg-acoes-sub { font-size: 12px; color: var(--ink-muted, #7d8899); }
.vg-linha { position: relative; list-style: none; margin: 18px 0 0; padding: 0 0 0 28px; }
.vg-linha::before { content: ''; position: absolute; left: 11px; top: 8px; bottom: 8px; width: 2px; border-radius: 2px;
  background: linear-gradient(180deg, rgba(125,136,153,.45), rgba(125,136,153,.08)); }
.vg-item { position: relative; padding: 0 0 18px; animation: vg-cascata .5s cubic-bezier(.2,.7,.2,1) backwards; }
.vg-item:last-child { padding-bottom: 0; }
.vg-ponto { position: absolute; left: -22px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--tom);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--tom) 22%, transparent); }
.vg-topo { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 10px; }
.vg-tag { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--tom);
  background: color-mix(in srgb, var(--tom) 14%, transparent); padding: 3px 9px; border-radius: 999px; }
.vg-hora { font-family: ui-monospace, monospace; font-size: 12px; color: var(--ink-muted, #7d8899); font-variant-numeric: tabular-nums; }
.vg-desc { margin: 8px 0 0; font-size: 15px; font-weight: 600; line-height: 1.35; }
.vg-quem { margin: 3px 0 0; font-size: 13px; color: var(--ink-muted, #7d8899); }
.vg-acao { color: var(--ink, inherit); opacity: .8; }
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
    <main className="mx-auto w-full max-w-7xl space-y-6">
      <style>{CSS}</style>
      <div className="vg">
        <section className="saudacao-hero">
          <FundoTrilhos />
          <div className="saudacao-hero-texto">
            <p className="vg-saud">Visão geral · {d.hojeLabel}</p>
            <h1 className="saudacao-hero-saudacao">
              <Saudacao texto={`${d.saudacao}, ${d.primeiroNome}`} />
            </h1>
            <p className="saudacao-hero-sub">
              {d.pendentes === 0 ? 'Nada pendente de conferência.' : `${d.pendentes} ${d.pendentes === 1 ? 'movimentação' : 'movimentações'} para conferir`}
              {d.carretas > 0 ? ` · ${d.carretas} ${d.carretas === 1 ? 'carreta' : 'carretas'} na portaria` : ''}.
            </p>
          </div>
        </section>

        <section className="card vg-meta space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="stat-label">Meta de recolhimento na serra (ano)</p>
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
          <p className="text-xs text-ink-dim">
            Recolhido = barras W61 e W62 tiradas da serra (10,5 m cada). Chegou na usina = o que já entrou nos recebimentos. Os dois números andam perto, mas não são a mesma conta.
          </p>
        </section>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile rotulo="Recolhido na serra no ano" cor="#60a5fa" unidade="barras"><ContadorAnimado valor={barras(d.recolhidoAno)} /></Tile>
          <Tile rotulo="Chegou na usina" cor="#4a6cd4" unidade="no ano, pelos recebimentos"><ValorAnimado valor={d.chegouAno} casas={2} sufixo=" m" /></Tile>
          <Tile rotulo="Recolhido na serra no mês" cor="#e8a33d" unidade="até hoje"><ValorAnimado valor={d.recolhidoMes} casas={2} sufixo=" m" /></Tile>
          <Tile rotulo="Recolhido na serra hoje" cor="#16a34a" unidade={d.recolhidoHoje > 0 ? `chegou ${fmtMetros(d.chegouHoje)} m` : 'nada recolhido ainda hoje'} vazio={d.recolhidoHoje <= 0}><ValorAnimado valor={d.recolhidoHoje} casas={2} sufixo=" m" /></Tile>
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

        <section className="card vg-acoes">
          <div className="vg-acoes-cab">
            <h2 className="page-title text-base">Últimas ações</h2>
            <span className="vg-acoes-sub">os {d.ultimas.length} registros mais recentes</span>
          </div>
          {d.ultimas.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Nada registrado ainda.</p>
          ) : (
            <ol className="vg-linha">
              {d.ultimas.map((u, i) => {
                const tom = tomDaAcao(u.acao);
                return (
                  <li key={i} className="vg-item" style={{ ['--tom' as string]: tom.cor, animationDelay: `${0.1 + i * 0.06}s` }}>
                    <span className="vg-ponto" aria-hidden="true" />
                    <div className="vg-topo">
                      <span className="vg-tag">{tom.rotulo}</span>
                      <span className="vg-hora">{u.quando}</span>
                    </div>
                    <p className="vg-desc">{u.descricao}</p>
                    <p className="vg-quem">
                      <span className="vg-acao">{u.acao}</span> · {u.usuario}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
