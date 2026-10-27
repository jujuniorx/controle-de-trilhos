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
  altura = 260,
  destaque,
}: {
  titulo: string;
  rotulos: string[];
  series: SerieBarras[];
  unidade?: string;
  altura?: number;
  /** Índice do dia escolhido: os outros dias ficam em cinza e as barras são finas. */
  destaque?: number;
}) {
  const largura = 600;
  const margemEsq = 36;
  const margemInf = 22;
  const areaL = largura - margemEsq - 6;
  // Folga no topo para o valor da barra mais alta não ser cortado.
  const topoArea = 26;
  const areaA = altura - margemInf - topoArea;
  const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: n >= 100 ? 0 : 1 });
  // Escala com marcas inteiras e sem repetir o mesmo número (ex.: 0, 1 em vez de 1, 1, 0).
  const maiorValor = Math.max(0, ...series.flatMap((s) => s.valores));
  const max = Math.max(1, Math.ceil(maiorValor));
  const passo = max <= 4 ? 1 : Math.ceil(max / 4);
  const marcas = Array.from({ length: Math.floor(max / passo) + 1 }, (_, i) => i * passo);
  const grupo = areaL / rotulos.length;
  const barraCheia = Math.max(1, (grupo * 0.8) / Math.max(1, series.length));
  // Com destaque (diário), as barras são finas: o espaço da semana fica limpo, sem barras gordas.
  const barra = destaque === undefined ? barraCheia : Math.min(barraCheia, 6);
  const yDe = (v: number) => topoArea + areaA - (v / max) * areaA;
  const mostraValor = rotulos.length <= 10 && series.length <= 2;

  return (
    <figure className="space-y-1">
      <figcaption className="text-sm font-semibold">{titulo}</figcaption>
      <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={titulo} className="h-auto w-full">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={margemEsq} x2={largura - 6} y1={yDe(m)} y2={yDe(m)} stroke="#0001" />
            <text x={margemEsq - 4} y={yDe(m) + 3} textAnchor="end" fontSize="11" fill="#555">
              {fmt(m)}
            </text>
          </g>
        ))}
        {rotulos.map((r, i) => (
          <g key={r}>
            {series.map((s, j) => {
              const v = s.valores[i] ?? 0;
              const x = destaque === undefined ? margemEsq + i * grupo + grupo * 0.1 + j * barra : margemEsq + i * grupo + grupo / 2 - (series.length * barra) / 2 + j * barra;
              const y = yDe(v);
              const cor = s.cor;
              return (
                <g key={s.nome}>
                  <rect x={x} y={y} width={Math.max(0.5, barra - 0.5)} height={Math.max(0, topoArea + areaA - y)} rx={2} fill={cor}>
                    <title>{`${r} · ${s.nome}: ${fmt(v)}${unidade}`}</title>
                  </rect>
                  {mostraValor && v > 0 && (
                    <text x={x + (barra - 0.5) / 2} y={y - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={cor}>
                      {fmt(v)}
                    </text>
                  )}
                </g>
              );
            })}
            {(rotulos.length <= 10 || i % (rotulos.length > 20 ? 5 : 2) === 0 || i === rotulos.length - 1) && (
              <text x={margemEsq + i * grupo + grupo / 2} y={altura - 6} textAnchor="middle" fontSize="11" fontWeight={destaque === i ? 700 : 400} fill={destaque === undefined || destaque === i ? '#555' : '#aaa'}>
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
