import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { informativoDoAno, META_RECOLHIMENTO_M, METROS_POR_BARRA } from '@/lib/services/informativo';
import { montarGrafico, parseSeries, rotuloFiltro, UNIDADES, type Unidade } from '@/lib/services/informativoGrafico';
import { gerarInformativoPdf, type TemaPdf } from '@/lib/pdf/informativo';
import { fmtMetros } from '@/lib/format';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Baixa o gráfico do informativo em PDF (tema claro, para impressão), com a série e a unidade escolhidas. */
export async function GET(request: NextRequest) {
  await requireAdmin();
  const params = request.nextUrl.searchParams;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(params.get('dia') ?? '') ? params.get('dia')! : hojeSP();
  const chaves = parseSeries(params.get('s'));
  const unidade = (UNIDADES as readonly string[]).includes(params.get('unidade') ?? '') ? (params.get('unidade') as Unidade) : 'barras';
  // Sempre tema claro: o PDF é para imprimir, e o fundo escuro gasta muita tinta.
  const tema = 'claro' as const satisfies TemaPdf;

  const cor = '#111827'; // texto escuro, para o papel
  const ano = Number(dia.slice(0, 4));
  const r = await informativoDoAno(ano, dia);
  const barras = (m: number) => Math.round(m / METROS_POR_BARRA).toLocaleString('pt-BR');
  const pendente = Math.max(META_RECOLHIMENTO_M - r.acumAno.w61 - r.acumAno.w62, 0);

  const grafico = montarGrafico(r.meses, chaves, unidade);
  const pdf = gerarInformativoPdf({
    ano,
    unidade,
    series: grafico.series,
    meses: grafico.indices.map((i) => MESES[i]),
    filtro: rotuloFiltro(chaves),
    tema,
    emitidoEm: new Date(),
    cartoes: [
      { rotulo: 'Meta de recolhimento', valor: `${fmtMetros(META_RECOLHIMENTO_M)} m`, cor },
      { rotulo: 'Chegou na usina', valor: `${fmtMetros(r.acumAno.recebido)} m`, cor: '#4a6cd4' },
      { rotulo: 'Recolhido W61', valor: `${barras(r.acumAno.w61)} barras`, detalhe: `${fmtMetros(r.acumAno.w61)} m`, cor: '#e8a33d' },
      { rotulo: 'Recolhido W62', valor: `${barras(r.acumAno.w62)} barras`, detalhe: `${fmtMetros(r.acumAno.w62)} m`, cor: '#16a34a' },
      { rotulo: 'Pendente (sobra)', valor: `${fmtMetros(pendente)} m`, cor: '#f59e0b' },
    ],
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="trilhos-${ano}-${chaves.join("-")}-${unidade}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
