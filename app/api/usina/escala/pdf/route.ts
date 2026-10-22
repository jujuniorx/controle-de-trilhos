import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { montarEscalaDaSemana } from '@/lib/services/usina';
import { gerarEscalaPdf } from '@/lib/pdf/escala';
import { ehIsoValido } from '@/lib/usina/periodo';

function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Segunda-feira da semana que contem a data (yyyy-mm-dd). */
function segundaDaSemana(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 domingo ... 6 sabado
  const deslocamento = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + deslocamento);
  return d.toISOString().slice(0, 10);
}

/** PDF da escala da semana (A4 paisagem). ?semana=yyyy-mm-dd; sem parametro, a semana atual. */
export async function GET(request: NextRequest) {
  await requireAdmin();
  const pedido = request.nextUrl.searchParams.get('semana') ?? undefined;
  const base = ehIsoValido(pedido) ? pedido : hojeSP();
  const semana = segundaDaSemana(base);
  const valor = await montarEscalaDaSemana(semana);
  const emitido = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const pdf = gerarEscalaPdf(semana, valor, emitido);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="escala-semana-${semana}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
