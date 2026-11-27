import { eixoSerra, type RelatorioSerra } from '@/lib/domain/relatorioSerra';

/**
 * "Trilhos 2026" do jeito que vai para o gerente executivo: fundo branco, barras por mês (W61 laranja, W62 verde)
 * com o número em cima, e na lateral a meta, o recolhido de cada composição em metros e o pendente. É um SVG de
 * 1600 × 960, igual à imagem enviada, para mostrar na tela e baixar como PNG.
 */
export const LARGURA_SERRA = 1600;
export const ALTURA_SERRA = 960;

const COR = { tinta: '#111827', muda: '#6b7280', texto: '#374151', grade: '#e5e7eb', eixo: '#111827', w61: '#e8a33d', w62: '#16a34a', w61Forte: '#b7791f', w62Forte: '#15803d', pendente: '#c2410c' };
const FONTE = 'Inter, "Segoe UI", Arial, Helvetica, sans-serif';

const barras = (v: number) => v.toLocaleString('pt-BR');
const metros = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function GraficoSerra({ r, id }: { r: RelatorioSerra; id?: string }) {
  // área do gráfico
  const x0 = 130, x1 = 1020, yTopo = 170, yBase = 805;
  const topo = Math.max(1, ...r.meses.flatMap((m) => [m.w61, m.w62]));
  const { max, passo } = eixoSerra(topo);
  const y = (v: number) => yBase - (v / max) * (yBase - yTopo);
  const grupo = (x1 - x0) / Math.max(r.meses.length, 1);
  const bw = Math.min(88, grupo * 0.4);
  const marcas: number[] = [];
  for (let v = 0; v <= max; v += passo) marcas.push(v);

  const somaW61 = r.meses.filter((m) => m.w61 > 0).map((m) => barras(m.w61)).join(' + ');
  const somaW62 = r.meses.filter((m) => m.w62 > 0).map((m) => barras(m.w62)).join(' + ');
  const linha1 = [somaW61 && `W61 ${somaW61}`, somaW62 && `W62 ${somaW62}`].filter(Boolean).join(' · ') + ` barras${r.parcialAte ? ` (${r.parcialAte})` : ''}.`;
  const fonte = 'Fonte: Relatório da usina, recolhimento serra (W61 e W62), Controle de Trilhos.';

  const cartoes: { rotulo: string; valor: string; cor: string }[] = [
    { rotulo: 'META DE RECOLHIMENTO', valor: metros(r.metaM), cor: COR.tinta },
    { rotulo: `RECOLHIDO W61${r.periodo.w61 ? ` (${r.periodo.w61})` : ''}`, valor: metros(r.metros.w61), cor: COR.w61Forte },
    { rotulo: `RECOLHIDO W62${r.periodo.w62 ? ` (${r.periodo.w62})` : ''}`, valor: metros(r.metros.w62), cor: COR.w62Forte },
    { rotulo: 'PENDENTE', valor: metros(r.pendenteM), cor: COR.pendente },
  ];

  return (
    <svg id={id} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${LARGURA_SERRA} ${ALTURA_SERRA}`} width={LARGURA_SERRA} height={ALTURA_SERRA} fontFamily={FONTE} role="img" aria-label={`Trilhos ${r.ano}: recolhido por mês, em barras, atualizado em ${dataBr(r.ate)}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect width={LARGURA_SERRA} height={ALTURA_SERRA} fill="#ffffff" />
      <text x={96} y={68} fontSize={42} fontWeight={800} fill={COR.tinta}>Trilhos {r.ano}</text>
      <text x={96} y={110} fontSize={19} fill={COR.muda}>Geração de Trilhos - Serra (ZEV e ZPT) · recolhido por mês, em barras · atualizado em {dataBr(r.ate)}</text>

      {/* grade e eixo */}
      {marcas.map((v) => (
        <g key={v}>
          {v > 0 && <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke={COR.grade} strokeWidth={1.5} />}
          <line x1={x0 - 8} x2={x0} y1={y(v)} y2={y(v)} stroke={COR.eixo} strokeWidth={1.5} />
          <text x={x0 - 14} y={y(v) + 6} fontSize={18} fill={COR.texto} textAnchor="end">{barras(v)}</text>
        </g>
      ))}
      <line x1={x0} x2={x0} y1={yTopo - 50} y2={yBase} stroke={COR.eixo} strokeWidth={1.8} />
      <line x1={x0} x2={x1} y1={yBase} y2={yBase} stroke={COR.eixo} strokeWidth={1.8} />
      <text x={68} y={(yTopo + yBase) / 2} fontSize={19} fill={COR.texto} textAnchor="middle" transform={`rotate(-90 68 ${(yTopo + yBase) / 2})`}>barras</text>

      {/* legenda */}
      <rect x={150} y={196} width={40} height={14} fill={COR.w61} />
      <text x={207} y={210} fontSize={20} fill={COR.tinta}>Recolhido W61</text>
      <rect x={390} y={196} width={40} height={14} fill={COR.w62} />
      <text x={447} y={210} fontSize={20} fill={COR.tinta}>Recolhido W62</text>

      {/* barras */}
      {r.meses.map((m, i) => {
        const c = x0 + grupo * (i + 0.5);
        return (
          <g key={m.mes}>
            {m.w61 > 0 && (
              <>
                <rect x={c - bw} y={y(m.w61)} width={bw} height={yBase - y(m.w61)} fill={COR.w61} />
                <text x={c - bw / 2} y={y(m.w61) - 10} fontSize={20} fill={COR.tinta} textAnchor="middle">{barras(m.w61)}</text>
              </>
            )}
            {m.w62 > 0 && (
              <>
                <rect x={c} y={y(m.w62)} width={bw} height={yBase - y(m.w62)} fill={COR.w62} />
                <text x={c + bw / 2} y={y(m.w62) - 10} fontSize={20} fill={COR.tinta} textAnchor="middle">{barras(m.w62)}</text>
              </>
            )}
            <line x1={c} x2={c} y1={yBase} y2={yBase + 7} stroke={COR.eixo} strokeWidth={1.5} />
            <text x={c} y={yBase + 37} fontSize={22} fill={COR.tinta} textAnchor="middle">{m.rotulo}</text>
          </g>
        );
      })}

      {/* cartões da lateral */}
      {cartoes.map((k, i) => (
        <g key={k.rotulo}>
          <text x={1120} y={192 + i * 163} fontSize={18} fontWeight={700} fill={COR.muda} letterSpacing={0.4}>{k.rotulo}</text>
          <text x={1120} y={236 + i * 163} fontSize={38} fontWeight={800} fill={k.cor}>{k.valor}</text>
        </g>
      ))}
      <text x={1120} y={824} fontSize={18} fill={COR.muda}>
        {metros(r.metros.total)} recolhidos · {r.percentualMeta.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% da meta
      </text>

      {/* rodapé */}
      <text x={96} y={883} fontSize={18} fill={COR.texto}>{linha1}</text>
      <text x={96} y={908} fontSize={18} fill={COR.texto}>1 barra = 10,5 m · pendente = meta − recolhido</text>
      <text x={96} y={933} fontSize={15} fill={COR.muda}>{fonte}</text>
    </svg>
  );
}
