/** Fundo decorativo: brilho suave + trilho em perspectiva com dormentes que "andam" devagar. */
export function FundoTrilhos({ className = '' }: { className?: string }) {
  return (
    <div className={`fundo-trilhos ${className}`} aria-hidden="true">
      <div className="fundo-trilhos-brilho" />
      <div className="fundo-trilhos-via" />
    </div>
  );
}
