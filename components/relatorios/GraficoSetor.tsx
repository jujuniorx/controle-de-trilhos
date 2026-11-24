import type { RelatorioSetor } from '@/lib/services/relatorioSetor';
import { GraficoCaminhoes } from '@/components/relatorios/GraficoCaminhoes';

/** Imagem do relatório por setor: fundo claro, pensada para WhatsApp e impressão. */
const LARGURA = 1200;
const MARGEM = 48;
const AREA = LARGURA - MARGEM * 2;
const COR_TEXTO = '#14203a';
const COR_SUAVE = '#5b6b86';
const COR_GRADE = '#dfe6f1';
const COR_CARTAO = '#f3f6fb';
const COR_SEGMENTOS = ['#2d74c7', '#7fb3f0', '#e8b923', '#9aa8c2'];
// Arial/Helvetica: a imagem não carrega a Barlow, e a fonte padrão do navegador sai serifada.
const FONTE = 'Arial, Helvetica, sans-serif';
const MESES_LONGOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function formatarNumero(valor: number, casas: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/**
 * Relatório de um setor como SVG, na mesma linha do gerencial: destaques no topo, gráfico por mês (ou dia)
 * e tabela. A mesma imagem vai para a tela e para o PNG baixado.
 */
export function GraficoSetor({ r, id }: { r: RelatorioSetor; id: string }) {
  if (r.slug === 'caminhoes') return <GraficoCaminhoes r={r} id={id} />;
  const n = r.colunas.length;
  const empilhado = r.empilhar.length > 0;
  const cores = (idx: number) => {
    const pos = r.empilhar.indexOf(idx);
    return COR_SEGMENTOS[pos >= 0 ? pos % COR_SEGMENTOS.length : 0];
  };

  // Destaques: total do período, melhor mês/dia e a última coluna (ex.: perdas, toneladas).
  const principal = r.linhas.map((l) => l.valores[0] ?? 0);
  const maiorValor = Math.max(0, ...principal);
  const iMelhor = principal.indexOf(maiorValor);
  const melhorLinha = iMelhor >= 0 ? r.linhas[iMelhor] : null;
  const nomeMelhor = melhorLinha
    ? r.periodo.mes
      ? `Dia ${melhorLinha.rotulo.slice(0, 2)}`
      : MESES_LONGOS[Number(melhorLinha.chave) - 1]
    : '—';
  const media = r.linhas.length ? r.totais[0] / r.linhas.length : 0;
  const ultimo = n - 1;
  const unidadePorBalde = r.periodo.mes ? 'por dia' : 'por mês';

  const destaques = [
    { rotulo: `${r.colunas[0].rotulo} no período`, valor: formatarNumero(r.totais[0], r.colunas[0].casas), unidade: r.colunas[0].unidade, detalhe: `média de ${formatarNumero(media, r.colunas[0].casas)} ${unidadePorBalde}` },
    { rotulo: 'Melhor período', valor: nomeMelhor, unidade: '', detalhe: melhorLinha ? `${formatarNumero(maiorValor, r.colunas[0].casas)} ${r.colunas[0].unidade}` : 'sem produção' },
    ...(n > 1
      ? [{ rotulo: r.colunas[ultimo].rotulo, valor: formatarNumero(r.totais[ultimo], r.colunas[ultimo].casas), unidade: r.colunas[ultimo].unidade, detalhe: 'no período' }]
      : []),
  ];
  const larguraDestaque = (AREA - (destaques.length - 1) * 16) / destaques.length;

  // Gráfico
  const yDestaques = 130;
  const alturaDestaques = 104;
  const yGrafico = yDestaques + alturaDestaques + 56;
  const alturaBarras = 230;
  const yBase = yGrafico + alturaBarras;
  const bw = AREA / Math.max(1, r.linhas.length);
  const larguraBarra = bw * 0.58;
  const escala = (v: number) => (maiorValor > 0 ? (v / maiorValor) * alturaBarras : 0);

  // Tabela
  const yTabela = yBase + 70;
  const alturaLinha = 28;
  const larguraTotal = AREA - 200;
  const colTabela = larguraTotal / n;
  const xColuna = (c: number) => MARGEM + 200 + (c + 1) * colTabela - 14;
  const linhasTab = r.linhas.length;
  // Fim da última linha da tabela; o total fica logo abaixo dela, com a linha separadora entre os dois.
  const yFimTabela = yTabela + 40 + linhasTab * alturaLinha;
  const yRodape = yFimTabela + 24;
  const altura = yRodape + 40;

  return (
    <svg
      id={id}
      xmlns="http://www.w3.org/2000/svg"
      width={LARGURA}
      height={altura}
      viewBox={`0 0 ${LARGURA} ${altura}`}
      role="img"
      aria-label={`Relatório ${r.titulo}, ${r.periodo.rotulo}`}
      style={{ display: 'block', width: '100%', height: 'auto', fontFamily: FONTE }}
    >
      <rect x={0} y={0} width={LARGURA} height={altura} fill="#ffffff" />

      <text x={MARGEM} y={60} fontSize={36} fontWeight={700} fill={COR_TEXTO}>{r.titulo}</text>
      <text x={MARGEM} y={94} fontSize={20} fill={COR_SUAVE}>{r.periodo.rotulo}</text>

      {destaques.map((d, i) => {
        const x = MARGEM + i * (larguraDestaque + 16);
        return (
          <g key={d.rotulo + i}>
            <rect x={x} y={yDestaques} width={larguraDestaque} height={alturaDestaques} rx={12} fill={COR_CARTAO} />
            <text x={x + 20} y={yDestaques + 30} fontSize={14} fontWeight={600} fill={COR_SUAVE}>{d.rotulo.toUpperCase()}</text>
            <text x={x + 20} y={yDestaques + 72} fontSize={34} fontWeight={700} fill={COR_TEXTO}>
              {d.valor}
              {d.unidade && <tspan fontSize={18} fontWeight={400} fill={COR_SUAVE}> {d.unidade}</tspan>}
            </text>
            <text x={x + 20} y={yDestaques + 96} fontSize={14} fill={COR_SUAVE}>{d.detalhe}</text>
          </g>
        );
      })}

      <text x={MARGEM} y={yGrafico - 34} fontSize={20} fontWeight={600} fill={COR_TEXTO}>
        {r.colunas[0].rotulo} {unidadePorBalde}
      </text>
      {empilhado && (
        <g>
          {r.empilhar.map((idx, k) => (
            <g key={idx}>
              <rect x={MARGEM + k * 130} y={yGrafico - 26} width={14} height={14} rx={3} fill={cores(idx)} />
              <text x={MARGEM + k * 130 + 22} y={yGrafico - 14} fontSize={15} fill={COR_SUAVE}>{r.colunas[idx].rotulo}</text>
            </g>
          ))}
        </g>
      )}

      <line x1={MARGEM} x2={LARGURA - MARGEM} y1={yBase} y2={yBase} stroke={COR_GRADE} strokeWidth={2} />
      {r.linhas.map((l, i) => {
        const cx = MARGEM + i * bw + bw / 2;
        const total = principal[i];
        const topo = yBase - escala(total);
        const segmentos = empilhado
          ? r.empilhar.map((idx) => ({ idx, v: l.valores[idx] ?? 0 })).filter((s) => s.v > 0)
          : [];
        let acumulado = 0;
        return (
          <g key={l.chave}>
            {empilhado ? (
              segmentos.map((s) => {
                const h = escala(s.v);
                const y = yBase - escala(acumulado) - h;
                acumulado += s.v;
                return <rect key={s.idx} x={cx - larguraBarra / 2} y={y} width={larguraBarra} height={h} fill={cores(s.idx)} />;
              })
            ) : (
              <rect x={cx - larguraBarra / 2} y={topo} width={larguraBarra} height={Math.max(0, escala(total))} rx={4} fill={cores(0)} />
            )}
            {total > 0 && (
              <text x={cx} y={topo - 8} fontSize={14} fontWeight={600} textAnchor="middle" fill={COR_TEXTO}>
                {formatarNumero(total, r.colunas[0].casas)}
              </text>
            )}
            <text x={cx} y={yBase + 26} fontSize={14} textAnchor="middle" fill={COR_SUAVE}>{l.rotulo}</text>
          </g>
        );
      })}

      <rect x={MARGEM} y={yTabela} width={AREA} height={alturaLinha + 12} rx={8} fill={COR_CARTAO} />
      <text x={MARGEM + 16} y={yTabela + 21} fontSize={14} fontWeight={600} fill={COR_SUAVE}>{r.periodo.mes ? 'DIA' : 'MÊS'}</text>
      {r.colunas.map((col, c) => (
        <text key={col.rotulo + c} x={xColuna(c)} y={yTabela + 21} fontSize={14} fontWeight={600} textAnchor="end" fill={COR_SUAVE}>
          {col.rotulo}
        </text>
      ))}

      {r.linhas.map((l, i) => {
        const y = yTabela + 40 + i * alturaLinha + 18;
        return (
          <g key={l.chave}>
            <line x1={MARGEM} x2={LARGURA - MARGEM} y1={y + 9} y2={y + 9} stroke={COR_GRADE} strokeWidth={1} />
            <text x={MARGEM + 16} y={y} fontSize={16} fill={COR_TEXTO}>{l.rotulo}</text>
            {l.valores.map((v, c) => (
              <text key={c} x={xColuna(c)} y={y} fontSize={16} textAnchor="end" fill={COR_TEXTO}>
                {formatarNumero(v, r.colunas[c].casas)}
              </text>
            ))}
          </g>
        );
      })}

      <line x1={MARGEM} x2={LARGURA - MARGEM} y1={yFimTabela} y2={yFimTabela} stroke={COR_TEXTO} strokeWidth={1.5} />
      <text x={MARGEM + 16} y={yRodape} fontSize={16} fontWeight={700} fill={COR_TEXTO}>Total do período</text>
      {r.totais.map((v, c) => (
        <text key={c} x={xColuna(c)} y={yRodape} fontSize={16} fontWeight={700} textAnchor="end" fill={COR_TEXTO}>
          {formatarNumero(v, r.colunas[c].casas)}
        </text>
      ))}
    </svg>
  );
}
