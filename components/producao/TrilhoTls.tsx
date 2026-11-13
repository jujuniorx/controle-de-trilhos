// Trilho do TLS em montagem, visto de lado: cada solda emenda mais uma barra.
// A parte soldada vira um trilho contínuo (boleto, alma e patim), com a marca de cada solda;
// as barras que faltam ficam soltas, só no contorno. A última solda feita aparece em destaque.

const PASSO = 20; // largura de cada barra no desenho
const FOLGA = 3; // espaço entre as barras ainda soltas

/** Trilho inteiro: quando o TLS fecha (todas as soldas feitas), o desenho mostra o trilho completo, com as emendas e as pontas. */
export function TrilhoTls({ feitas, total, completo = false }: { feitas: number; total: number; completo?: boolean }) {
  if (completo) {
    const largura = total * PASSO;
    return (
      <svg className="trilho-tls trilho-tls-completo" viewBox={`0 0 ${largura} 16`} role="img" aria-label={`TLS formado: trilho completo com ${total} soldas`}>
        <g className="trilho-tls-feito">
          <rect x={0} y={1} width={largura} height={5} rx={1.2} />
          <rect className="trilho-tls-alma" x={0} y={6} width={largura} height={4.5} />
          <rect x={0} y={10.5} width={largura} height={3.5} rx={1} />
          {Array.from({ length: total - 1 }, (_, i) => (
            <rect key={i} className="trilho-tls-emenda" x={(i + 1) * PASSO - 0.6} y={1} width={1.2} height={13} />
          ))}
        </g>
        <rect className="trilho-tls-pontas" x={0} y={0} width={1.6} height={16} rx={0.8} />
        <rect className="trilho-tls-pontas" x={largura - 1.6} y={0} width={1.6} height={16} rx={0.8} />
      </svg>
    );
  }
  const n = Math.max(0, Math.min(feitas, total));
  const soldado = n * PASSO;
  return (
    <svg
      className="trilho-tls"
      viewBox={`0 0 ${total * PASSO} 16`}
      role="img"
      aria-label={`${n} de ${total} soldas no próximo TLS`}
    >
      {/* Trilho que ainda falta soldar: um trilho completo, contínuo, só no contorno. */}
      {n < total && (
        <g className="trilho-tls-solta">
          <rect x={soldado} y={1} width={(total - n) * PASSO} height={5} rx={1.2} />
          <rect x={soldado} y={6} width={(total - n) * PASSO} height={4.5} />
          <rect x={soldado} y={10.5} width={(total - n) * PASSO} height={3.5} rx={1} />
        </g>
      )}

      {/* Trecho já soldado: um trilho só. */}
      {n > 0 && (
        <g className="trilho-tls-feito">
          <rect x={0} y={1} width={soldado} height={5} rx={1.2} />
          <rect className="trilho-tls-alma" x={0} y={6} width={soldado} height={4.5} />
          <rect x={0} y={10.5} width={soldado} height={3.5} rx={1} />
          {/* Marca de cada solda já fria. */}
          {Array.from({ length: n - 1 }, (_, i) => (
            <rect key={i} className="trilho-tls-emenda" x={(i + 1) * PASSO - 0.6} y={1} width={1.2} height={13} />
          ))}
          {/* A solda mais recente, na ponta do trilho. */}
          <rect className="trilho-tls-ultima" x={soldado - 1.6} y={0} width={3.2} height={15} rx={1.2} />
        </g>
      )}
    </svg>
  );
}
