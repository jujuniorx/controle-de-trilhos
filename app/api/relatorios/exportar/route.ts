import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { filtrosRelatorioSchema } from '@/lib/validation/relatorio';
import { buscarMovimentacoesRelatorio } from '@/lib/services/relatorio';
import { gerarRelatorioExcel } from '@/lib/services/exportarExcel';

export async function GET(request: NextRequest) {
  await requireAdmin();

  const params = request.nextUrl.searchParams;
  const filtros = filtrosRelatorioSchema.parse({
    dataInicio: params.get('dataInicio') ?? undefined,
    dataFim: params.get('dataFim') ?? undefined,
    tipo: params.get('tipo') ?? undefined,
    perfil: params.get('perfil') ?? undefined,
    material: params.get('material') ?? undefined,
    origemDestino: params.get('origemDestino') ?? undefined,
    numeroDocumento: params.get('numeroDocumento') ?? undefined,
    status: params.get('status') ?? undefined,
  });

  const movimentacoes = await buscarMovimentacoesRelatorio(filtros);
  const buffer = await gerarRelatorioExcel(movimentacoes);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="relatorio-movimentacao.xlsx"',
    },
  });
}
