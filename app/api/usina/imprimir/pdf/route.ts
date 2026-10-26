import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { montarDadosRelatorio, montarTrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { gerarSetorUsinaPdf, SETORES_PDF, type SetorPdf } from '@/lib/pdf/setorUsina';
import { ehIsoValido } from '@/lib/usina/periodo';

function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** PDF de um setor da usina (estaleiro, geração, serra, caminhão ou trilheiros), em A4 paisagem. */
export async function GET(request: NextRequest) {
  await requireAdmin();
  const params = request.nextUrl.searchParams;
  const pedido = params.get('data') ?? undefined;
  const data = ehIsoValido(pedido) ? pedido : hojeSP();
  const setor = params.get('setor') ?? '';
  if (!(SETORES_PDF as readonly string[]).includes(setor)) {
    return NextResponse.json({ erro: 'Setor inválido.' }, { status: 400 });
  }
  const [dados, tril] = await Promise.all([montarDadosRelatorio(data), montarTrilheirosRelatorio(data)]);
  const pdf = gerarSetorUsinaPdf(dados, tril, setor as SetorPdf);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${setor}-usina-${data}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
