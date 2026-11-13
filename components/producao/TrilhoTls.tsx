// Trilho do TLS em montagem, visto de lado: cada solda emenda mais uma barra.
// A parte soldada vira um trilho contínuo (boleto, alma e patim), com a marca de cada solda;
// as barras que faltam ficam soltas, só no contorno. A última solda feita aparece em destaque.

const PASSO = 20; // largura de cada barra no desenho
const FOLGA = 3; // espaço entre as barras ainda soltas

export function TrilhoTls({ feitas, total }: { feitas: number; total: number }) {
  const n = Math.max(0, Math.min(feitas, total));
  const soldado = n * PASSO;
  return (
    <svg
      className="trilho-tls"
      viewBox={`0 0 ${total * PASSO} 16`}
      role="img"
      aria-label={`${n} de ${total} soldas no próximo TLS`}
    >
      {/* Barras que ainda faltam soldar: soltas, só o contorno do perfil. */}
      {Array.from({ length: total - n }, (_, k) => {
        const x = (n + k) * PASSO + FOLGA;
        const w = PASSO - FOLGA * 2;
        return (
          <g key={k} className="trilho-tls-solta">
            <rect x={x} y={1.5} width={w} height={4} rx={1} />
            <rect x={x + 1} y={5.5} width={w - 2} height={5} />
            <rect x={x - 1} y={10.5} width={w + 2} height={3} rx={0.8} />
          </g>
        );
      })}

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
