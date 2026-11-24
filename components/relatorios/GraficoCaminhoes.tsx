import type { RelatorioSetor } from '@/lib/services/relatorioSetor';

function formatarNumero(valor: number, casas: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/**
 * Relatório do setor caminhões de solda, como SVG:
 * - um painel por caminhão, com a produção (azul) e as perdas (vermelho) de cada mês, na mesma escala;
 * - um mapa de calor com a taxa de perda (perdas / produção do mês), caminhão por mês;
 * - a tabela completa no fim.
 * Layout das colunas (ver lib/services/relatorioSetor.ts): 0 produção total, 1-3 produção por CW,
 * 4-6 perdas por CW, 7 perdas total.
 */
const LARGURA = 1200;
const MARGEM = 48;
const AREA = LARGURA - MARGEM * 2;
const CAMINHOES = ['CW01', 'CW02', 'CW03'];
const COR_TEXTO = '#14203a';
const COR_SUAVE = '#5b6b86';
const COR_GRADE = '#dfe6f1';
const COR_CARTAO = '#f3f6fb';
const COR_PRODUCAO = '#2d74c7';
const COR_PERDA = '#d64541';
const FONTE = 'Barlow, Arial, sans-serif';
const MESES_LONGOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Mistura o branco com o vermelho conforme a taxa; 25% ou mais fica no vermelho cheio. */
function corTaxa(taxa: number): string {
  const t = Math.min(taxa / 0.25, 1);
  const a = [243, 246, 251];
  const b = [214, 69, 65];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function taxa(producao: number, perda: number): number | null {
  return producao > 0 ? perda / producao : null;
}

export function GraficoCaminhoes({ r, id }: { r: RelatorioSetor; id: string }) {
  const linhas = r.linhas;
  const meses = linhas.length;
  const mensal = !r.periodo.mes;
  // Nas linhas de um mês escolhido, cada linha é um dia: o rótulo é o número do dia.
  const nomeCompleto = (l: (typeof linhas)[number]) => (mensal ? MESES_LONGOS[Number(l.chave) - 1] : l.rotulo);
  const nomeCurto = (l: (typeof linhas)[number]) => (mensal ? l.rotulo.slice(0, 3) : l.chave);
  const producaoDe = (i: number, k: number) => linhas[i].valores[1 + k] ?? 0;
  const perdaDe = (i: number, k: number) => linhas[i].valores[4 + k] ?? 0;
  const producaoTotal = (i: number) => linhas[i].valores[0] ?? 0;

  // Destaques
  const totalProducao = r.totais[0];
  const media = meses ? totalProducao / meses : 0;
  const maiorMes = Math.max(0, ...linhas.map((_, i) => producaoTotal(i)));
  const iMelhor = linhas.findIndex((_, i) => producaoTotal(i) === maiorMes);
  const nomeMelhor = iMelhor >= 0 ? nomeCompleto(linhas[iMelhor]) : '—';
  const totalPerda = r.totais[7];
  const pctPerda = totalProducao > 0 ? (totalPerda / totalProducao) * 100 : 0;
  const destaques = [
    { rotulo: 'Produção no período', valor: formatarNumero(totalProducao, 0), unidade: 'und', detalhe: `média de ${formatarNumero(media, 0)} por ${mensal ? 'mês' : 'dia'}` },
    { rotulo: 'Melhor mês', valor: nomeMelhor, unidade: '', detalhe: `${formatarNumero(maiorMes, 0)} und` },
    { rotulo: 'Perdas no período', valor: formatarNumero(totalPerda, 0), unidade: 'und', detalhe: `${formatarNumero(pctPerda, 1)}% da produção` },
  ];
  const larguraCard = (AREA - 32) / 3;

  // Escala única para os três painéis: a mesma altura vale o mesmo número em todos.
  const maiorProducaoMes = Math.max(1, ...linhas.flatMap((_, i) => CAMINHOES.map((__, k) => producaoDe(i, k))));

  // Posições verticais
  const yDestaques = 130;
  const alturaDestaques = 104;
  const yPaineisTitulo = yDestaques + alturaDestaques + 42;
  const yPaineis = yPaineisTitulo + 18;
  const alturaPainel = 236;
  const alturaBarrasPainel = 124;
  const yMapaTitulo = yPaineis + alturaPainel + 44;
  const yMapa = yMapaTitulo + 22;
  const alturaCelula = 40;
  const colunaRotulo = 110;
  const larguraCelula = (AREA - colunaRotulo) / Math.max(1, meses);
  const yTabela = yMapa + 40 + CAMINHOES.length * alturaCelula + 36;
  const alturaLinha = 28;
  const colTabela = (AREA - 200) / r.colunas.length;
  const xColuna = (c: number) => MARGEM + 200 + (c + 1) * colTabela - 14;
  const yFimTabela = yTabela + 40 + meses * alturaLinha;
  const altura = yFimTabela + 24 + 40 + 40;

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
        const x = MARGEM + i * (larguraCard + 16);
        return (
          <g key={d.rotulo}>
            <rect x={x} y={yDestaques} width={larguraCard} height={alturaDestaques} rx={12} fill={COR_CARTAO} />
            <text x={x + 20} y={yDestaques + 30} fontSize={14} fontWeight={600} fill={COR_SUAVE}>{d.rotulo.toUpperCase()}</text>
            <text x={x + 20} y={yDestaques + 72} fontSize={34} fontWeight={700} fill={COR_TEXTO}>
              {d.valor}
              {d.unidade && <tspan fontSize={18} fontWeight={400} fill={COR_SUAVE}> {d.unidade}</tspan>}
            </text>
            <text x={x + 20} y={yDestaques + 96} fontSize={14} fill={COR_SUAVE}>{d.detalhe}</text>
          </g>
        );
      })}

      <text x={MARGEM} y={yPaineisTitulo} fontSize={20} fontWeight={600} fill={COR_TEXTO}>Produção e perdas por caminhão</text>
      <g>
        <rect x={MARGEM + 420} y={yPaineisTitulo - 14} width={14} height={14} rx={3} fill={COR_PRODUCAO} />
        <text x={MARGEM + 442} y={yPaineisTitulo - 2} fontSize={15} fill={COR_SUAVE}>Produção</text>
        <rect x={MARGEM + 530} y={yPaineisTitulo - 14} width={14} height={14} rx={3} fill={COR_PERDA} />
        <text x={MARGEM + 552} y={yPaineisTitulo - 2} fontSize={15} fill={COR_SUAVE}>Perdas</text>
      </g>

      {CAMINHOES.map((cw, k) => {
        const x = MARGEM + k * (larguraCard + 16);
        const producaoCw = r.totais[1 + k] ?? 0;
        const perdaCw = r.totais[4 + k] ?? 0;
        const yBase = yPaineis + alturaBarrasPainel + 36;
        const largSlot = (larguraCard - 32) / Math.max(1, meses);
        const largBarra = Math.max(4, largSlot * 0.36);
        return (
          <g key={cw}>
            <rect x={x} y={yPaineis} width={larguraCard} height={alturaPainel} rx={12} fill={COR_CARTAO} />
            <text x={x + 18} y={yPaineis + 34} fontSize={22} fontWeight={700} fill={COR_TEXTO}>{cw}</text>
            <text x={x + 18} y={yPaineis + 56} fontSize={14} fill={COR_SUAVE}>
              {formatarNumero(producaoCw, 0)} und · perdas {formatarNumero(perdaCw, 0)}
            </text>
            <line x1={x + 16} x2={x + larguraCard - 16} y1={yBase} y2={yBase} stroke={COR_GRADE} strokeWidth={1.5} />
            {linhas.map((l, i) => {
              const cx = x + 16 + i * largSlot + largSlot / 2;
              const hp = (producaoDe(i, k) / maiorProducaoMes) * alturaBarrasPainel;
              const hl = (perdaDe(i, k) / maiorProducaoMes) * alturaBarrasPainel;
              return (
                <g key={l.chave}>
                  <rect x={cx - largBarra - 1} y={yBase - hp} width={largBarra} height={Math.max(0, hp)} rx={2} fill={COR_PRODUCAO} />
                  <rect x={cx + 1} y={yBase - hl} width={largBarra} height={Math.max(0, hl)} rx={2} fill={COR_PERDA} />
                  {(mensal || i % 5 === 0) && (
                    <text x={cx} y={yBase + 16} fontSize={11} textAnchor="middle" fill={COR_SUAVE}>{nomeCurto(l)}</text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      <text x={MARGEM} y={yMapaTitulo} fontSize={20} fontWeight={600} fill={COR_TEXTO}>Taxa de perda por mês</text>
      <text x={MARGEM + 300} y={yMapaTitulo} fontSize={15} fill={COR_SUAVE}>perdas dividido pela produção do mês · vermelho mais forte = pior</text>
      {linhas.map((l, i) => (
        <text key={l.chave} x={MARGEM + colunaRotulo + i * larguraCelula + larguraCelula / 2} y={yMapa - 8} fontSize={13} textAnchor="middle" fill={COR_SUAVE}>
          {nomeCurto(l)}
        </text>
      ))}
      {CAMINHOES.map((cw, k) => (
        <g key={cw}>
          <text x={MARGEM} y={yMapa + k * alturaCelula + alturaCelula / 2 + 6} fontSize={16} fontWeight={600} fill={COR_TEXTO}>{cw}</text>
          {linhas.map((l, i) => {
            const t = taxa(producaoDe(i, k), perdaDe(i, k));
            const x = MARGEM + colunaRotulo + i * larguraCelula;
            const y = yMapa + k * alturaCelula;
            const cor = t === null ? '#eef1f6' : corTaxa(t);
            const escuro = t !== null && t >= 0.14;
            return (
              <g key={l.chave}>
                <rect x={x + 2} y={y + 2} width={larguraCelula - 4} height={alturaCelula - 4} rx={6} fill={cor} />
                <text
                  x={x + larguraCelula / 2}
                  y={y + alturaCelula / 2 + 5}
                  fontSize={13}
                  fontWeight={600}
                  textAnchor="middle"
                  fill={escuro ? '#ffffff' : COR_TEXTO}
                >
                  {t === null ? '—' : `${formatarNumero(Math.round(t * 100), 0)}%`}
                </text>
              </g>
            );
          })}
        </g>
      ))}

      <rect x={MARGEM} y={yTabela} width={AREA} height={52} rx={8} fill={COR_CARTAO} />
      <text x={MARGEM + 16} y={yTabela + 21} fontSize={14} fontWeight={600} fill={COR_SUAVE}>{mensal ? 'MÊS' : 'DIA'}</text>
      {r.colunas.map((col, c) => (
        <text key={col.rotulo + c} x={xColuna(c)} y={yTabela + 21} fontSize={13} fontWeight={600} textAnchor="end" fill={COR_SUAVE}>
          {col.rotulo}
        </text>
      ))}

      {linhas.map((l, i) => {
        const y = yTabela + 40 + i * alturaLinha + 18;
        return (
          <g key={l.chave}>
            <line x1={MARGEM} x2={LARGURA - MARGEM} y1={y + 9} y2={y + 9} stroke={COR_GRADE} strokeWidth={1} />
            <text x={MARGEM + 16} y={y} fontSize={16} fill={COR_TEXTO}>{nomeCompleto(l)}</text>
            {l.valores.map((v, c) => (
              <text key={c} x={xColuna(c)} y={y} fontSize={16} textAnchor="end" fill={c >= 4 ? COR_PERDA : COR_TEXTO}>
                {formatarNumero(v, r.colunas[c].casas)}
              </text>
            ))}
          </g>
        );
      })}

      <line x1={MARGEM} x2={LARGURA - MARGEM} y1={yFimTabela} y2={yFimTabela} stroke={COR_TEXTO} strokeWidth={1.5} />
      <text x={MARGEM + 16} y={yFimTabela + 24} fontSize={16} fontWeight={700} fill={COR_TEXTO}>Total do período</text>
      {r.totais.map((v, c) => (
        <text key={c} x={xColuna(c)} y={yFimTabela + 24} fontSize={16} fontWeight={700} textAnchor="end" fill={c >= 4 ? COR_PERDA : COR_TEXTO}>
          {formatarNumero(v, r.colunas[c].casas)}
        </text>
      ))}
    </svg>
  );
}
