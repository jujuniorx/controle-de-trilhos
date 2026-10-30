'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * Barra que cresce do zero até a proporção do item (animada). Com "reduzir movimento" vai direto.
 * A largura é aplicada pelo DOM, não pelo render, para a transição começar do zero.
 */
export function BarraEstoque({ percentual, cor = '#3b82f6' }: { percentual: number; cor?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const alvo = Math.max(0, Math.min(100, percentual));
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.style.transition = reduzir ? 'none' : 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.width = `${alvo}%`;
  }, [percentual]);

  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
      <span ref={ref} className="block h-full rounded-full" style={{ width: 0, background: cor }} />
    </span>
  );
}
