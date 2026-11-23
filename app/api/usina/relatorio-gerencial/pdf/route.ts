import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { montarDadosRelatorio, montarTrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { gerarOnePageUsinaSvg } from '@/lib/pdf/onePageUsina';
import { colunasValidas, desdeValido, ehIsoValido, modoValido } from '@/lib/usina/periodo';

function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Relatório da usina como imagem SVG (sem PDF). `pagina` = capa | dados | caminhao. */
export async function GET(request: NextRequest) {
  await requireAdmin();
  const pedido = request.nextUrl.searchParams.get('data') ?? undefined;
  const data = ehIsoValido(pedido) ? pedido : hojeSP();
  const modo = modoValido(request.nextUrl.searchParams.get('modo') ?? undefined);
  // Vários dias (ex.: sexta a domingo) só no diário.
  const desde = modo === 'diario' ? desdeValido(request.nextUrl.searchParams.get('desde'), data) : data;
  const [dados, tril] = await Promise.all([montarDadosRelatorio(data, desde), montarTrilheirosRelatorio(data, desde)]);
  const colunas = colunasValidas(request.nextUrl.searchParams.getAll('col'));
  const paginaPedida = request.nextUrl.searchParams.get('pagina');
  const pagina = paginaPedida === 'capa' || paginaPedida === 'caminhao' || paginaPedida === 'tudo' ? paginaPedida : 'dados';
  const svg =
    modo === 'diario'
      ? gerarOnePageUsinaSvg(dados, tril, 'diario', colunas, [], pagina)
      : gerarOnePageUsinaSvg(dados, tril, modo === 'mensal' ? 'mensal' : 'semanal', colunas, [], pagina);
  const sufixo = desde < data ? `${desde}-a-${data}` : data;
  const nome = pagina === 'dados' ? `relatorio-gerencial-usina-${sufixo}` : `relatorio-usina-${pagina}-${sufixo}`;
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Disposition': `inline; filename="${nome}.svg"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
