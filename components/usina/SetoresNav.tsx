'use client';

import { useEffect, useState } from 'react';

export type SetorNav = { id: string; rotulo: string; curto: string };

/**
 * Seletor de setor da Usina: uma faixa que acompanha a rolagem e marca o setor que está na tela.
 * No celular usa os nomes curtos para os cinco caberem numa linha, sem arrastar para o lado.
 */
export function SetoresNav({ setores }: { setores: SetorNav[] }) {
  const [ativo, setAtivo] = useState(setores[0]?.id ?? '');

  useEffect(() => {
    const alvos = setores.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => Boolean(el));
    if (alvos.length === 0) return;
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      // O setor atual é o último título que já passou da faixa do topo.
      const limite = 150;
      let atual = alvos[0].id;
      for (const el of alvos) if (el.getBoundingClientRect().top <= limite) atual = el.id;
      // No fim da página o último setor pode nunca chegar ao topo: marca ele mesmo assim.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) atual = alvos[alvos.length - 1].id;
      setAtivo(atual);
    };
    const aoRolar = () => { if (!quadro) quadro = requestAnimationFrame(medir); };
    medir();
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar);
    return () => {
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRolar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [setores]);

  function ir(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const alvo = document.getElementById(id);
    if (!alvo) return;
    e.preventDefault();
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    alvo.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
    history.replaceState(null, '', `#${id}`);
    setAtivo(id);
  }

  const indice = Math.max(0, setores.findIndex((s) => s.id === ativo));

  return (
    <nav aria-label="Setores da usina" className="setores-nav" style={{ '--n': setores.length, '--ativo': indice } as React.CSSProperties}>
      <span className="setores-marca" aria-hidden="true" />
      {setores.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="setores-item" aria-current={s.id === ativo ? 'true' : undefined} onClick={(e) => ir(e, s.id)}>
          <span className="setores-longo">{s.rotulo}</span>
          <span className="setores-curto" aria-hidden="true">{s.curto}</span>
        </a>
      ))}
    </nav>
  );
}
