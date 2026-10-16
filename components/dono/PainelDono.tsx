import Link from 'next/link';
import { saudacaoRotativa } from '@/lib/saudacao';
import { ContadorAnimado } from '@/components/ui/ContadorAnimado';

interface Props {
  primeiroNome: string;
  pendentesConferencia: number;
  remetidosAguardando: number;
  carretasNaPortaria: number;
}

/**
 * Entrada do DONO: um quadro de partidas de estação. Cada área é uma linha com número real;
 * a barra embaixo é um trilho que cresce conforme o volume. Estilo e animações ficam aqui (<style>).
 */
export function PainelDono({ primeiroNome, pendentesConferencia, remetidosAguardando, carretasNaPortaria }: Props) {
  const linhas = [
    { area: 'Escritório', destino: 'Conferência', numero: pendentesConferencia, rotulo: 'pendentes', href: '/admin', cor: '#60a5fa' },
    { area: 'Pátio', destino: 'Recebimento', numero: remetidosAguardando, rotulo: 'aguardando', href: '/patio', cor: '#fb923c' },
    { area: 'Portaria', destino: 'Carretas', numero: carretasNaPortaria, rotulo: 'na portaria', href: '/portaria', cor: '#4ade80' },
  ];
  const maximo = Math.max(1, ...linhas.map((l) => l.numero));

  return (
    <section className="qp">
      <style>{`
        .qp { --fundo:#0c0f14; --linha:#1f2630; --texto:#e7ecf3; --suave:#7d8899;
          border-radius:18px; overflow:hidden; background:var(--fundo); color:var(--texto);
          border:1px solid var(--linha); font-family:'DM Sans',system-ui,sans-serif; animation:qp-abre .5s ease-out backwards; }
        .qp-topo { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap;
          padding:24px 24px 18px; border-bottom:1px solid var(--linha);
          background:repeating-linear-gradient(90deg, transparent 0 22px, rgba(125,136,153,.07) 22px 24px); }
        .qp-saud { margin:0; font-size:12px; letter-spacing:.28em; text-transform:uppercase; color:var(--suave); }
        .qp-nome { margin:6px 0 0; font-size:clamp(26px,5vw,38px); font-weight:700; letter-spacing:-.01em; }
        .qp-relogio { font-family:'JetBrains Mono',ui-monospace,monospace; font-size:13px; color:var(--suave); text-align:right; }
        .qp-cabeca, .qp-linha { display:grid; grid-template-columns: minmax(0,1.2fr) minmax(0,1.4fr) 110px; align-items:center; gap:16px; }
        .qp-cabeca { padding:12px 24px; font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:var(--suave); border-bottom:1px solid var(--linha); }
        .qp-linha { position:relative; display:grid; padding:20px 24px 22px; text-decoration:none; color:inherit; border-bottom:1px solid var(--linha);
          transition:background .2s ease; animation:qp-entra .5s cubic-bezier(.2,.7,.2,1) backwards; }
        .qp-linha:nth-of-type(1){animation-delay:.08s} .qp-linha:nth-of-type(2){animation-delay:.16s} .qp-linha:nth-of-type(3){animation-delay:.24s}
        .qp-linha:hover, .qp-linha:focus-visible { background:rgba(255,255,255,.03); outline:none; }
        .qp-area { display:flex; align-items:center; gap:12px; font-weight:700; font-size:18px; }
        .qp-bolinha { width:10px; height:10px; border-radius:50%; background:var(--cor); box-shadow:0 0 12px var(--cor); flex:none; }
        .qp-destino { margin-top:4px; font-size:13px; color:var(--suave); padding-left:22px; }
        .qp-trilho { position:relative; height:10px; border-radius:6px; background:
          repeating-linear-gradient(90deg, #2a3341 0 6px, transparent 6px 10px); overflow:hidden; }
        .qp-trilho span { position:absolute; inset:0 auto 0 0; border-radius:6px; background:var(--cor); width:var(--w);
          transform-origin:left; animation:qp-cresce .9s cubic-bezier(.2,.7,.2,1) backwards; box-shadow:0 0 14px var(--cor); }
        .qp-rotulo { margin-top:8px; font-size:12px; color:var(--suave); }
        .qp-numero { font-family:'JetBrains Mono',ui-monospace,monospace; font-size:44px; font-weight:700; color:var(--cor); text-align:right; font-variant-numeric:tabular-nums; line-height:1; }
        .qp-seta { position:absolute; right:12px; top:12px; color:var(--suave); opacity:0; transition:opacity .2s ease, transform .2s ease; font-size:14px; }
        .qp-linha:hover .qp-seta { opacity:1; transform:translateX(4px); }
        @keyframes qp-abre { from { opacity:0; } to { opacity:1; } }
        @keyframes qp-entra { from { opacity:0; transform:translateX(-14px); } to { opacity:1; transform:none; } }
        @keyframes qp-cresce { from { transform:scaleX(0); } to { transform:scaleX(1); } }
        @media (max-width: 640px) {
          .qp-cabeca { display:none; }
          .qp-linha { grid-template-columns: 1fr auto; row-gap:12px; padding:18px 18px; }
          .qp-trilho { grid-column: 1 / -1; grid-row: 2; }
          .qp-topo { padding:20px 18px 16px; }
        }
        @media (prefers-reduced-motion: reduce) { .qp, .qp-linha, .qp-trilho span { animation:none !important; } }
      `}</style>

      <div className="qp-topo">
        <div>
          <p className="qp-saud">{saudacaoRotativa()}</p>
          <h1 className="qp-nome">{primeiroNome}</h1>
        </div>
        <div className="qp-relogio">Quadro de partidas · hoje</div>
      </div>

      <div className="qp-cabeca" aria-hidden="true">
        <span>Área</span>
        <span>Volume</span>
        <span style={{ textAlign: 'right' }}>Agora</span>
      </div>

      {linhas.map((l) => (
        <Link key={l.area} href={l.href} className="qp-linha" style={{ ['--cor' as string]: l.cor }}>
          <div>
            <div className="qp-area">
              <span className="qp-bolinha" />
              {l.area}
            </div>
            <div className="qp-destino">{l.destino}</div>
          </div>
          <div>
            <div className="qp-trilho">
              <span style={{ ['--w' as string]: `${Math.max(6, (l.numero / maximo) * 100)}%` }} />
            </div>
            <div className="qp-rotulo">{l.rotulo}</div>
          </div>
          <div className="qp-numero">
            <ContadorAnimado valor={l.numero} />
          </div>
          <span className="qp-seta" aria-hidden="true">→</span>
        </Link>
      ))}
    </section>
  );
}
