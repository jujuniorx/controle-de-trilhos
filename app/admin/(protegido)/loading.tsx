export default function Carregando() {
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6" aria-busy="true" aria-label="Carregando">
      <div className="esqueleto" style={{ height: 34, width: '50%' }} />
      <div className="grid grid-cols-2 gap-3">
        <div className="esqueleto" style={{ height: 96 }} />
        <div className="esqueleto" style={{ height: 96 }} />
      </div>
      <div className="esqueleto" style={{ height: 280 }} />
    </main>
  );
}
