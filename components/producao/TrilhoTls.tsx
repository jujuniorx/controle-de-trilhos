// Barra de trilho do TLS em montagem. Na ponta esquerda aparece o perfil do trilho
// (boleto, alma e patim) e dali a barra segue para a direita: cada solda emenda mais um pedaço.
// Os pedaços que faltam ficam soltos, menores, só no contorno. A solda mais recente fica em destaque.
// Quando o TLS fecha, a barra aparece inteira.

const PASSO_BASE = 20; // comprimento de cada pedaço no desenho
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

/**
 * total = soldas do TLS (12). O TLS tem total + 1 barras (13): cada solda une uma barra à seguinte.
 * deOntem: quantas das soldas feitas vieram do dia anterior (esse trecho sai hachurado).
 * semSoltas: reemprego, onde o TLS não fecha num número fixo: mostra só as barras já soldadas.
 */
export function TrilhoTls({ feitas, total, completo = false, deOntem = 0, semSoltas = false }: { feitas: number; total: number; completo?: boolean; deOntem?: number; semSoltas?: boolean }) {
  // Com 1 solda já há 2 barras unidas; com 0 soldas nada foi soldado ainda.
  const barras = semSoltas ? Math.max(feitas + 1, 2) : total + 1;
  // No reemprego o TLS passa de 13 barras: as barras encurtam no desenho para o trilho não ficar fino demais.
  const PASSO = semSoltas && barras > total + 1 ? Math.max(8, ((total + 1) * PASSO_BASE) / barras) : PASSO_BASE;
  const n = completo ? barras : feitas > 0 ? Math.min(feitas + 1, barras) : 0;
  // Trecho de ontem: as barras unidas pelas soldas de ontem (com 4 soldas, 5 barras).
  const ontem = !completo && deOntem > 0 && n > 0 ? Math.min(deOntem + 1, n) * PASSO : 0;
  const soldado = n * PASSO;
  const fim = INICIO + soldado;
  return (
    <svg
      className={completo ? 'trilho-tls trilho-tls-completo' : 'trilho-tls'}
      viewBox={`0 0 ${INICIO + barras * PASSO + (completo ? 15 : 2)} 17.5`}
      role="img"
      aria-label={completo ? `TLS formado: barra completa com ${total} soldas` : semSoltas ? `${feitas} soldas no TLS de reemprego` : `${feitas} de ${total} soldas no próximo TLS${deOntem > 0 ? `, ${Math.min(deOntem, feitas)} de ontem` : ''}`}
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
          {/* Soldas de ontem: listras finas por cima do trecho, para separar de hoje. */}
          {ontem > 0 && (
            <g className="trilho-tls-ontem">
              {Array.from({ length: Math.ceil(ontem / 3) }, (_, i) => {
                const x = INICIO + i * 3;
                return <line key={i} x1={x} y1={PATIM.y + PATIM.h} x2={Math.min(x + 4, INICIO + ontem)} y2={BOLETO.y} />;
              })}
              <rect className="trilho-tls-ontem-fim" x={INICIO + ontem - 0.5} y={BOLETO.y} width={1} height={PATIM.y + PATIM.h - BOLETO.y} />
            </g>
          )}
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
