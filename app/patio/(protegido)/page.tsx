import Link from 'next/link';

export default function PatioHomePage() {
  return (
    <main className="mx-auto max-w-md p-6 sm:max-w-2xl lg:max-w-3xl">
      <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">O que vamos registrar?</h1>
      <p className="mt-1 text-sm text-ink-muted">Escolha uma opção. Sem internet, o registro fica guardado e é enviado depois.</p>
      <div className="acoes-patio">
        <Link href="/patio/recebimentos/novo" className="acao-patio acao-patio-principal">
          <strong>Novo recebimento</strong>
          <span>Caminhão chegando com trilhos para o pátio.</span>
        </Link>
        <Link href="/patio/remetidos" className="acao-patio">
          <strong>Remetidos</strong>
          <span>Cadastrar saída (aguardando chegada ou lançar agora) e confirmar carregamentos.</span>
        </Link>
      </div>
    </main>
  );
}
