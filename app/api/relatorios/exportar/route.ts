import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { filtrosRelatorioSchema } from '@/lib/validation/relatorio';
import { buscarMovimentacoesRelatorio } from '@/lib/services/relatorio';
import { gerarRelatorioExcel } from '@/lib/services/exportarExcel';
import { dentroDoLimite } from '@/lib/services/limiteTaxa';
import { ipDoCliente } from '@/lib/services/clienteIp';

export async function GET(request: NextRequest) {
  if (!(await dentroDoLimite('exportar', 15, 60_000, await ipDoCliente()))) {
    return new Response(JSON.stringify({ erro: 'Muitas requisições. Aguarde um minuto.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }
  await requireAdmin();

  const params = request.nextUrl.searchParams;
  const entrada = filtrosRelatorioSchema.safeParse({
    dataInicio: params.get('dataInicio') ?? undefined,
    dataFim: params.get('dataFim') ?? undefined,
    tipo: params.get('tipo') ?? undefined,
    perfil: params.get('perfil') ?? undefined,
    material: params.get('material') ?? undefined,
    classificacao: params.get('classificacao') ?? undefined,
    origemDestino: params.get('origemDestino') ?? undefined,
    numeroDocumento: params.get('numeroDocumento') ?? undefined,
    status: params.get('status') ?? undefined,
  });
  if (!entrada.success) {
    return NextResponse.json({ erro: 'Filtros inválidos' }, { status: 400 });
  }
  const filtros = entrada.data;

  const movimentacoes = await buscarMovimentacoesRelatorio(filtros);
  const buffer = await gerarRelatorioExcel(movimentacoes);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="relatorio-movimentacao.xlsx"',
    },
  });
}
