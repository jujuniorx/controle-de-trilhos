import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { filtrosRelatorioSchema } from '@/lib/validation/relatorio';
import { buscarMovimentacoesRelatorio } from '@/lib/services/relatorio';
import { gerarRelatorioMovimentacaoPdf, nomeArquivoRelatorioMovimentacao } from '@/lib/pdf/relatorioMovimentacao';
import { dentroDoLimite } from '@/lib/services/limiteTaxa';
import { ipDoCliente } from '@/lib/services/clienteIp';

/** Baixa o relatório filtrado em PDF (mesmos filtros da tela e da exportação Excel). */
export async function GET(request: NextRequest) {
  if (!(await dentroDoLimite('pdfrelatorio', 15, 60_000, await ipDoCliente()))) {
    return new Response(JSON.stringify({ erro: 'Muitas requisições. Aguarde um minuto.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }
  await requireAdmin();

  const params = request.nextUrl.searchParams;
  const filtros = filtrosRelatorioSchema.parse({
    dataInicio: params.get('dataInicio') ?? undefined,
    dataFim: params.get('dataFim') ?? undefined,
    tipo: params.get('tipo') ?? undefined,
    perfil: params.get('perfil') ?? undefined,
    material: params.get('material') ?? undefined,
    classificacao: params.get('classificacao') ?? undefined,
    origemDestino: params.get('origemDestino') ?? undefined,
    numeroDocumento: params.get('numeroDocumento') ?? undefined,
    placa: params.get('placa') ?? undefined,
    status: params.get('status') ?? undefined,
  });

  const movimentacoes = await buscarMovimentacoesRelatorio(filtros);
  const pdf = gerarRelatorioMovimentacaoPdf(movimentacoes, filtros);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomeArquivoRelatorioMovimentacao(filtros)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
