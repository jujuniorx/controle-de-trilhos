export default function Carregando() {
  return (
    <main className="mx-auto max-w-md space-y-3 p-6" aria-busy="true" aria-label="Carregando">
      <div className="esqueleto" style={{ height: 30, width: '60%' }} />
      <div className="esqueleto" style={{ height: 110 }} />
      <div className="esqueleto" style={{ height: 110 }} />
    </main>
  );
}
