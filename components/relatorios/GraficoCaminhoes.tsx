import type { RelatorioSetor } from '@/lib/services/relatorioSetor';

function formatarNumero(valor: number, casas: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/**
 * Relatório do setor caminhões de solda, como SVG, feito para ler bem numa foto no celular:
 * - destaques grandes no topo, somando só CW01 e CW02 (o CW03 fica numa linha à parte);
 * - um gráfico mensal com as soldas (azul) e as perdas (vermelho, em cima da barra);
 * - um mapa de calor com a taxa de perda por caminhão, com legenda;
 * - a curva S do ano (produção acumulada contra meta acumulada), sem perdas;
 * - observações do período.
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
const COR_META = '#f5b800';
const COR_REAL = '#17a77c';
const COR_OBS = '#2d9be0';
// Arial/Helvetica: a imagem não carrega a Barlow, e a fonte padrão do navegador sai serifada.
const FONTE = 'Arial, Helvetica, sans-serif';
const MESES_LONGOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Meta do ano (CW01 + CW02), informada pela diretoria.
const META_FIM_ANO = 518;
// Peso de cada mês na meta, vindo da coluna Meta das planilhas (520 por caminhão no ano). Só define o formato da curva.
const META_PESO_MES = [48, 40, 42, 44, 44, 40, 44, 42, 42, 47, 42, 45];
// Período em que o CW02 ficou em FMT (sem produção). Os dias do período ficam em cinza na curva.
const FMT_INICIO = [3, 26] as const;
const FMT_FIM = [8, 17] as const;
const OBSERVACOES_FIXAS = [
  'CW02 sem produção em abril, maio, junho e julho, por estar em FMT (26/03 a 17/08).',
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
  const ano = r.periodo.ano;
  // Nas linhas de um mês escolhido, cada linha é um dia: o rótulo é o número do dia.
  const nomeCompleto = (l: (typeof linhas)[number]) => (mensal ? MESES_LONGOS[Number(l.chave) - 1] : l.rotulo);
  const nomeCurto = (l: (typeof linhas)[number]) => (mensal ? l.rotulo.slice(0, 3) : l.chave);
  const producaoDe = (i: number, k: number) => linhas[i].valores[1 + k] ?? 0;
  const perdaDe = (i: number, k: number) => linhas[i].valores[4 + k] ?? 0;
  // Os destaques e os gráficos somam só CW01 e CW02; o CW03 aparece à parte, embaixo.
  const producaoTotal = (i: number) => (linhas[i].valores[1] ?? 0) + (linhas[i].valores[2] ?? 0);
  const perdaTotal = (i: number) => (linhas[i].valores[4] ?? 0) + (linhas[i].valores[5] ?? 0);
  const producaoCw03 = r.totais[3] ?? 0;

  // Destaques
  const totalProducao = (r.totais[1] ?? 0) + (r.totais[2] ?? 0);
  const media = meses ? totalProducao / meses : 0;
  const maiorMes = Math.max(0, ...linhas.map((_, i) => producaoTotal(i)));
  const iMelhor = linhas.findIndex((_, i) => producaoTotal(i) === maiorMes);
  const nomeMelhor = iMelhor >= 0 ? nomeCompleto(linhas[iMelhor]) : '—';
  const totalPerda = (r.totais[4] ?? 0) + (r.totais[5] ?? 0);
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
  const yGrafico = yPaineisTitulo + 22;
  const alturaGrafico = 320;
  const yBaseGrafico = yGrafico + 270;
  const alturaMaxBarra = 200;
  const yMapaTitulo = yGrafico + alturaGrafico + 56;
  const yMesesMapa = yMapaTitulo + 40;
  const yMapa = yMesesMapa + 14;
  const alturaCelula = 50;
  const colunaRotulo = 110;
  const larguraCelula = (AREA - colunaRotulo) / Math.max(1, meses);
  const yLegenda = yMapa + CAMINHOES.length * alturaCelula + 26;

  // Curva S (só no relatório do ano)
  const yCurvaTitulo = yLegenda + 100;
  const yCurva = yCurvaTitulo + 20;
  const alturaCurva = 300;
  const yBaseCurva = yCurva + 60 + alturaCurva;
  const xCurva0 = MARGEM + 90;
  const xCurva1 = LARGURA - MARGEM - 30;
  const larguraCurva = xCurva1 - xCurva0;
  const diasAno = (Date.UTC(ano + 1, 0, 1) - Date.UTC(ano, 0, 1)) / 86400000;
  const diaDoAno = (mes: number, dia: number) => (Date.UTC(ano, mes - 1, dia) - Date.UTC(ano, 0, 1)) / 86400000 + 1;
  const fimDoMes = (mes: number) => diaDoAno(mes, new Date(Date.UTC(ano, mes, 0)).getUTCDate());
  const xDia = (dia: number) => xCurva0 + (dia / diasAno) * larguraCurva;
  const yValor = (v: number) => yBaseCurva - (v / META_FIM_ANO) * alturaCurva;

  // Pontos da curva: produção acumulada até o último mês com lançamento; meta acumulada o ano todo.
  let acumReal = 0;
  const pontosReal = mensal
    ? linhas.map((l, i) => {
        acumReal += producaoTotal(i);
        const mes = Number(l.chave);
        return { x: xDia(fimDoMes(mes)), y: yValor(acumReal), valor: acumReal };
      })
    : [];
  const pesoTotal = META_PESO_MES.reduce((t, v) => t + v, 0);
  let acumPeso = 0;
  const pontosMeta = META_PESO_MES.map((peso, i) => {
    acumPeso += peso;
    const valor = (META_FIM_ANO * acumPeso) / pesoTotal;
    return { x: xDia(fimDoMes(i + 1)), y: yValor(valor), valor };
  });
  const caminho = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const ultimoReal = pontosReal.length ? pontosReal[pontosReal.length - 1] : null;
  const alturaObs = 40 + OBSERVACOES_FIXAS.length * 30 + 30;
  const yObs = yBaseCurva + 110;

  // Escala única do gráfico mensal: a barra mais alta (soldas + perdas) ocupa a altura máxima.
  const maiorBarra = Math.max(1, ...linhas.map((_, i) => producaoTotal(i) + perdaTotal(i)));
  const largSlot = (AREA - 32) / Math.max(1, meses);
  const largBarra = Math.min(70, Math.max(14, largSlot * 0.56));

  // Legenda do mapa de calor: 0% até 25% ou mais
  const tonsLegenda = [0, 0.05, 0.1, 0.15, 0.2, 0.25];

  const altura = mensal ? yObs + alturaObs + 40 : yLegenda + 90;

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

      <text x={MARGEM} y={yDestaques + alturaDestaques + 30} fontSize={19} fill={COR_SUAVE}>
        (CW03 fora do total acima: {formatarNumero(producaoCw03, 0)} und no período)
      </text>

      <text x={MARGEM} y={yPaineisTitulo} fontSize={28} fontWeight={700} fill={COR_TEXTO}>Soldas e perdas por mês</text>
      <rect x={MARGEM + 470} y={yPaineisTitulo - 19} width={18} height={18} rx={4} fill={COR_PRODUCAO} />
      <text x={MARGEM + 498} y={yPaineisTitulo - 3} fontSize={19} fill={COR_SUAVE}>Soldas</text>
      <rect x={MARGEM + 600} y={yPaineisTitulo - 19} width={18} height={18} rx={4} fill={COR_PERDA} />
      <text x={MARGEM + 628} y={yPaineisTitulo - 3} fontSize={19} fill={COR_SUAVE}>Perdas</text>

      <rect x={MARGEM} y={yGrafico} width={AREA} height={alturaGrafico} rx={14} fill={COR_CARTAO} />
      <line x1={MARGEM + 16} x2={LARGURA - MARGEM - 16} y1={yBaseGrafico} y2={yBaseGrafico} stroke={COR_GRADE} strokeWidth={2} />
      {linhas.map((l, i) => {
        const s = producaoTotal(i);
        const p = perdaTotal(i);
        const cx = MARGEM + 16 + i * largSlot + largSlot / 2;
        const hs = (s / maiorBarra) * alturaMaxBarra;
        const hp = (p / maiorBarra) * alturaMaxBarra;
        const topoSoldas = yBaseGrafico - hs;
        return (
          <g key={l.chave}>
            <rect x={cx - largBarra / 2} y={topoSoldas} width={largBarra} height={Math.max(0, hs)} rx={3} fill={COR_PRODUCAO} />
            <rect x={cx - largBarra / 2} y={topoSoldas - hp} width={largBarra} height={Math.max(0, hp)} rx={3} fill={COR_PERDA} />
            {s > 0 && hs >= 26 && (
              <text x={cx} y={topoSoldas + hs / 2 + 6} fontSize={17} fontWeight={700} textAnchor="middle" fill="#ffffff">
                {formatarNumero(s, 0)}
              </text>
            )}
            {s > 0 && hs < 26 && (
              <text x={cx} y={topoSoldas - 6} fontSize={16} fontWeight={700} textAnchor="middle" fill={COR_TEXTO}>
                {formatarNumero(s, 0)}
              </text>
            )}
            {p > 0 && (
              <text x={cx} y={topoSoldas - hp - 6} fontSize={17} fontWeight={700} textAnchor="middle" fill={COR_PERDA}>
                {formatarNumero(p, 0)}
              </text>
            )}
            {(mensal || i % 5 === 0) && (
              <text x={cx} y={yBaseGrafico + 28} fontSize={17} textAnchor="middle" fill={COR_SUAVE}>{nomeCurto(l)}</text>
            )}
          </g>
        );
      })}

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

      {mensal && (
        <g>
          <text x={MARGEM} y={yCurvaTitulo} fontSize={28} fontWeight={700} fill={COR_TEXTO}>Curva S: produção acumulada</text>
          <text x={MARGEM} y={yCurvaTitulo + 36} fontSize={21} fill={COR_SUAVE}>
            Meta até o fim do ano: {formatarNumero(META_FIM_ANO, 0)} und · Real acumulado: {formatarNumero(ultimoReal?.valor ?? 0, 0)} und
          </text>

          <rect x={MARGEM} y={yCurva} width={AREA} height={alturaCurva + 130} rx={14} fill={COR_CARTAO} />

          {[0, 100, 200, 300, 400, 500].map((v) => (
            <g key={v}>
              <line x1={xCurva0} x2={xCurva1} y1={yValor(v)} y2={yValor(v)} stroke={COR_GRADE} strokeWidth={1.5} />
              <text x={xCurva0 - 12} y={yValor(v) + 6} fontSize={16} textAnchor="end" fill={COR_SUAVE}>{v}</text>
            </g>
          ))}
          <rect
            x={xDia(diaDoAno(FMT_INICIO[0], FMT_INICIO[1]))}
            y={yValor(META_FIM_ANO)}
            width={xDia(diaDoAno(FMT_FIM[0], FMT_FIM[1])) - xDia(diaDoAno(FMT_INICIO[0], FMT_INICIO[1]))}
            height={alturaCurva}
            fill="#e3e8f1"
          />
          <text
            x={(xDia(diaDoAno(FMT_INICIO[0], FMT_INICIO[1])) + xDia(diaDoAno(FMT_FIM[0], FMT_FIM[1]))) / 2}
            y={yValor(META_FIM_ANO) + 26}
            fontSize={16}
            textAnchor="middle"
            fill={COR_SUAVE}
          >
            CW02 em FMT
          </text>

          {MESES_CURTOS.map((nome, i) => (
            <text key={nome} x={xDia(diaDoAno(i + 1, 1))} y={yBaseCurva + 26} fontSize={16} fill={COR_SUAVE}>{nome}</text>
          ))}

          <path d={caminho(pontosMeta)} fill="none" stroke={COR_META} strokeWidth={4} />
          {pontosReal.length > 0 && <path d={caminho(pontosReal)} fill="none" stroke={COR_REAL} strokeWidth={4} />}

          {ultimoReal && (
            <g>
              <rect x={ultimoReal.x - 38} y={ultimoReal.y - 46} width={76} height={32} rx={6} fill={COR_REAL} />
              <text x={ultimoReal.x} y={ultimoReal.y - 24} fontSize={19} fontWeight={700} textAnchor="middle" fill="#ffffff">
                {formatarNumero(ultimoReal.valor, 0)}
              </text>
            </g>
          )}

          <rect x={MARGEM + 300} y={yBaseCurva + 50} width={18} height={18} rx={4} fill={COR_REAL} />
          <text x={MARGEM + 328} y={yBaseCurva + 66} fontSize={19} fill={COR_SUAVE}>Produção acumulada</text>
          <rect x={MARGEM + 580} y={yBaseCurva + 50} width={18} height={18} rx={4} fill={COR_META} />
          <text x={MARGEM + 608} y={yBaseCurva + 66} fontSize={19} fill={COR_SUAVE}>Meta acumulada</text>

          <rect x={MARGEM} y={yObs} width={AREA} height={alturaObs} rx={10} fill={COR_OBS} />
          <text x={MARGEM + 24} y={yObs + 40} fontSize={22} fontWeight={700} fill="#ffffff">Observações:</text>
          {OBSERVACOES_FIXAS.map((texto, i) => (
            <text key={texto} x={MARGEM + 24} y={yObs + 74 + i * 30} fontSize={20} fill="#ffffff">• {texto}</text>
          ))}
        </g>
      )}
    </svg>
  );
}
