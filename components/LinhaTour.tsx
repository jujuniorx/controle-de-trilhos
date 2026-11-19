'use client';

import { useEffect, useRef, useState } from 'react';
import { ESTACOES_LINHA, TELAS_PASSEIO } from '@/lib/linhaProducao';

/**
 * Passeio pela linha de produção, embaixo dos setores da tela inicial. A seção é alta (uma tela por estação) e
 * transparente: quem desenha é a cena do fundo (CenaFerrovia), que lê a rolagem desta seção e anda a câmera de lado.
 * Aqui ficam só a legenda da estação da vez e o mapinha da linha, que leva direto a cada estação.
 */
export function LinhaTour() {
  const ref = useRef<HTMLElement>(null);
  const [atual, setAtual] = useState(0);
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let pedido = 0;
    const medir = () => {
      pedido = 0;
      const r = el.getBoundingClientRect();
      const total = Math.max(1, r.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / total));
      setAtivo(r.top < window.innerHeight * 0.35 && r.bottom > window.innerHeight * 0.65);
      let i = 0;
      ESTACOES_LINHA.forEach((e, k) => { if (p >= e.p - 0.16) i = k; });
      setAtual(i);
    };
    const agendar = () => { if (!pedido) pedido = requestAnimationFrame(medir); };
    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar);
    medir();
    return () => {
      window.removeEventListener('scroll', agendar);
      window.removeEventListener('resize', agendar);
      if (pedido) cancelAnimationFrame(pedido);
    };
  }, []);

  const irPara = (p: number) => {
    const el = ref.current;
    if (!el) return;
    const topo = el.getBoundingClientRect().top + window.scrollY;
    const total = el.offsetHeight - window.innerHeight;
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: topo + p * total, behavior: suave ? 'smooth' : 'auto' });
  };

  const e = ESTACOES_LINHA[atual];
  return (
    <section id="linha" ref={ref} className="linha-tour" style={{ height: `${TELAS_PASSEIO * 100}vh` }} aria-label="Linha de produção">
      <div className="linha-tour-painel">
        <div className={`linha-tour-topo ${ativo ? 'linha-tour-on' : ''}`}>
          <nav className="linha-tour-mapa" aria-label="Estações da linha">
            <span className="linha-tour-mapa-trilho" aria-hidden="true" />
            {ESTACOES_LINHA.map((est, k) => (
              <button
                key={est.id}
                type="button"
                className={`linha-tour-ponto ${k === atual ? 'linha-tour-ponto-atual' : ''} ${k < atual ? 'linha-tour-ponto-feito' : ''}`}
                onClick={() => irPara(est.p)}
                aria-current={k === atual ? 'step' : undefined}
              >
                <span className="linha-tour-bolinha" aria-hidden="true" />
                <span className="linha-tour-ponto-nome">{est.nome}</span>
              </button>
            ))}
          </nav>
          <div className="linha-tour-legenda" aria-live="polite">
            <span className="linha-tour-etapa">Estação {atual + 1} de {ESTACOES_LINHA.length}</span>
            <h2 className="linha-tour-nome">{e.nome}</h2>
            <p className="linha-tour-texto">{e.texto}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
