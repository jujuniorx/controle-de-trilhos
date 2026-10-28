'use client';

/** Se a Portaria não carregar (ex.: banco demorando), mostra uma saída clara em vez de uma tela branca. */
export default function ErroPortaria({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="portaria-tela mx-auto max-w-md space-y-3 p-6 text-center">
      <h1 className="page-title">Não deu para carregar</h1>
      <p className="text-sm text-ink-muted">O sistema demorou para responder. Tente de novo; se continuar, avise o administrativo.</p>
      <button className="btn btn-primary h-12" onClick={() => reset()}>
        Tentar de novo
      </button>
    </main>
  );
}
