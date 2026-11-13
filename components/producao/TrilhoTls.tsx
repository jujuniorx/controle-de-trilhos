// Trilho do TLS em montagem, visto de lado, apoiado nos dormentes.
// Cada solda emenda mais uma barra: o trecho soldado é um trilho só (boleto, alma e patim),
// com o cordão de cada solda; as barras que faltam ficam soltas, separadas, só no contorno.
// A solda mais recente aparece em destaque. Quando o TLS fecha, o trilho aparece inteiro.

const PASSO = 24; // comprimento de cada barra no desenho
const FOLGA = 2.5; // espaço de cada lado das barras ainda soltas
const ALTURA = 26;

// Perfil do trilho (de cima para baixo): boleto, alma e patim.
const BOLETO = { y: 2, h: 6 };
const ALMA = { y: 8, h: 6 };
const PATIM = { y: 14, h: 3.5 };
const DORMENTE = { y: 18.5, h: 4.5, w: 8 };

function Dormentes({ total, ate }: { total: number; ate: number }) {
  return (
    <>
      {Array.from({ length: total }, (_, i) => (
        <rect
          key={i}
          className={i < ate ? 'trilho-tls-dormente trilho-tls-dormente-firme' : 'trilho-tls-dormente'}
          x={i * PASSO + PASSO / 2 - DORMENTE.w / 2}
          y={DORMENTE.y}
          width={DORMENTE.w}
          height={DORMENTE.h}
          rx={1}
        />
      ))}
    </>
  );
}

/** Trecho soldado: um trilho contínuo de x = 0 até `comprimento`, com o cordão de cada solda. */
function TrechoSoldado({ comprimento, soldas, destacarUltima }: { comprimento: number; soldas: number[]; destacarUltima: boolean }) {
  return (
    <g className="trilho-tls-feito">
      <rect x={0} y={BOLETO.y} width={comprimento} height={BOLETO.h} rx={1.6} />
      <rect className="trilho-tls-alma" x={0} y={ALMA.y - 0.5} width={comprimento} height={ALMA.h + 1} />
      <rect x={0} y={PATIM.y} width={comprimento} height={PATIM.h} rx={1} />
      {/* Brilho do boleto, por onde a roda passa. */}
      <rect className="trilho-tls-brilho" x={1.5} y={BOLETO.y + 1.1} width={Math.max(0, comprimento - 3)} height={0.9} rx={0.45} />
      {soldas.map((x, i) => {
        const ultima = destacarUltima && i === soldas.length - 1;
        return ultima ? (
          <g key={x}>
            <rect className="trilho-tls-ultima-halo" x={x - 4} y={0} width={8} height={PATIM.y + PATIM.h + 1.5} rx={4} />
            <rect className="trilho-tls-ultima" x={x - 1.5} y={BOLETO.y - 1.2} width={3} height={PATIM.y + PATIM.h - BOLETO.y + 2.2} rx={1.5} />
          </g>
        ) : (
          <rect key={x} className="trilho-tls-cordao" x={x - 1.1} y={BOLETO.y - 0.8} width={2.2} height={PATIM.y + PATIM.h - BOLETO.y + 1.6} rx={1.1} />
        );
      })}
    </g>
  );
}

export function TrilhoTls({ feitas, total, completo = false }: { feitas: number; total: number; completo?: boolean }) {
  const largura = total * PASSO;
  const n = completo ? total : Math.max(0, Math.min(feitas, total));
  const soldado = n * PASSO;
  // Cordões de solda: um a cada emenda dentro do trecho soldado; fora do TLS fechado, a última fica na ponta.
  const soldas = completo
    ? Array.from({ length: total - 1 }, (_, i) => (i + 1) * PASSO)
    : Array.from({ length: n }, (_, i) => (i + 1) * PASSO);

  return (
    <svg
      className={completo ? 'trilho-tls trilho-tls-completo' : 'trilho-tls'}
      viewBox={`0 0 ${largura} ${ALTURA}`}
      role="img"
      aria-label={completo ? `TLS formado: trilho completo com ${total} soldas` : `${n} de ${total} soldas no próximo TLS`}
    >
      <Dormentes total={total} ate={n} />

      {/* Barras que ainda faltam soldar: soltas, com folga entre elas, só o contorno do perfil. */}
      {Array.from({ length: total - n }, (_, k) => {
        const x = (n + k) * PASSO + FOLGA;
        const w = PASSO - FOLGA * 2;
        return (
          <g key={k} className="trilho-tls-solta">
            <rect x={x} y={BOLETO.y} width={w} height={PATIM.y + PATIM.h - BOLETO.y} rx={1.4} />
            <line x1={x} x2={x + w} y1={ALMA.y} y2={ALMA.y} />
            <line x1={x} x2={x + w} y1={PATIM.y} y2={PATIM.y} />
          </g>
        );
      })}

      {n > 0 && <TrechoSoldado comprimento={soldado} soldas={soldas} destacarUltima={!completo} />}
    </svg>
  );
}
