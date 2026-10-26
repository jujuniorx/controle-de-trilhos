import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { montarDadosRelatorio, montarTrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { gerarOnePageUsinaPdf } from '@/lib/pdf/onePageUsina';
import { gerarGerencialDiarioPdf } from '@/lib/pdf/setorUsina';
import { colunasValidas, ehIsoValido, modoValido } from '@/lib/usina/periodo';

function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Baixa a one page da usina em PDF (A4 paisagem), para qualquer aparelho. */
export async function GET(request: NextRequest) {
  await requireAdmin();
  const pedido = request.nextUrl.searchParams.get('data') ?? undefined;
  const data = ehIsoValido(pedido) ? pedido : hojeSP();
  const [dados, tril] = await Promise.all([montarDadosRelatorio(data), montarTrilheirosRelatorio(data)]);
  const modo = modoValido(request.nextUrl.searchParams.get('modo') ?? undefined);
  const colunas = colunasValidas(request.nextUrl.searchParams.getAll('col'));
  const pdf = modo === 'diario' ? gerarGerencialDiarioPdf(dados, tril) : gerarOnePageUsinaPdf(dados, tril, modo === 'mensal' ? 'mensal' : 'semanal', colunas);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="relatorio-gerencial-usina-${data}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
