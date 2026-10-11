'use client';

import { useEffect, useState } from 'react';

/** Número que sobe de 0 até o valor ao aparecer. Sem JS ou com "reduzir movimento", mostra o valor direto. */
export function ContadorAnimado({ valor, duracaoMs = 900 }: { valor: number; duracaoMs?: number }) {
  const [exibido, setExibido] = useState(valor);

  useEffect(() => {
    const reduzir = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzir || valor <= 0) {
      setExibido(valor);
      return;
    }
    let quadro = 0;
    const inicio = performance.now();
    setExibido(0);
    const passo = (agora: number) => {
      const t = Math.min((agora - inicio) / duracaoMs, 1);
      const suave = 1 - Math.pow(1 - t, 3);
      setExibido(Math.round(valor * suave));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, duracaoMs]);

  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{exibido}</span>;
}
