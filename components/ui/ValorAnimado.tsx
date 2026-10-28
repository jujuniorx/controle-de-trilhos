'use client';

import { useEffect, useState } from 'react';

/**
 * Número com casas decimais que sobe de 0 até o valor ao aparecer, formatado em pt-BR.
 * Com "reduzir movimento" ligado, mostra o valor direto.
 */
export function ValorAnimado({ valor, casas = 0, sufixo = '', duracaoMs = 1000 }: { valor: number; casas?: number; sufixo?: string; duracaoMs?: number }) {
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
      setExibido(valor * suave);
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, duracaoMs]);

  const texto = exibido.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return (
    <span className="num-unidade" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {texto}
      {sufixo && <span className="un">{sufixo.trim()}</span>}
    </span>
  );
}
