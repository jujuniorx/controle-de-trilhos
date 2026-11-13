// Barra de trilho do TLS em montagem. Na ponta esquerda aparece o perfil do trilho
// (boleto, alma e patim) e dali a barra segue para a direita: cada solda emenda mais um pedaço.
// Os pedaços que faltam ficam soltos, menores, só no contorno. A solda mais recente fica em destaque.
// Quando o TLS fecha, a barra aparece inteira.

const PASSO = 20; // comprimento de cada pedaço no desenho
const FOLGA = 3; // espaço de cada lado dos pedaços ainda soltos
const INICIO = 6.5; // a barra nasce no meio do perfil
const TOPO = 1; // margem de cima

// Faixas da barra vista de lado, alinhadas com o perfil.
const BOLETO = { y: TOPO, h: 5.2 };
const ALMA = { y: TOPO + 5.2, h: 6.8 };
const PATIM = { y: TOPO + 12, h: 3.5 };

// Perfil do trilho visto de frente (13 de largura por 15,5 de altura): boleto em cima, alma fina, patim largo.
const PERFIL =
  'M3.5,0 H9.5 Q11,0 11,1.5 V3.5 Q11,5 9.5,5.2 L7.6,5.8 V11 L12.4,12.6 Q13,12.8 13,13.5 V15 Q13,15.5 12.5,15.5 H0.5 Q0,15.5 0,15 V13.5 Q0,12.8 0.6,12.6 L5.4,11 V5.8 L3.5,5.2 Q2,5 2,3.5 V1.5 Q2,0 3.5,0 Z';

/** total = soldas do TLS (12). O TLS tem total + 1 barras (13): cada solda une uma barra à seguinte. */
export function TrilhoTls({ feitas, total, completo = false }: { feitas: number; total: number; completo?: boolean }) {
  const barras = total + 1;
  // Com 1 solda já há 2 barras unidas; com 0 soldas nada foi soldado ainda.
  const n = completo ? barras : feitas > 0 ? Math.min(feitas + 1, barras) : 0;
  const soldado = n * PASSO;
  const fim = INICIO + soldado;
  return (
    <svg
      className={completo ? 'trilho-tls trilho-tls-completo' : 'trilho-tls'}
      viewBox={`0 0 ${INICIO + barras * PASSO + (completo ? 15 : 2)} 17.5`}
      role="img"
      aria-label={completo ? `TLS formado: barra completa com ${total} soldas` : `${n} de ${total} soldas no próximo TLS`}
    >
      {/* Pedaços que ainda faltam soldar: trilhos menores, soltos, só no contorno. */}
      {Array.from({ length: barras - n }, (_, k) => {
        const x = INICIO + (n + k) * PASSO + FOLGA;
        const w = PASSO - FOLGA * 2;
        return (
          <g key={k} className="trilho-tls-solta">
            <rect x={x} y={BOLETO.y + 0.5} width={w} height={BOLETO.h - 1} rx={1} />
            <rect x={x + 1} y={ALMA.y - 0.5} width={w - 2} height={ALMA.h + 1} />
            <rect x={x - 1} y={PATIM.y + 0.5} width={w + 2} height={PATIM.h - 1} rx={0.8} />
          </g>
        );
      })}

      {/* Trecho já soldado: uma barra só, saindo do perfil. */}
      {n > 0 && (
        <g className="trilho-tls-feito">
          <rect x={INICIO} y={BOLETO.y} width={soldado} height={BOLETO.h} rx={1} />
          <rect className="trilho-tls-alma" x={INICIO} y={ALMA.y - 0.5} width={soldado} height={ALMA.h + 1} />
          <rect x={INICIO} y={PATIM.y} width={soldado} height={PATIM.h} rx={0.8} />
          {/* Marca discreta de cada solda já fria. */}
          {Array.from({ length: n - 1 }, (_, i) => (
            <rect key={i} className="trilho-tls-emenda" x={INICIO + (i + 1) * PASSO - 0.4} y={BOLETO.y} width={0.8} height={PATIM.y + PATIM.h - BOLETO.y} />
          ))}
          {/* A solda mais recente, na ponta da barra. Com o TLS fechado, a ponta fica limpa. */}
          {!completo && <rect className="trilho-tls-ultima" x={fim - 1.6} y={0} width={3.2} height={17.5} rx={1.4} />}
          {/* Perfil do trilho na ponta esquerda, com um fio de respiro em volta. */}
          <path className="trilho-tls-perfil" d={PERFIL} transform={`translate(0 ${TOPO})`} />
          {/* Com o TLS fechado, a outra ponta também ganha o perfil, espelhado. */}
          {completo && <path className="trilho-tls-perfil" d={PERFIL} transform={`translate(${fim + INICIO} ${TOPO}) scale(-1 1)`} />}
        </g>
      )}
    </svg>
  );
}
