/** Estado vazio com um trecho de trilho desenhado, no lugar de uma frase solta. */
export function EstadoVazio({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="vazio">
      <svg width="88" height="44" viewBox="0 0 88 44" fill="none" aria-hidden="true">
        <rect x="6" y="8" width="76" height="4" rx="2" fill="currentColor" opacity=".55" />
        <rect x="6" y="32" width="76" height="4" rx="2" fill="currentColor" opacity=".55" />
        {[14, 28, 42, 56, 70].map((x) => (
          <rect key={x} x={x} y="5" width="4" height="34" rx="1.5" fill="currentColor" opacity=".22" />
        ))}
      </svg>
      <p className="vazio-titulo">{titulo}</p>
      {texto && <p className="vazio-texto">{texto}</p>}
    </div>
  );
}
