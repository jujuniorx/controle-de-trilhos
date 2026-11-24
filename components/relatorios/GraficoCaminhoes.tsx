import type { RelatorioSetor } from '@/lib/services/relatorioSetor';

function formatarNumero(valor: number, casas: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/**
 * Relatório do setor caminhões de solda, como SVG, feito para ler bem numa foto no celular:
 * - destaques grandes no topo;
 * - um painel por caminhão, cada um com a própria escala, com a produção (azul) e as perdas (vermelho);
 * - um mapa de calor com a taxa de perda (perdas / produção do mês), com legenda;
 * - a tabela completa no fim, com o grupo de produção e o de perdas.
 * Colunas (ver lib/services/relatorioSetor.ts): 0 produção total, 1-3 produção por CW, 4-6 perdas por CW, 7 perdas total.
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
// Arial/Helvetica: a imagem não carrega a Barlow, e a fonte padrão do navegador sai serifada.
const FONTE = 'Arial, Helvetica, sans-serif';
const MESES_LONGOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const ROTULOS_PRODUCAO = ['Total', 'CW01', 'CW02', 'CW03'];
const ROTULOS_PERDA = ['CW01', 'CW02', 'CW03', 'Total'];

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
    { rotulo: 'Melhor período', valor: nomeMelhor, unidade: '', detalhe: `${formatarNumero(maiorMes, 0)} und` },
    { rotulo: 'Perdas no período', valor: formatarNumero(totalPerda, 0), unidade: 'und', detalhe: `${formatarNumero(pctPerda, 1)}% da produção` },
  ];
  const larguraCard = (AREA - 32) / 3;

  // Posições verticais
  const yTitulo = 70;
  const yPeriodo = 112;
  const yDestaques = 140;
  const alturaDestaques = 136;
  const yPaineisTitulo = yDestaques + alturaDestaques + 62;
  const yPaineis = yPaineisTitulo + 22;
  const alturaPainel = 316;
  const yBasePainel = yPaineis + 236;
  const alturaMaxBarra = 128;
  const yMapaTitulo = yPaineis + alturaPainel + 70;
  const yMesesMapa = yMapaTitulo + 40;
  const yMapa = yMesesMapa + 14;
  const alturaCelula = 50;
  const colunaRotulo = 110;
  const larguraCelula = (AREA - colunaRotulo) / Math.max(1, meses);
  const yLegenda = yMapa + CAMINHOES.length * alturaCelula + 26;
  const yTabela = yLegenda + 62;
  const yCabecalhoGrupo = yTabela;
  const yCabecalho = yTabela + 34;
  const yCorpo = yCabecalho + 44;
  const alturaLinha = 38;
  const colTabela = (AREA - 220) / 8;
  const xColuna = (c: number) => MARGEM + 220 + (c + 1) * colTabela - 14;
  const yFimTabela = yCorpo + meses * alturaLinha;
  const altura = yFimTabela + 90;

  // Legenda do mapa de calor: 0% até 25% ou mais
  const tonsLegenda = [0, 0.05, 0.1, 0.15, 0.2, 0.25];

  return (
    <svg
      id={id}
      xmlns="http://www.w3.org/2000/svg"
      width={LARGURA}
      height={altura}
      viewBox={`0 0 ${LARGURA} ${altura}`}
      role="img"
      aria-label={`Relatório ${r.titulo}, ${r.periodo.rotulo}`}
      fontFamily={FONTE}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <rect x={0} y={0} width={LARGURA} height={altura} fill="#ffffff" />

      <text x={MARGEM} y={yTitulo} fontSize={44} fontWeight={700} fill={COR_TEXTO}>{r.titulo}</text>
      <text x={MARGEM} y={yPeriodo} fontSize={26} fill={COR_SUAVE}>{r.periodo.rotulo.replace(/ \(até .*\)$/, '')}</text>

      {destaques.map((d, i) => {
        const x = MARGEM + i * (larguraCard + 16);
        return (
          <g key={d.rotulo}>
            <rect x={x} y={yDestaques} width={larguraCard} height={alturaDestaques} rx={14} fill={COR_CARTAO} />
            <text x={x + 22} y={yDestaques + 38} fontSize={17} fontWeight={700} fill={COR_SUAVE}>{d.rotulo.toUpperCase()}</text>
            <text x={x + 22} y={yDestaques + 96} fontSize={48} fontWeight={700} fill={COR_TEXTO}>
              {d.valor}
              {d.unidade && <tspan fontSize={24} fontWeight={400} fill={COR_SUAVE}> {d.unidade}</tspan>}
            </text>
            <text x={x + 22} y={yDestaques + 124} fontSize={19} fill={COR_SUAVE}>{d.detalhe}</text>
          </g>
        );
      })}

      <text x={MARGEM} y={yPaineisTitulo} fontSize={28} fontWeight={700} fill={COR_TEXTO}>Produção e perdas por caminhão</text>
      <rect x={MARGEM + 560} y={yPaineisTitulo - 19} width={18} height={18} rx={4} fill={COR_PRODUCAO} />
      <text x={MARGEM + 588} y={yPaineisTitulo - 3} fontSize={19} fill={COR_SUAVE}>Produção</text>
      <rect x={MARGEM + 700} y={yPaineisTitulo - 19} width={18} height={18} rx={4} fill={COR_PERDA} />
      <text x={MARGEM + 728} y={yPaineisTitulo - 3} fontSize={19} fill={COR_SUAVE}>Perdas</text>

      {CAMINHOES.map((cw, k) => {
        const x = MARGEM + k * (larguraCard + 16);
        const producaoCw = r.totais[1 + k] ?? 0;
        const perdaCw = r.totais[4 + k] ?? 0;
        // Escala própria de cada caminhão: as barras de CW01 e CW03 não somem perto do CW02.
        const maiorCw = Math.max(1, ...linhas.map((_, i) => producaoDe(i, k)));
        const largSlot = (larguraCard - 32) / Math.max(1, meses);
        const largBarra = Math.max(10, largSlot * 0.4);
        return (
          <g key={cw}>
            <rect x={x} y={yPaineis} width={larguraCard} height={alturaPainel} rx={14} fill={COR_CARTAO} />
            <text x={x + 20} y={yPaineis + 46} fontSize={34} fontWeight={700} fill={COR_TEXTO}>{cw}</text>
            <text x={x + 20} y={yPaineis + 76} fontSize={19} fill={COR_SUAVE}>
              {formatarNumero(producaoCw, 0)} und · perdas {formatarNumero(perdaCw, 0)}
            </text>
            <line x1={x + 16} x2={x + larguraCard - 16} y1={yBasePainel} y2={yBasePainel} stroke={COR_GRADE} strokeWidth={2} />
            {linhas.map((l, i) => {
              const cx = x + 16 + i * largSlot + largSlot / 2;
              const xBarraProd = cx - largBarra / 2 - 1;
              const xBarraPerda = cx + largBarra / 2 + 1;
              const prod = producaoDe(i, k);
              const perd = perdaDe(i, k);
              const hp = (prod / maiorCw) * alturaMaxBarra;
              const hl = (perd / maiorCw) * alturaMaxBarra;
              return (
                <g key={l.chave}>
                  <rect x={xBarraProd} y={yBasePainel - hp} width={largBarra} height={Math.max(0, hp)} rx={2} fill={COR_PRODUCAO} />
                  <rect x={xBarraPerda} y={yBasePainel - hl} width={largBarra} height={Math.max(0, hl)} rx={2} fill={COR_PERDA} />
                  {prod > 0 && (
                    <text x={xBarraProd + largBarra / 2} y={yBasePainel - hp - 6} fontSize={15} fontWeight={700} textAnchor="middle" fill={COR_TEXTO}>
                      {formatarNumero(prod, 0)}
                    </text>
                  )}
                  {(mensal || i % 5 === 0) && (
                    <text x={cx} y={yBasePainel + 26} fontSize={16} textAnchor="middle" fill={COR_SUAVE}>{nomeCurto(l)}</text>
                  )}
                  {(mensal || i % 5 === 0) && (
                    <text x={cx} y={yBasePainel + 54} fontSize={16} fontWeight={700} textAnchor="middle" fill={perd > 0 ? COR_PERDA : COR_SUAVE}>
                      {formatarNumero(perd, 0)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
      <text x={MARGEM} y={yPaineis + alturaPainel + 30} fontSize={17} fill={COR_SUAVE}>
        Cada caminhão tem sua própria escala. Embaixo de cada mês, o número de perdas em vermelho.
      </text>

      <text x={MARGEM} y={yMapaTitulo} fontSize={28} fontWeight={700} fill={COR_TEXTO}>Taxa de perda por mês</text>
      {linhas.map((l, i) => (
        <text key={l.chave} x={MARGEM + colunaRotulo + i * larguraCelula + larguraCelula / 2} y={yMesesMapa} fontSize={17} fontWeight={600} textAnchor="middle" fill={COR_SUAVE}>
          {nomeCurto(l)}
        </text>
      ))}
      {CAMINHOES.map((cw, k) => (
        <g key={cw}>
          <text x={MARGEM} y={yMapa + k * alturaCelula + alturaCelula / 2 + 7} fontSize={21} fontWeight={700} fill={COR_TEXTO}>{cw}</text>
          {linhas.map((l, i) => {
            const t = taxa(producaoDe(i, k), perdaDe(i, k));
            const x = MARGEM + colunaRotulo + i * larguraCelula;
            const y = yMapa + k * alturaCelula;
            const cor = t === null ? '#eef1f6' : corTaxa(t);
            const escuro = t !== null && t >= 0.14;
            return (
              <g key={l.chave}>
                <rect x={x + 2} y={y + 3} width={larguraCelula - 4} height={alturaCelula - 6} rx={7} fill={cor} />
                <text
                  x={x + larguraCelula / 2}
                  y={y + alturaCelula / 2 + 6}
                  fontSize={18}
                  fontWeight={700}
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

      {/* Legenda de cor do mapa */}
      <text x={MARGEM} y={yLegenda + 18} fontSize={17} fill={COR_SUAVE}>Cor:</text>
      {tonsLegenda.map((t, i) => (
        <g key={t}>
          <rect x={MARGEM + 70 + i * 62} y={yLegenda} width={60} height={22} rx={4} fill={corTaxa(t)} />
          <text x={MARGEM + 70 + i * 62 + 30} y={yLegenda + 40} fontSize={15} textAnchor="middle" fill={COR_SUAVE}>
            {i === tonsLegenda.length - 1 ? '25%+' : `${Math.round(t * 100)}%`}
          </text>
        </g>
      ))}
      <text x={MARGEM + 70 + tonsLegenda.length * 62 + 16} y={yLegenda + 17} fontSize={17} fill={COR_SUAVE}>
        quanto mais vermelho, pior a taxa
      </text>

      {/* Tabela: grupos acima das colunas */}
      <rect x={MARGEM} y={yCabecalhoGrupo} width={AREA} height={30} rx={8} fill={COR_CARTAO} />
      <text x={MARGEM + 220 + (4 * colTabela) / 2 - 14} y={yCabecalhoGrupo + 21} fontSize={18} fontWeight={700} textAnchor="middle" fill={COR_TEXTO}>Produção</text>
      <text x={MARGEM + 220 + (4 * colTabela) + (4 * colTabela) / 2 - 14} y={yCabecalhoGrupo + 21} fontSize={18} fontWeight={700} textAnchor="middle" fill={COR_PERDA}>Perdas</text>

      <rect x={MARGEM} y={yCabecalho} width={AREA} height={36} fill="#ffffff" />
      <text x={MARGEM + 16} y={yCabecalho + 25} fontSize={17} fontWeight={700} fill={COR_SUAVE}>{mensal ? 'MÊS' : 'DIA'}</text>
      {[...ROTULOS_PRODUCAO, ...ROTULOS_PERDA].map((rotulo, c) => (
        <text key={c} x={xColuna(c)} y={yCabecalho + 25} fontSize={17} fontWeight={700} textAnchor="end" fill={c >= 4 ? COR_PERDA : COR_SUAVE}>
          {rotulo}
        </text>
      ))}

      {linhas.map((l, i) => {
        const y = yCorpo + i * alturaLinha;
        return (
          <g key={l.chave}>
            {i % 2 === 1 && <rect x={MARGEM} y={y} width={AREA} height={alturaLinha} fill={COR_CARTAO} />}
            <text x={MARGEM + 16} y={y + 26} fontSize={21} fill={COR_TEXTO}>{nomeCompleto(l)}</text>
            {l.valores.map((v, c) => (
              <text key={c} x={xColuna(c)} y={y + 26} fontSize={21} textAnchor="end" fill={c >= 4 ? COR_PERDA : COR_TEXTO}>
                {formatarNumero(v, r.colunas[c].casas)}
              </text>
            ))}
          </g>
        );
      })}

      <line x1={MARGEM} x2={LARGURA - MARGEM} y1={yFimTabela + 4} y2={yFimTabela + 4} stroke={COR_TEXTO} strokeWidth={2} />
      <text x={MARGEM + 16} y={yFimTabela + 40} fontSize={21} fontWeight={700} fill={COR_TEXTO}>Total do período</text>
      {r.totais.map((v, c) => (
        <text key={c} x={xColuna(c)} y={yFimTabela + 40} fontSize={21} fontWeight={700} textAnchor="end" fill={c >= 4 ? COR_PERDA : COR_TEXTO}>
          {formatarNumero(v, r.colunas[c].casas)}
        </text>
      ))}
    </svg>
  );
}
