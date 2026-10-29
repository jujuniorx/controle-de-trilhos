'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Número que conta do valor anterior até o novo (do zero na primeira vez).
 * Usa requestAnimationFrame e respeita "reduzir movimento": nesse caso vai direto ao valor.
 */
export function ContadorNumero({
  valor,
  formatar,
  duracao = 900,
}: {
  valor: number;
  formatar: (n: number) => string;
  duracao?: number;
}) {
  const [atual, setAtual] = useState(valor);
  const anterior = useRef(0);

  useLayoutEffect(() => {
    const de = anterior.current;
    anterior.current = valor;
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzir || de === valor) {
      setAtual(valor);
      return;
    }
    setAtual(de);
    const inicio = performance.now();
    let frame = 0;
    const tick = (agora: number) => {
      const p = Math.min((agora - inicio) / duracao, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setAtual(de + (valor - de) * e);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [valor, duracao]);

  return <>{formatar(atual)}</>;
}
