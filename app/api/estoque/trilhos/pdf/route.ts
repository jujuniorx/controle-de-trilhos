import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { montarEstoqueTrilhos } from '@/lib/services/estoqueTrilhos';
import { gerarEstoqueTrilhosPdf } from '@/lib/pdf/estoqueTrilhos';
import { dentroDoLimite } from '@/lib/services/limiteTaxa';
import { ipDoCliente } from '@/lib/services/clienteIp';

/** Baixa o estoque de trilhos detalhado (novo, reemprego, sucata e SAP) em PDF. */
export async function GET() {
  if (!(await dentroDoLimite('pdfestoquetrilhos', 15, 60_000, await ipDoCliente()))) {
    return new Response(JSON.stringify({ erro: 'Muitas requisições. Aguarde um minuto.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }
  await requireAdmin();
  const estoque = await montarEstoqueTrilhos();
  const pdf = gerarEstoqueTrilhosPdf({ saldos: estoque.saldos, sap: estoque.sap, atualizadoEm: estoque.atualizadoEm });
  const dia = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="estoque-trilhos-${dia}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
