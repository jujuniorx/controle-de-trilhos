'use client';

import { useEffect } from 'react';

/**
 * Se a página falhar (ex.: banco acordando), tenta de novo sozinha uma vez, sem o usuário apertar
 * "Reload". Se falhar de novo, mostra o botão.
 */
export default function ErroAdmin({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    let jaTentou = false;
    try {
      jaTentou = sessionStorage.getItem('retry-admin') === '1';
      if (!jaTentou) sessionStorage.setItem('retry-admin', '1');
    } catch {
      jaTentou = true;
    }
    if (jaTentou) {
      try {
        sessionStorage.removeItem('retry-admin');
      } catch {
        /* sem storage: só mostra o botão */
      }
      return;
    }
    const t = setTimeout(() => reset(), 800);
    return () => clearTimeout(t);
  }, [reset]);

  return (
    <main className="mx-auto max-w-md space-y-3 p-6 text-center">
      <h1 className="page-title">Não deu para carregar</h1>
      <p className="text-sm text-ink-muted">O sistema demorou para responder. Tente de novo.</p>
      <button className="btn btn-primary" onClick={() => reset()}>
        Tentar de novo
      </button>
    </main>
  );
}
