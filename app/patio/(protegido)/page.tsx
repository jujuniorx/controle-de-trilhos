import Link from 'next/link';

export default function PatioHomePage() {
  return (
    <main className="mx-auto max-w-md p-6 sm:max-w-2xl lg:max-w-3xl">
      <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">O que vamos registrar?</h1>
      <p className="mt-1 text-sm text-ink-muted">Escolha uma opção. Sem internet, o registro fica guardado e é enviado depois.</p>
      <div className="acoes-patio">
        <Link href="/patio/recebimentos/novo" className="acao-patio acao-patio-principal">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>
          <strong>Novo recebimento</strong>
          <span>Caminhão chegando com trilhos para o pátio.</span>
        </Link>
        <Link href="/patio/remetidos" className="acao-patio">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 17H10V8h11zM10 11H6l-3 3v3h7" /><circle cx="6" cy="18" r="1.6" /><circle cx="16" cy="18" r="1.6" /></svg>
          <strong>Remetidos</strong>
          <span>Cadastrar saída (aguardando chegada ou lançar agora) e confirmar carregamentos.</span>
        </Link>
      </div>
    </main>
  );
}
