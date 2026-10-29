'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { fmtToneladas } from '@/lib/format';

/**
 * Toneladas que contam do valor anterior até o novo (do zero na primeira vez).
 * A formatação é feita aqui dentro: função não pode vir do servidor como prop.
 * Usa requestAnimationFrame e respeita "reduzir movimento": nesse caso vai direto ao valor.
 */
export function ContadorNumero({ valor, duracao = 900 }: { valor: number; duracao?: number }) {
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

  return <>{fmtToneladas(atual)}</>;
}
