/** Esqueleto mostrado enquanto a página carrega: título, cartões e uma tabela, no formato das telas. */
export default function Carregando() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2">
        <div className="esqueleto" style={{ height: 30, width: 'min(320px, 70%)' }} />
        <div className="esqueleto" style={{ height: 14, width: 'min(460px, 90%)' }} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="esqueleto" style={{ height: 96 }} />
        ))}
      </div>
      <div className="esqueleto space-y-0 p-4" style={{ height: 320 }} />
      <span className="sr-only">Carregando…</span>
    </main>
  );
}
