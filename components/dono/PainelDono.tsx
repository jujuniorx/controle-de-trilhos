import Link from 'next/link';
import { saudacaoRotativa } from '@/lib/saudacao';
import { ContadorAnimado } from '@/components/ui/ContadorAnimado';
import { FundoTrilhos } from '@/components/ui/FundoTrilhos';

interface Props {
  primeiroNome: string;
  pendentesConferencia: number;
  remetidosAguardando: number;
  carretasNaPortaria: number;
}

/**
 * Tela de entrada exclusiva do DONO: uma saudação que muda com o horário e três cartões vivos,
 * um para cada área (Escritório, Pátio e Portaria). Cada cartão mostra um número real e leva
 * à área. Visual e animações ficam no próprio componente (<style>), sem mexer no restante do CSS.
 */
export function PainelDono({ primeiroNome, pendentesConferencia, remetidosAguardando, carretasNaPortaria }: Props) {
  const cartoes = [
    {
      area: 'Escritório',
      titulo: 'Conferência',
      numero: pendentesConferencia,
      unidade: pendentesConferencia === 1 ? 'movimentação pendente' : 'movimentações pendentes',
      href: '/admin',
      cor: '#60a5fa',
    },
    {
      area: 'Pátio',
      titulo: 'Recebimento',
      numero: remetidosAguardando,
      unidade: remetidosAguardando === 1 ? 'remetido aguardando' : 'remetidos aguardando',
      href: '/patio',
      cor: '#fb923c',
    },
    {
      area: 'Portaria',
      titulo: 'Carretas',
      numero: carretasNaPortaria,
      unidade: carretasNaPortaria === 1 ? 'carreta na portaria' : 'carretas na portaria',
      href: '/portaria',
      cor: '#4ade80',
    },
  ];

  return (
    <section className="dono-painel">
      <style>{`
        .dono-painel { position: relative; overflow: hidden; border-radius: 24px; padding: 34px 26px 26px; color: #f4efe6;
          background: radial-gradient(120% 90% at 0% 0%, #1d2a44 0%, #0b1120 60%, #070b14 100%);
          animation: dono-entrada .7s cubic-bezier(.2,.7,.2,1) backwards; }
        .dono-painel .fundo-trilhos { opacity: .55; }
        .dono-saudacao { position: relative; font-size: 13px; letter-spacing: .24em; text-transform: uppercase; color: #d9a35b; font-weight: 600; }
        .dono-titulo { position: relative; margin: 10px 0 0; font-family: 'Fraunces', Georgia, serif; font-weight: 300; font-size: clamp(30px, 6vw, 46px); line-height: 1.05; text-wrap: balance; }
        .dono-titulo em { font-style: italic; color: #c9d3e6; }
        .dono-sub { position: relative; margin: 10px 0 0; font-size: 15px; color: #9fb0cc; }
        .dono-grade { position: relative; margin-top: 26px; display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
        .dono-cartao { display: block; text-decoration: none; color: inherit; border-radius: 18px; padding: 20px 18px;
          background: rgba(142,163,199,.08); border: 1.5px solid var(--cor); backdrop-filter: blur(6px);
          transition: transform .25s ease, box-shadow .25s ease, background .25s ease;
          animation: dono-entrada .6s cubic-bezier(.2,.7,.2,1) backwards; }
        .dono-cartao:nth-child(2) { animation-delay: .12s; }
        .dono-cartao:nth-child(3) { animation-delay: .24s; }
        .dono-cartao:hover, .dono-cartao:focus-visible { transform: translateY(-4px); background: rgba(142,163,199,.14); box-shadow: 0 14px 30px -12px var(--cor); outline: none; }
        .dono-area { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--cor); font-weight: 700; }
        .dono-cartao-titulo { margin-top: 8px; font-family: 'Fraunces', Georgia, serif; font-size: 22px; font-weight: 600; }
        .dono-numero { margin-top: 14px; font-size: 44px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: var(--cor); }
        .dono-unidade { margin-top: 6px; font-size: 13px; color: #9fb0cc; }
        .dono-brilho { position: absolute; inset: -40% -20%; background: linear-gradient(115deg, transparent 40%, rgba(255,255,255,.07) 50%, transparent 60%); animation: dono-varredura 6s ease-in-out infinite; pointer-events: none; }
        @keyframes dono-entrada { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes dono-varredura { 0%, 100% { transform: translateX(-30%); } 50% { transform: translateX(30%); } }
        @media (prefers-reduced-motion: reduce) {
          .dono-painel, .dono-cartao, .dono-brilho { animation: none !important; }
          .dono-cartao:hover { transform: none; }
        }
      `}</style>
      <div className="dono-brilho" aria-hidden="true" />
      <FundoTrilhos />
      <p className="dono-saudacao">{saudacaoRotativa()}</p>
      <h1 className="dono-titulo">
        {primeiroNome}, <em>o pátio está sob controle.</em>
      </h1>
      <p className="dono-sub">Um pouco de cada área, num só lugar.</p>

      <div className="dono-grade">
        {cartoes.map((c) => (
          <Link key={c.area} href={c.href} className="dono-cartao" style={{ ['--cor' as string]: c.cor }}>
            <div className="dono-area">{c.area}</div>
            <div className="dono-cartao-titulo">{c.titulo}</div>
            <div className="dono-numero">
              <ContadorAnimado valor={c.numero} />
            </div>
            <div className="dono-unidade">{c.unidade}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
