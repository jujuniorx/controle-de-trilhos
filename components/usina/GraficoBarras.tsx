// Gráfico de barras agrupadas em SVG puro (sem biblioteca), para aparecer igual na impressão.
// Sem 'use client': renderiza no servidor.

export interface SerieBarras {
  nome: string;
  cor: string;
  valores: number[];
}

export function GraficoBarras({
  titulo,
  rotulos,
  series,
  unidade = '',
}: {
  titulo: string;
  rotulos: string[];
  series: SerieBarras[];
  unidade?: string;
}) {
  const largura = 600;
  const altura = 260;
  const margemEsq = 36;
  const margemInf = 22;
  const areaL = largura - margemEsq - 6;
  const areaA = altura - margemInf - 10;
  const max = Math.max(1, ...series.flatMap((s) => s.valores));
  const grupo = areaL / rotulos.length;
  const barra = Math.max(1, (grupo * 0.8) / Math.max(1, series.length));
  const yDe = (v: number) => areaA - (v / max) * areaA + 10;

  return (
    <figure className="space-y-1">
      <figcaption className="text-sm font-semibold">{titulo}</figcaption>
      <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={titulo} className="h-auto w-full">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={margemEsq} x2={largura - 6} y1={yDe(max * f)} y2={yDe(max * f)} stroke="#0002" />
            <text x={margemEsq - 4} y={yDe(max * f) + 3} textAnchor="end" fontSize="11" fill="#555">
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        {rotulos.map((r, i) => (
          <g key={r}>
            {series.map((s, j) => {
              const v = s.valores[i] ?? 0;
              const x = margemEsq + i * grupo + grupo * 0.1 + j * barra;
              const y = yDe(v);
              return (
                <rect key={s.nome} x={x} y={y} width={Math.max(0.5, barra - 0.5)} height={Math.max(0, areaA + 10 - y)} fill={s.cor}>
                  <title>{`${r} · ${s.nome}: ${v}${unidade}`}</title>
                </rect>
              );
            })}
            {(rotulos.length <= 10 || i % (rotulos.length > 20 ? 5 : 2) === 0 || i === rotulos.length - 1) && (
              <text x={margemEsq + i * grupo + grupo / 2} y={altura - 6} textAnchor="middle" fontSize="11" fill="#555">
                {r}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="flex flex-wrap gap-3 text-xs">
        {series.map((s) => (
          <span key={s.nome} className="inline-flex items-center gap-1">
            <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} />
            {s.nome}
          </span>
        ))}
      </p>
    </figure>
  );
}
