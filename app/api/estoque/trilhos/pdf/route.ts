import { NextResponse, type NextRequest } from 'next/server';
import { saldosAte } from '@/lib/estoque/trilhos';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { montarEstoqueTrilhos } from '@/lib/services/estoqueTrilhos';
import { gerarEstoqueTrilhosPdf } from '@/lib/pdf/estoqueTrilhos';
import { dentroDoLimite } from '@/lib/services/limiteTaxa';
import { ipDoCliente } from '@/lib/services/clienteIp';

/** Baixa o estoque de trilhos detalhado (novo, reemprego, sucata e SAP) em PDF. */
export async function GET(request: NextRequest) {
  if (!(await dentroDoLimite('pdfestoquetrilhos', 15, 60_000, await ipDoCliente()))) {
    return new Response(JSON.stringify({ erro: 'Muitas requisições. Aguarde um minuto.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }
  await requireAdmin();
  const estoque = await montarEstoqueTrilhos();
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const pedido = request.nextUrl.searchParams.get('ate') ?? '';
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(pedido) && pedido < hoje ? pedido : hoje;
  const pdf = gerarEstoqueTrilhosPdf({ saldos: saldosAte(estoque.lancamentos, dia), sap: estoque.sap, atualizadoEm: estoque.atualizadoEm, ate: dia === hoje ? null : dia });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="estoque-trilhos-${dia}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
