import type { RelatorioSetor } from '@/lib/services/relatorioSetor';

const LARGURA = 1200;
const COR_BARRA = '#2d74c7';
const COR_TEXTO = '#14203a';
const COR_SUAVE = '#5b6b86';
const COR_GRADE = '#d9e1ee';
const COR_FAIXA = '#eef3fb';
const FONTE = 'Barlow, Arial, sans-serif';

export function formatarNumero(valor: number, casas: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/**
 * Relatório de um setor como SVG: totais no topo, gráfico da primeira coluna e tabela por mês (ou dia).
 * A mesma imagem vai para a tela e para o PNG baixado.
 */
export function GraficoSetor({ r, id }: { r: RelatorioSetor; id: string }) {
  const n = r.colunas.length;
  const margem = 40;
  const areaLarg = LARGURA - margem * 2;
  const cardW = Math.min(260, (areaLarg - (n - 1) * 16) / n);
  const yCards = 125;
  const alturaCards = 96;
  const yGrafico = yCards + alturaCards + 60;
  const alturaBarras = 200;
  const yBase = yGrafico + alturaBarras;
  const yTabela = yBase + 60;
  const alturaLinha = 26;
  const altura = yTabela + 40 + (r.linhas.length + 2) * alturaLinha + 30;

  const principal = r.linhas.map((l) => l.valores[0] ?? 0);
  const max = Math.max(1, ...principal);
  const bw = areaLarg / Math.max(1, r.linhas.length);
  const larguraBarra = bw * 0.6;

  const colTabela = (areaLarg - 220) / n;
  const xColuna = (c: number) => 260 + (c + 1) * colTabela - 12;

  const subtitulo = `${r.periodo.rotulo}`;
  const rotuloGrafico = r.periodo.mes ? 'por dia' : 'por mês';

  return (
    <svg
      id={id}
      xmlns="http://www.w3.org/2000/svg"
      width={LARGURA}
      height={altura}
      viewBox={`0 0 ${LARGURA} ${altura}`}
      role="img"
      aria-label={`Relatório ${r.titulo}, ${subtitulo}`}
      style={{ display: 'block', width: '100%', height: 'auto', fontFamily: FONTE }}
    >
      <rect x={0} y={0} width={LARGURA} height={altura} fill="#ffffff" />

      <text x={margem} y={52} fontSize={30} fontWeight={700} fill={COR_TEXTO}>{r.titulo}</text>
      <text x={margem} y={84} fontSize={18} fill={COR_SUAVE}>{subtitulo}</text>

      {r.colunas.map((col, c) => {
        const x = margem + c * (cardW + 16);
        return (
          <g key={col.rotulo + c}>
            <rect x={x} y={yCards} width={cardW} height={alturaCards} rx={10} fill={COR_FAIXA} />
            <text x={x + 18} y={yCards + 32} fontSize={15} fontWeight={600} fill={COR_SUAVE}>{col.rotulo.toUpperCase()}</text>
            <text x={x + 18} y={yCards + 74} fontSize={32} fontWeight={700} fill={COR_TEXTO}>
              {formatarNumero(r.totais[c] ?? 0, col.casas)}
              <tspan fontSize={16} fontWeight={400} fill={COR_SUAVE}> {col.unidade}</tspan>
            </text>
          </g>
        );
      })}

      <text x={margem} y={yGrafico - 16} fontSize={16} fontWeight={600} fill={COR_SUAVE}>
        {r.colunas[0]?.rotulo} {rotuloGrafico}
      </text>
      <line x1={margem} x2={LARGURA - margem} y1={yBase} y2={yBase} stroke={COR_GRADE} strokeWidth={2} />
      {r.linhas.map((l, i) => {
        const v = principal[i];
        const h = (v / max) * (alturaBarras - 30);
        const cx = margem + i * bw + bw / 2;
        return (
          <g key={l.chave}>
            <rect x={cx - larguraBarra / 2} y={yBase - h} width={larguraBarra} height={Math.max(0, h)} rx={3} fill={COR_BARRA} />
            {v > 0 && (
              <text x={cx} y={yBase - h - 6} fontSize={12} textAnchor="middle" fill={COR_TEXTO}>
                {formatarNumero(v, r.colunas[0].casas)}
              </text>
            )}
            <text x={cx} y={yBase + 20} fontSize={12} textAnchor="middle" fill={COR_SUAVE}>{l.rotulo}</text>
          </g>
        );
      })}

      <rect x={margem} y={yTabela} width={areaLarg} height={alturaLinha + 10} fill={COR_FAIXA} />
      <text x={margem + 12} y={yTabela + 19} fontSize={14} fontWeight={600} fill={COR_SUAVE}>
        {r.periodo.mes ? 'DIA' : 'MÊS'}
      </text>
      {r.colunas.map((col, c) => (
        <text key={col.rotulo + c} x={xColuna(c)} y={yTabela + 19} fontSize={14} fontWeight={600} textAnchor="end" fill={COR_SUAVE}>
          {col.rotulo}
        </text>
      ))}

      {r.linhas.map((l, i) => {
        const y = yTabela + 10 + (i + 1) * alturaLinha + 18;
        return (
          <g key={l.chave}>
            <line x1={margem} x2={LARGURA - margem} y1={y + 8} y2={y + 8} stroke={COR_GRADE} strokeWidth={1} />
            <text x={margem + 12} y={y} fontSize={15} fill={COR_TEXTO}>{l.rotulo}</text>
            {l.valores.map((v, c) => (
              <text key={c} x={xColuna(c)} y={y} fontSize={15} textAnchor="end" fill={COR_TEXTO}>
                {formatarNumero(v, r.colunas[c].casas)}
              </text>
            ))}
          </g>
        );
      })}

      <line x1={margem} x2={LARGURA - margem} y1={yTabela + 10 + (r.linhas.length + 1) * alturaLinha + 10} y2={yTabela + 10 + (r.linhas.length + 1) * alturaLinha + 10} stroke={COR_TEXTO} strokeWidth={1.5} />
      <text x={margem + 12} y={yTabela + 10 + (r.linhas.length + 1) * alturaLinha + 28} fontSize={15} fontWeight={700} fill={COR_TEXTO}>
        Total do período
      </text>
      {r.totais.map((v, c) => (
        <text key={c} x={xColuna(c)} y={yTabela + 10 + (r.linhas.length + 1) * alturaLinha + 28} fontSize={15} fontWeight={700} textAnchor="end" fill={COR_TEXTO}>
          {formatarNumero(v, r.colunas[c].casas)}
        </text>
      ))}
    </svg>
  );
}
